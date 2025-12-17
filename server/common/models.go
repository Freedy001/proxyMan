package common

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"
)

// RequestStatus represents the current status of a request
type RequestStatus string

type DataType int

const (
	StatusStarted   RequestStatus = "started"
	StatusReceiving RequestStatus = "receiving"
	StatusCompleted RequestStatus = "completed"
	StatusError     RequestStatus = "error"

	RequestHeader  DataType = 0
	RequestBody    DataType = 1
	ResponseHeader DataType = 2
	ResponseBody   DataType = 3
	Metadata       DataType = 4
	ERROR          DataType = 5
)

// RequestSummary is a lightweight summary of a request for list view
type RequestSummary struct {
	//基础数据
	ID        int64         `json:"id"`
	StartTime *time.Time    `json:"startTime"`
	EndTime   *time.Time    `json:"endTime"`
	Status    RequestStatus `json:"status"`
	//请求数据
	Method string `json:"method"`
	Host   string `json:"host"`
	URL    string `json:"url"`
	//响应数据
	ContentType string `json:"contentType"`
	StatusCode  int    `json:"statusCode"`
}

// HttpContents contains all captured details of a request-response cycle
type HttpContents struct {
	RequestSummary
	RequestHeaders  http.Header `json:"requestHeaders"`
	RequestBody     []byte      `json:"requestBody"`
	ResponseHeaders http.Header `json:"responseHeaders"`
	ResponseBody    []byte      `json:"responseBody"` // 改为字节数组以支持二进制数据
}

// DataChunk represents a chunk of response data for streaming
type DataChunk struct {
	DataType DataType `json:"dataType"`
	Data     []byte   `json:"data"`
	//每种DataType都只有一条Finished为 ture 的消息
	Finished  bool      `json:"finished"`
	Timestamp time.Time `json:"timestamp"`
}

// MarshalJSON customizes JSON serialization to handle binary data properly
func (dc *DataChunk) MarshalJSON() ([]byte, error) {
	type Alias DataChunk
	return json.Marshal(&struct {
		Data string `json:"data"` // Convert []byte to base64 string
		*Alias
	}{
		Data:  base64.StdEncoding.EncodeToString(dc.Data),
		Alias: (*Alias)(dc),
	})
}

// UnmarshalJSON customizes JSON deserialization to handle binary data
func (dc *DataChunk) UnmarshalJSON(data []byte) error {
	type Alias DataChunk
	aux := &struct {
		Data string `json:"data"` // Expect base64 string
		*Alias
	}{
		Alias: (*Alias)(dc),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	// Decode base64 string back to []byte
	decoded, err := base64.StdEncoding.DecodeString(aux.Data)
	if err != nil {
		return err
	}
	dc.Data = decoded
	return nil
}

// NewDataChunk creates a new DataChunk with proper initialization
func NewDataChunk(dataType DataType, data []byte, finished bool) DataChunk {
	return DataChunk{
		DataType:  dataType,
		Data:      data,
		Finished:  finished,
		Timestamp: time.Now(),
	}
}

// GetDataAsString returns the data as a string (useful for text content)
func (dc *DataChunk) GetDataAsString() string {
	return string(dc.Data)
}

// GetDataSize returns the size of the data in bytes
func (dc *DataChunk) GetDataSize() int {
	return len(dc.Data)
}

// IsEmpty checks if the chunk contains no data
func (dc *DataChunk) IsEmpty() bool {
	return len(dc.Data) == 0
}
