package web

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"proxyMan/model"
	"proxyMan/proxy"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// isValidOrigin checks if the request origin is allowed
func isValidOrigin(r *http.Request) bool {
	// Get the origin header
	origin := r.Header.Get("Origin")
	if origin == "" {
		// Allow requests without origin (like from Postman, curl, etc.)
		return true
	}

	// Parse the origin URL
	originURL, err := url.Parse(origin)
	if err != nil {
		log.Printf("Invalid origin URL: %s, error: %v", origin, err)
		return false
	}

	// Get the host from the request
	requestHost := r.Host
	if requestHost == "" {
		requestHost = "localhost:8080" // Default host
	}

	// Allow same-origin requests
	if originURL.Host == requestHost {
		return true
	}

	// Allow localhost variations for development
	allowedHosts := []string{
		"localhost:3000",
		"127.0.0.1:3000",
		"localhost:8080",
		"127.0.0.1:8080",
		"[::1]:8080",
	}

	for _, allowedHost := range allowedHosts {
		if originURL.Host == allowedHost {
			return true
		}
	}

	log.Printf("Rejected WebSocket connection from origin: %s", origin)
	return false
}

var upgrader = websocket.Upgrader{
	CheckOrigin: isValidOrigin, // 使用安全的origin检查
}

// WebSocket client management for real-time monitoring
var (
	monitorClients = make(map[*websocket.Conn]bool)
	monitorMutex   = &sync.Mutex{}
)

// Handle real-time monitoring WebSocket connections
func handleMonitorWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Monitor WebSocket upgrade error:", err)
		return
	}
	defer func() { _ = conn.Close() }()

	// 设置心跳和超时处理
	err = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	if err != nil {
		log.Println("Monitor WebSocket set read timeout error:", err)
		return
	}

	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	monitorMutex.Lock()
	monitorClients[conn] = true
	monitorMutex.Unlock()

	log.Println("Monitor client connected to WebSocket")

	// Cleanup when connection closes
	defer func() {
		monitorMutex.Lock()
		delete(monitorClients, conn)
		monitorMutex.Unlock()
		log.Println("Monitor client disconnected")
	}()

	// 心跳ticker
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

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

// Handle detail streaming WebSocket connections for specific requests
func handleDetailWebSocket(w http.ResponseWriter, r *http.Request) {
	// Extract request ID from URL path like /ws/details/{id}
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 || pathParts[3] == "" {
		http.Error(w, "Request ID is required", http.StatusBadRequest)
		return
	}
	requestID := pathParts[3]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Detail WebSocket upgrade error:", err)
		return
	}
	defer func() {
		if closeErr := conn.Close(); closeErr != nil {
			log.Printf("Error closing WebSocket connection: %v", closeErr)
		}
	}()

	// 设置心跳和超时
	err = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	if err != nil {
		log.Println("Set WS timeout error:", err)
		return
	}
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	log.Printf("Detail streaming client connected for request: %s", requestID)

	// 安全的ID转换和验证
	var id int64
	if _, err := fmt.Sscanf(requestID, "%d", &id); err != nil {
		if writeErr := conn.WriteJSON(model.NewDataChunk(model.ERROR, []byte("Invalid request ID format"), true)); writeErr != nil {
			log.Printf("Failed to send error message: %v", writeErr)
		}
		return
	}

	dataProxy := proxy.GetProxy(id)
	if dataProxy == nil {
		if err := conn.WriteJSON(model.NewDataChunk(model.ERROR, []byte("Detail info has been cleaned!"), true)); err != nil {
			log.Printf("Detail streaming failed for request: %s, reason: %s", requestID, err)
		}
		return
	}

	// 启动数据流处理
	dataDone := make(chan bool, 1)
	go func() {
		dataProxy.OnData(func(dataType model.DataType, data []byte, time time.Time, finished bool) {
			if err := conn.WriteJSON(model.NewDataChunk(dataType, data, finished)); err != nil {
				log.Printf("Detail streaming failed for request: %s, reason: %s", requestID, err)
				return
			}
		})
		dataDone <- true
	}()

	// 心跳ticker
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// 主循环处理心跳和连接状态
	for {
		select {
		case <-dataDone:
			log.Printf("Data streaming completed for request %s", requestID)
			return
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
				log.Printf("Ping failed for request %s: %v", requestID, err)
				return
			}
		default:
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("Detail WebSocket connection closed unexpectedly for request %s: %v", requestID, err)
				} else {
					log.Printf("Detail WebSocket connection closed for request %s", requestID)
				}
				return
			}
		}
	}
}

// Handle broadcasting messages to monitoring clients
func handleMonitorMessages() {
	for {
		msg := <-model.SummaryBodyCast

		monitorMutex.Lock()
		// 收集失败的客户端连接
		var failedClients []*websocket.Conn
		for client := range monitorClients {
			// 设置写入超时
			err := client.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err != nil {
				log.Printf("Monitor broadcast error: %v", err)
				failedClients = append(failedClients, client)
				continue
			}

			err = client.WriteJSON(msg)
			if err != nil {
				log.Printf("Monitor broadcast error: %v", err)
				failedClients = append(failedClients, client)
			}
		}
		// 清理失败的连接
		for _, client := range failedClients {
			_ = client.Close()
			delete(monitorClients, client)
		}
		monitorMutex.Unlock()
	}
}

func StartWebServer() {
	fs := http.FileServer(http.Dir("web/static"))
	http.Handle("/", fs)

	// Real-time monitoring WebSocket (lightweight summaries)
	http.HandleFunc("/ws", handleMonitorWebSocket)

	// Detail streaming WebSocket (full request details)
	http.HandleFunc("/ws/details/", handleDetailWebSocket)

	// Start the message broadcasting goroutine
	go handleMonitorMessages()

	log.Println("Starting Web Server on :8080")
	log.Println("  /ws - Real-time monitoring (lightweight)")
	log.Println("  /ws/details/{id} - Detailed streaming")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
