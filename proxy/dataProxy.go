package proxy

import (
	"container/list"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"proxyMan/model"
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

type DataCb func(dataType model.DataType, data []byte, timestamp time.Time, finished bool)

const cacheSize = 1000
const maxBodySize = 100 * 1024 * 1024 //100MM
var bodyMaxMsg = &(list.List{})

func init() {
	bodyMaxMsg.PushBack([]byte("Body too large!"))
}

var maxIndex int64 = 0
var proxy = make([]*DataProxy, cacheSize)
var proxyMutex = &sync.RWMutex{} // 保护全局proxy数组的读写锁

type DataProxy struct {
	Contents *model.HttpContents
	Finished bool
	state    model.DataType
	reqBody  *list.List
	respBody *list.List
	bodySize int
	lock     *sync.Mutex
	cond     *sync.Cond
	error    error
}

func NewProxy() *DataProxy {
	id := atomic.AddInt64(&maxIndex, 1)
	now := time.Now()
	data := &DataProxy{
		Contents: &model.HttpContents{
			RequestSummary: model.RequestSummary{
				ID:        id,
				StartTime: &now,
				EndTime:   nil,
			},
		},
		state:    -1,
		reqBody:  &list.List{},
		respBody: &list.List{},
		lock:     &sync.Mutex{},
	}
	data.cond = sync.NewCond(data.lock)

	// 使用写锁保护全局proxy数组
	proxyMutex.Lock()
	proxy[int(id%cacheSize)] = data
	proxyMutex.Unlock()

	return data
}

func GetProxy(id int64) *DataProxy {
	// 使用读锁保护全局proxy数组访问
	proxyMutex.RLock()
	dataProxy := proxy[int(id%cacheSize)]
	proxyMutex.RUnlock()

	if dataProxy == nil || dataProxy.Id() != id {
		return nil
	}
	return dataProxy
}

func (p *DataProxy) Id() int64 {
	return p.Contents.ID
}

func (p *DataProxy) target() string {
	return p.Contents.URL
}

func (p *DataProxy) Duration() any {
	if p.Contents.EndTime == nil {
		return time.Since(*p.Contents.StartTime).Milliseconds()
	}
	return p.Contents.EndTime.Sub(*p.Contents.StartTime).Milliseconds()
}

func (p *DataProxy) reportRequest(req *http.Request) {
	p.lock.Lock()
	defer p.lock.Unlock()

	var fullURL string
	var protocol string
	if req.URL.Scheme == "http" {
		fullURL = "http://" + req.Host + req.URL.Path
		if req.URL.RawQuery != "" {
			fullURL += "?" + req.URL.RawQuery
		}
		protocol = "HTTP"
	} else {
		fullURL = "https://" + req.Host + req.URL.String()
		protocol = "HTTPS"
	}
	log.Printf("Intercepted %s request: %s %s (ID: %d)", protocol, req.Method, fullURL, p.Id())

	p.Contents.Status = model.StatusStarted
	p.Contents.Method = req.Method
	p.Contents.Host = req.Host
	p.Contents.URL = fullURL
	p.Contents.RequestHeaders = req.Header
	p.state = model.RequestHeader

	p.cond.Broadcast()
	model.SummaryBodyCast <- p.Contents.RequestSummary
}

func (p *DataProxy) reportResponse(resp *http.Response) {
	p.lock.Lock()
	defer p.lock.Unlock()

	// Update details with response headers
	p.Contents.Status = model.StatusReceiving
	p.Contents.ContentType = resp.Header.Get("Content-Type")
	p.Contents.StatusCode = resp.StatusCode
	p.Contents.ResponseHeaders = resp.Header
	p.state = model.ResponseHeader

	p.cond.Broadcast()
	model.SummaryBodyCast <- p.Contents.RequestSummary
}

func (p *DataProxy) reportChunkData(dataType model.DataType, chunk []byte) {
	p.lock.Lock()
	defer p.lock.Unlock()

	var bodyData *list.List
	switch dataType {
	case model.RequestBody:
		bodyData = p.reqBody
	case model.ResponseBody:
		bodyData = p.respBody
	}

	if bodyData == nil {
		return
	}

	p.bodySize += len(chunk)
	if p.bodySize > maxBodySize {
		if bodyData == bodyMaxMsg {
			return
		}
		p.reqBody = bodyMaxMsg
	} else {
		var chunkCopy []byte
		chunkCopy = make([]byte, len(chunk))
		copy(chunkCopy, chunk)
		bodyData.PushBack(chunkCopy)
		p.cond.Broadcast()
	}

}

func (p *DataProxy) reportEnd(dataType model.DataType) {
	p.lock.Lock()
	defer p.lock.Unlock()

	if dataType == model.RequestBody {
		p.Contents.RequestBody = getBytes(p.reqBody)
		p.reqBody = nil
		p.state = model.RequestBody
		p.bodySize = 0
	}

	if dataType == model.ResponseBody {
		p.Contents.Status = model.StatusCompleted
		now := time.Now()
		p.Contents.EndTime = &now
		p.Contents.ResponseBody = getBytes(p.respBody)
		p.respBody = nil
		p.Finished = true
		// 修复：移除重复的状态设置，避免潜在的状态冲突
		p.state = model.ResponseBody
		p.bodySize = 0
	}

	model.SummaryBodyCast <- p.Contents.RequestSummary
	p.cond.Broadcast()
}

func (p *DataProxy) reportError(error error) {
	p.lock.Lock()
	defer p.lock.Unlock()

	buf := make([]byte, 4096)
	n := runtime.Stack(buf, false)
	fmt.Printf("--- 当前 Goroutine 堆栈信息 ---\n%s\n", string(buf[:n]))
	log.Printf("Error occurred in proxy request %d: %s reason: %s", p.Id(), p.target(), error)

	p.Contents.Status = model.StatusError
	now := time.Now()
	p.Contents.EndTime = &now
	p.error = error
	p.state = model.ERROR

	// Broadcast error summary
	model.SummaryBodyCast <- p.Contents.RequestSummary
	p.cond.Broadcast()
	return
}

func (p *DataProxy) OnData(cb DataCb) {
	//RequestHeader
	p.waitStatusChange(model.RequestHeader)
	if p.checkError(cb) {
		return
	}
	data, err := json.Marshal(p.Contents.RequestHeaders)
	if err == nil {
		cb(model.RequestHeader, data, time.Now(), true)
	} else {
		cb(model.RequestHeader, []byte{}, time.Now(), true)
	}

	//RequestBody
	p.processBodyData(model.RequestBody, cb)
	if p.checkError(cb) {
		return
	}

	//ResponseHeader
	p.waitStatusChange(model.ResponseHeader)
	if p.checkError(cb) {
		return
	}
	data, err = json.Marshal(p.Contents.ResponseHeaders)
	if err == nil {
		cb(model.ResponseHeader, data, time.Now(), true)
	} else {
		cb(model.ResponseHeader, []byte{}, time.Now(), true)
	}

	//ResponseBody
	p.processBodyData(model.ResponseBody, cb)
	if p.checkError(cb) {
		return
	}

	data, err = json.Marshal(p.Contents.RequestSummary)
	if err == nil {
		cb(model.Metadata, data, time.Now(), true)
	} else {
		cb(model.Metadata, []byte{}, time.Now(), true)
	}
}

func (p *DataProxy) checkError(cb DataCb) bool {
	if p.state == model.ERROR {
		cb(model.ERROR, []byte(p.error.Error()), time.Now(), true)
		return true
	}
	return false
}

func (p *DataProxy) processBodyData(dataType model.DataType, cb DataCb) {
	p.lock.Lock()
	defer p.lock.Unlock()
	if p.state >= dataType {
		var data []byte
		if dataType == model.RequestBody {
			data = p.Contents.RequestBody
		} else if dataType == model.ResponseBody {
			data = p.Contents.ResponseBody
		} else {
			data = []byte{}
		}
		cb(dataType, data, time.Now(), true)
	} else {
		oldState := p.state
		var bodyList *list.List
		if dataType == model.RequestBody {
			bodyList = p.reqBody
		} else if dataType == model.ResponseBody {
			bodyList = p.respBody
		} else {
			return
		}

		for e := bodyList.Front(); e != nil; e = e.Next() {
			// list.List 的元素是 interface{}，需要进行类型断言
			chunk, ok := e.Value.([]byte)
			if !ok {
				// 如果链表中存储了非 []byte 类型的数据，返回错误
				fmt.Printf("body list contains a non-[]byte element of type %T\n", e.Value)
				return
			}
			cb(dataType, chunk, time.Now(), false)

			if e.Next() == nil {
				p.cond.Wait()
				if p.state != oldState {
					cb(dataType, []byte{}, time.Now(), true)
					break
				}
			}
		}
	}
}

func (p *DataProxy) waitStatusChange(datatype model.DataType) {
	p.lock.Lock()
	defer p.lock.Unlock()
	for p.state < datatype && p.state != model.ERROR {
		p.cond.Wait()
	}
}

// 优化的getBytes函数：单次遍历，提高性能
func getBytes(list *list.List) []byte {
	if list == nil || list.Len() == 0 {
		return nil
	}

	var totalSize int
	for e := list.Front(); e != nil; e = e.Next() {
		chunk, ok := e.Value.([]byte)
		if !ok {
			// 使用log.Printf而不是fmt.Println提高错误处理
			log.Printf("list contains a non-[]byte element of type %T", e.Value)
			return nil
		}
		totalSize += len(chunk)
	}

	if totalSize == 0 {
		return nil
	}

	// 一次性分配内存并复制
	result := make([]byte, totalSize)
	pos := 0
	for e := list.Front(); e != nil; e = e.Next() {
		chunk := e.Value.([]byte)
		copy(result[pos:], chunk)
		pos += len(chunk)
	}

	return result
}
