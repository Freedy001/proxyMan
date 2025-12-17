package proxy

import (
	"bufio"
	"compress/flate"
	"compress/gzip"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"proxyMan/server/cert"
	"proxyMan/server/common"
	"sync"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"
)

// 定义一个包装类型，它将 bufio.Reader 和 net.Conn 结合起来。
// 这样我们既可以读取缓冲区中的数据，又可以写入原始连接。
// 它实现了 net.Conn 接口。
type bufferedConn struct {
	r *bufio.Reader
	net.Conn
}

// 重写 Read 方法，使其从 bufio.Reader 中读取。
// 这样，被 Peek() 的数据也能被正确读取。
func (b bufferedConn) Read(p []byte) (int, error) {
	return b.r.Read(p)
}

// HandleHTTP is the main handler for all incoming proxy requests.
func HandleHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		handleConnect(w, r)
	} else {
		handlePlainHTTP(w, r)
	}
}

func handlePlainHTTP(w io.Writer, r *http.Request) {
	// 创建DataProxy实例来跟踪这个请求
	proxy := NewDataProxy()
	// 报告请求信息
	proxy.reportRequest(r)

	// 代理请求流
	pr, pw := io.Pipe()
	bodyReader := r.Body
	r.Body = pr
	go copyStream(bodyReader, pw, proxy, common.RequestBody, r.Header)

	// 清除RequestURI字段，避免客户端请求错误
	// Go HTTP客户端不允许设置RequestURI，这是服务器端专用字段
	r.RequestURI = ""
	r.URL.Scheme = "http"
	r.URL.Host = r.Host

	// 转发请求到目标服务器
	client := &http.Client{
		Transport: &http.Transport{
			Proxy: buildProxyFunc(),
		},
	}

	targetResp, err := client.Do(r)
	if err != nil {
		proxy.reportError(err)
		_ = (&http.Response{
			StatusCode: http.StatusBadGateway,
			Header:     make(http.Header),
			Body:       io.NopCloser(http.NoBody),
			Proto:      "HTTP/1.1",
			ProtoMajor: 1,
			ProtoMinor: 1,
		}).Write(w)
		return
	}

	defer targetResp.Body.Close()
	proxy.reportResponse(targetResp)

	// 代理响应
	pr, pw = io.Pipe()
	remoteBodyReader := targetResp.Body
	targetResp.Body = pr
	go copyStream(remoteBodyReader, pw, proxy, common.ResponseBody, targetResp.Header)

	err = targetResp.Write(w)
	if err != nil {
		proxy.reportError(err)
		return
	}

	log.Printf("Completed HTTPS request: (ID: %d, Duration: %dms)", proxy.Id(), proxy.Duration())
}

// handleConnect handles HTTPS CONNECT requests for MITM.
func handleConnect(w http.ResponseWriter, r *http.Request) {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Hijacking not supported", http.StatusInternalServerError)
		return
	}

	clientConn, _, err := hijacker.Hijack()
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	_, err = clientConn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	if err != nil {
		log.Printf("Failed to write connectied status for %s: %s", r.Host, err)
		return
	}

	bufReader := bufio.NewReader(clientConn)
	// 窥探第一个字节来判断协议
	firstByte, err := bufReader.Peek(1)
	if err != nil {
		log.Printf("Failed to peek first byte from %s: %s", r.Host, err)
		return
	}

	// TLS Handshake record type in decimal is 22
	if firstByte[0] != 0x16 {
		// --- 是普通HTTP流量，建立TCP隧道 ---
		log.Printf("Protocol Sniffing: Detected HTTP for %s", r.Host)
		clientReq, err := http.ReadRequest(bufReader)
		if err != nil {
			log.Printf("Failed to read HTTP request from %s: %s", r.Host, err)
			return
		}
		handlePlainHTTP(clientConn, clientReq)
		return
	}

	// --- 是TLS流量，处理HTTPS ---

	tlsCert, err := cert.GetCertificate(r.Host)
	if err != nil {
		log.Printf("Failed to get certificate for %s: %s", r.Host, err)
		_ = clientConn.Close()
		return
	}

	tlsConn := tls.Server(bufferedConn{r: bufReader, Conn: clientConn}, &tls.Config{Certificates: []tls.Certificate{*tlsCert}})
	if err := tlsConn.Handshake(); err != nil {
		log.Printf("TLS handshake error with %s: %s", r.Host, err)
		_ = tlsConn.Close()
		return
	}
	defer tlsConn.Close()

	clientReq, err := http.ReadRequest(bufio.NewReader(tlsConn))
	if err != nil {
		return
	}
	defer clientReq.Body.Close()

	proxy := NewDataProxy()
	proxy.reportRequest(clientReq)

	//代理请求流
	pr, pw := io.Pipe()
	bodyReader := clientReq.Body
	clientReq.Body = pr
	go copyStream(bodyReader, pw, proxy, common.RequestBody, clientReq.Header)

	// 清除RequestURI字段，避免客户端请求错误
	// Go HTTP客户端不允许设置RequestURI，这是服务器端专用字段
	clientReq.RequestURI = ""
	clientReq.URL.Scheme = "https"
	clientReq.URL.Host = clientReq.Host

	client := &http.Client{
		Transport: &http.Transport{
			Proxy: buildProxyFunc(),
		},
	}

	targetResp, err := client.Do(clientReq)
	if err != nil {
		proxy.reportError(err)
		writeErrorMsg(tlsConn)
		return
	}
	defer targetResp.Body.Close()
	proxy.reportResponse(targetResp)

	//代理响应
	pr, pw = io.Pipe()
	remoteBodyReader := targetResp.Body
	targetResp.Body = pr
	go copyStream(remoteBodyReader, pw, proxy, common.ResponseBody, targetResp.Header)

	err = targetResp.Write(tlsConn)
	if err != nil {
		proxy.reportError(err)
		return
	}

	log.Printf("Completed HTTPS request: (ID: %d, Duration: %dms)", proxy.Id(), proxy.Duration())
}

func writeErrorMsg(tlsConn *tls.Conn) {
	_ = (&http.Response{
		StatusCode: http.StatusBadGateway,
		Header:     make(http.Header),
		Body:       io.NopCloser(http.NoBody),
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
	}).Write(tlsConn)
}

func copyStream(src io.Reader, dst io.Writer, proxy *DataProxy, dataType common.DataType, header http.Header) {
	defer func() {
		// Close the writer to signal EOF to the reader side of the pipe
		if closer, ok := dst.(io.Closer); ok {
			_ = closer.Close()
		}
	}()

	pr, pw := io.Pipe()

	// This goroutine will read from the pipe, decode, and report.
	go func() {
		var reportReader io.Reader = pr
		var err error
		encoding := header.Get("Content-Encoding")
		switch encoding {
		case "gzip":
			reportReader, err = gzip.NewReader(pr)
			if err != nil {
				log.Printf("Error creating gzip reader: %v", err)
				proxy.reportError(err)
				_ = pr.CloseWithError(err) // Close the pipe with an error
				return
			}
		case "deflate":
			reportReader = flate.NewReader(pr)
		case "zstd":
			decoder, err := zstd.NewReader(pr)
			if err != nil {
				log.Printf("Error creating zstd reader: %v", err)
				proxy.reportError(err)
				_ = pr.CloseWithError(err) // Close the pipe with an error
				return
			}
			reportReader = decoder
		case "br":
			reportReader = brotli.NewReader(pr)
		}

		// Now read from the (possibly decoded) reportReader
		const chunkSize = 8192
		buffer := make([]byte, chunkSize)
		for {
			n, err := reportReader.Read(buffer)
			if n > 0 {
				proxy.reportChunkData(dataType, buffer[:n])
			}
			if err == io.EOF {
				proxy.reportEnd(dataType)
				break
			}
			if err != nil {
				log.Printf("Error reading decoded stream: %v", err)
				proxy.reportError(err)
				_ = pr.CloseWithError(err) // Close the pipe with an error
				break
			}
		}

		// If the reportReader is a decoder, it needs to be closed.
		if closer, ok := reportReader.(io.Closer); ok {
			_ = closer.Close()
		}
	}()

	// The main copyStream goroutine copies the original src to both the final destination (dst)
	// and the pipe writer (pw) for the reporting goroutine.
	// We must close the pipe writer when the copy is done to signal EOF to the reader side.
	writer := io.MultiWriter(dst, pw)
	_, _ = io.Copy(writer, src)
	_ = pw.Close()
}

var (
	currentServer *http.Server
	serverMutex   sync.Mutex
	startError    error
	currentHost   = "127.0.0.1" // 默认监听地址
	currentPort   = 8888        // 默认端口

	upstreamProxyConfig     common.UpstreamProxyConfig
	upstreamProxyConfigLock sync.RWMutex
)

func init() {
	upstreamProxyConfig = common.GetConfig().UpstreamProxy
}

func StartProxy(host string, port int) error {
	serverMutex.Lock()
	defer serverMutex.Unlock()

	listener, err := net.Listen("tcp", fmt.Sprintf("%s:%d", host, port))
	if err != nil {
		log.Printf("Failed to bind address : %s cause %v", fmt.Sprintf("%s:%d", host, port), err)
		return err
	}

	if currentServer != nil {
		_ = listener.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := currentServer.Shutdown(ctx); err != nil {
			log.Printf("Failed to shutdown proxy server: %v", err)
			return err
		}
		currentServer = nil
		log.Println("Proxy server stopped")
	}

	currentServer = &http.Server{Handler: http.HandlerFunc(HandleHTTP)}
	// 保存当前配置
	startError = nil
	currentHost = host
	currentPort = port
	go doStartServer(currentServer, listener)

	return nil
}

func doStartServer(server *http.Server, listener net.Listener) {
	log.Println("Starting Proxy Server on " + listener.Addr().String())
	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Println("Failed to listenAndServe: ", err)
		serverMutex.Lock()
		defer serverMutex.Unlock()
		currentServer = nil
		startError = err
	}
}

func GetUpstreamProxyConfig() common.UpstreamProxyConfig {
	upstreamProxyConfigLock.RLock()
	defer upstreamProxyConfigLock.RUnlock()
	return upstreamProxyConfig
}

func SetUpstreamProxyConfig(cfg common.UpstreamProxyConfig) error {
	upstreamProxyConfigLock.Lock()
	defer upstreamProxyConfigLock.Unlock()

	// 持久化配置
	err := common.UpdateUpstreamProxyConfig(cfg)
	if err != nil {
		return err
	}

	upstreamProxyConfig = cfg
	return nil
}

func buildProxyFunc() func(*http.Request) (*url.URL, error) {
	cfg := GetUpstreamProxyConfig()

	// Mode: "none" - 不使用上游代理
	if cfg.Mode == "none" {
		return func(*http.Request) (*url.URL, error) {
			return nil, nil
		}
	}

	// Mode: "env" - 使用环境变量
	if cfg.Mode == "env" || cfg.Mode == "" {
		return http.ProxyFromEnvironment
	}

	// Mode: "custom" - 使用自定义代理
	if cfg.Mode == "custom" && cfg.Protocol != "" && cfg.Host != "" && cfg.Port > 0 {
		proxyURLStr := fmt.Sprintf("%s://%s:%d", cfg.Protocol, cfg.Host, cfg.Port)
		proxyURL, err := url.Parse(proxyURLStr)
		if err != nil {
			log.Printf("invalid upstream proxy url %s: %v", proxyURLStr, err)
			return func(*http.Request) (*url.URL, error) {
				return nil, nil
			}
		}

		return http.ProxyURL(proxyURL)
	}

	// 默认使用环境变量
	return http.ProxyFromEnvironment
}

func IsStarted() (bool, error) {
	return currentServer != nil, startError
}

func GetCurrentProxyPort() int {
	serverMutex.Lock()
	defer serverMutex.Unlock()
	return currentPort
}

func GetCurrentProxyHost() string {
	serverMutex.Lock()
	defer serverMutex.Unlock()
	return currentHost
}
