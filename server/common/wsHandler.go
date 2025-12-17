package common

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	//SystemStatus = NewWsHandler(nil)
	ReqSummary = NewWsHandler(nil)
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有 Origin
	},
}

type handleRequest func(r *http.Request, writer *WSConn)

type WSConn struct {
	*WsHandler
	conn *websocket.Conn
}

func (c *WSConn) WriteJSON(msg any) error {
	return writeJSON(c.conn, msg)
}

func (c *WSConn) Close() {
	c.monitorMutex.Lock()
	defer c.monitorMutex.Unlock()

	closeConn(c.conn)
	delete(c.monitorClients, c.conn)
}

type WsHandler struct {
	monitorClients map[*websocket.Conn]bool
	monitorMutex   *sync.Mutex
	handle         handleRequest
}

func NewWsHandler(handle handleRequest) *WsHandler {
	return &WsHandler{
		monitorClients: make(map[*websocket.Conn]bool),
		monitorMutex:   &sync.Mutex{},
		handle:         handle,
	}
}

func (h *WsHandler) Handle(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Monitor WebSocket upgrade error:", err)
		return
	}
	defer closeConn(conn)

	h.monitorMutex.Lock()
	h.monitorClients[conn] = true
	h.monitorMutex.Unlock()

	log.Println("Monitor client connected to WebSocket")

	// Cleanup when connection closes
	defer func() {
		h.monitorMutex.Lock()
		delete(h.monitorClients, conn)
		h.monitorMutex.Unlock()
		log.Println("Monitor client disconnected")
	}()

	// 心跳ticker
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	if h.handle != nil {
		go h.handle(r, &WSConn{h, conn})
	}

	// 保持连接活跃状态
	for {
		select {
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				log.Printf("Monitor ping failed: %v", err)
				return
			}
		default:
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Monitor WebSocket connection closed unexpectedly: %v", err)
				}
				return
			}
		}
	}
}

func (h *WsHandler) BoardCast(msg any) {
	h.monitorMutex.Lock()
	// 收集失败的客户端连接
	var failedClients []*websocket.Conn
	for client := range h.monitorClients {
		err := writeJSON(client, msg)
		if err != nil {
			log.Printf("Monitor broadcast error: %v", err)
			failedClients = append(failedClients, client)
		}
	}
	// 清理失败的连接
	for _, client := range failedClients {
		_ = client.Close()
		delete(h.monitorClients, client)
	}
	h.monitorMutex.Unlock()
}

func writeJSON(client *websocket.Conn, msg any) error {
	// 设置写入超时
	err := client.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if err != nil {
		return err
	}

	err = client.WriteJSON(msg)
	return err
}

func closeConn(conn *websocket.Conn) {
	// 发送关闭帧，状态码 1000 表示正常关闭
	msg := websocket.FormatCloseMessage(websocket.CloseNormalClosure, "bye")
	err := conn.WriteControl(
		websocket.CloseMessage,
		msg,
		time.Now().Add(time.Second),
	)
	if err != nil {
		log.Printf("Failed to Close connection: %s", err.Error())
	}
	_ = conn.Close()
}
