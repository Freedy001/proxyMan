package web

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"proxyMan/server/cert"
	"proxyMan/server/common"
	"proxyMan/server/proxy"
	"strings"
	"time"
)

// WebSocket client management for real-time monitoring
var (
	ServerPort int
	EnableCORS = false // 是否启用 CORS，默认禁用
)

// corsMiddleware CORS 中间件，仅在 EnableCORS 为 true 时生效
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if EnableCORS {
			origin := r.Header.Get("Origin")
			if origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", "*")
				w.Header().Set("Access-Control-Allow-Methods", "*")
				w.Header().Set("Access-Control-Allow-Headers", "*")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			// 处理预检请求
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
		}

		next(w, r)
	}
}

func StartWebServer(index *embed.FS, port int) error {
	distFS, err := fs.Sub(*index, "frontend/dist")
	if err != nil {
		return fmt.Errorf("failed to create sub filesystem: %w", err)
	}
	http.Handle("/", http.FileServer(http.FS(distFS)))

	// Real-time monitoring WebSocket (lightweight summaries)
	//http.HandleFunc("/status", common.SystemStatus.Handle)
	http.HandleFunc("/requests", common.ReqSummary.Handle)
	// Detail streaming WebSocket (full request details)
	http.HandleFunc("/requests/details/", common.NewWsHandler(handleDetail).Handle)

	// HTTP API endpoints (使用 CORS 中间件)
	http.HandleFunc("/api/proxy/config", corsMiddleware(handleProxyConfig))
	http.HandleFunc("/api/proxy/change", corsMiddleware(handleChangeProxy))
	http.HandleFunc("/api/proxy/upstream/config", corsMiddleware(handleUpstreamProxyConfig))
	http.HandleFunc("/api/proxy/upstream/change", corsMiddleware(handleChangeUpstreamProxy))
	http.HandleFunc("/api/cert/status", corsMiddleware(handleCertStatus))
	http.HandleFunc("/api/cert/install", corsMiddleware(handleCertInstall))
	http.HandleFunc("/api/cert/uninstall", corsMiddleware(handleCertUninstall))
	http.HandleFunc("/api/cert/install-script", corsMiddleware(handleInstallScript))
	http.HandleFunc("/api/cert/uninstall-script", corsMiddleware(handleUninstallScript))

	portStr := fmt.Sprintf(":%d", port)

	// 尝试绑定指定端口
	listener, err := net.Listen("tcp", portStr)
	if err != nil {
		// 端口被占用，尝试随机端口
		log.Printf("Port %d is in use, trying random port...", port)
		listener, err = net.Listen("tcp", ":0")
		if err != nil {
			return fmt.Errorf("failed to bind any port: %w", err)
		}
	}

	ServerPort = listener.Addr().(*net.TCPAddr).Port
	log.Printf("Starting Web Server on port %d", ServerPort)

	// 在 goroutine 中启动服务器
	go func() {
		if err := http.Serve(listener, nil); err != nil {
			log.Printf("WebSocket server error: %v", err)
		}
	}()

	return nil
}

func handleDetail(r *http.Request, writer *common.WSConn) {
	defer writer.Close()

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 || pathParts[3] == "" {
		sendErr(writer, "Request ID is required")
		return
	}

	requestID := pathParts[3]
	log.Printf("Detail streaming client connected for request: %s", requestID)
	// 安全的ID转换和验证
	var id int64
	if _, err := fmt.Sscanf(requestID, "%d", &id); err != nil {
		sendErr(writer, "Invalid request ID format")
		return
	}

	dataProxy := proxy.GetProxy(id)
	if dataProxy == nil {
		sendErr(writer, "Detail info has been cleaned!")
		return
	}

	// 启动数据流处理
	dataProxy.OnData(func(dataType common.DataType, data []byte, time time.Time, finished bool) {
		if err := writer.WriteJSON(common.NewDataChunk(dataType, data, finished)); err != nil {
			log.Printf("Detail streaming failed for request: %s, reason: %s", requestID, err)
			return
		}
	})
}

func sendErr(writer *common.WSConn, msg string) {
	if writeErr := writer.WriteJSON(common.NewDataChunk(common.ERROR, []byte(msg), true)); writeErr != nil {
		log.Printf("Failed to send error message: %s cause: %v", msg, writeErr)
	}
}

// handleProxyConfig 处理代理配置请求
func handleProxyConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	started, err := proxy.IsStarted()
	msg := map[string]interface{}{
		"status": started,
		"host":   proxy.GetCurrentProxyHost(),
		"port":   proxy.GetCurrentProxyPort(),
	}
	if err != nil {
		msg["msg"] = err.Error()
	}
	_ = json.NewEncoder(w).Encode(msg)
}

// handleChangeProxy 处理修改代理配置请求
func handleChangeProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// 解析请求body
	var req struct {
		Host string `json:"host"`
		Port int    `json:"port"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("Failed to decode request: %v", err)
		return
	}

	// 验证端口范围
	if req.Port < 0 || req.Port > 65535 {
		http.Error(w, "Port must be between 0 and 65535", http.StatusBadRequest)
		return
	}

	// 验证主机地址
	if req.Host == "" {
		req.Host = "127.0.0.1"
	}

	// 持久化配置
	if err := common.UpdateProxyConfig(req.Host, req.Port); err != nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": false,
			"msg":    "Failed to save proxy config: " + err.Error(),
		})
		return
	}

	// 重启代理服务器
	err := proxy.StartProxy(req.Host, req.Port)

	if err != nil {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": false,
			"msg":    err.Error(),
		})
		return
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": true,
		"host":   req.Host,
		"port":   req.Port,
	})
}

// handleUpstreamProxyConfig 处理上游代理配置获取
func handleUpstreamProxyConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cfg := proxy.GetUpstreamProxyConfig()

	response := map[string]interface{}{
		"mode":     cfg.Mode,
		"protocol": cfg.Protocol,
		"host":     cfg.Host,
		"port":     cfg.Port,
	}

	// 总是尝试获取环境变量中的代理地址，供前端显示
	envProxy := ""
	if httpProxy := os.Getenv("HTTP_PROXY"); httpProxy != "" {
		envProxy = httpProxy
	} else if httpProxy := os.Getenv("http_proxy"); httpProxy != "" {
		envProxy = httpProxy
	} else if httpsProxy := os.Getenv("HTTPS_PROXY"); httpsProxy != "" {
		envProxy = httpsProxy
	} else if httpsProxy := os.Getenv("https_proxy"); httpsProxy != "" {
		envProxy = httpsProxy
	}
	response["envProxy"] = envProxy

	_ = json.NewEncoder(w).Encode(response)
}

// handleChangeUpstreamProxy 处理修改上游代理配置请求
func handleChangeUpstreamProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var req struct {
		Mode     string `json:"mode"`     // "none", "env", "custom"
		Protocol string `json:"protocol"` // http, socket5
		Host     string `json:"host"`
		Port     int    `json:"port"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("Failed to decode upstream proxy request: %v", err)
		return
	}

	// 模式: "none" - 不使用上游代理
	if req.Mode == "none" {
		if err := proxy.SetUpstreamProxyConfig(common.UpstreamProxyConfig{Mode: "none"}); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status": false,
				"msg":    "保存配置失败: " + err.Error(),
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": true,
		})
		return
	}

	// 模式: "env" - 使用环境变量
	if req.Mode == "env" {
		if err := proxy.SetUpstreamProxyConfig(common.UpstreamProxyConfig{Mode: "env"}); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status": false,
				"msg":    "保存配置失败: " + err.Error(),
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": true,
		})
		return
	}

	// 模式: "custom" - 自定义代理
	if req.Mode == "custom" {
		// 验证协议类型
		if req.Protocol != "http" && req.Protocol != "socket5" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status": false,
				"msg":    "不支持的协议类型: " + req.Protocol,
			})
			return
		}

		if req.Host == "" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status": false,
				"msg":    "主机不能为空",
			})
			return
		}

		if req.Port <= 0 || req.Port > 65535 {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status": false,
				"msg":    "端口必须在 1-65535 之间",
			})
			return
		}

		// 设置上游代理配置
		cfg := common.UpstreamProxyConfig{
			Mode:     "custom",
			Protocol: req.Protocol,
			Host:     req.Host,
			Port:     req.Port,
		}

		if err := proxy.SetUpstreamProxyConfig(cfg); err != nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"status": false,
				"msg":    "保存配置失败: " + err.Error(),
			})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": true,
		})
		return
	}

	// 未知模式
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status": false,
		"msg":    "未知的模式: " + req.Mode,
	})
}

// handleCertStatus 处理证书状态查询
func handleCertStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	installed, _ := cert.IsCertificateInstalled()
	certPath := cert.CACertPath
	_, err := os.Stat(certPath)
	exists := err == nil

	// Get platform info
	sysInfo := cert.DetectSystem()
	platform := string(sysInfo.OS)
	if sysInfo.OS == cert.OSLinux && sysInfo.Distro != cert.DistroUnknown {
		platform = fmt.Sprintf("%s (%s)", platform, sysInfo.Distro)
	}

	status := map[string]interface{}{
		"installed": installed,
		"path":      certPath,
		"exists":    exists,
		"platform":  platform,
	}

	_ = json.NewEncoder(w).Encode(status)
}

// handleCertInstall 处理一键安装证书请求
func handleCertInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Attempt installation
	result := cert.InstallCertificate(cert.CACertPath)

	response := map[string]interface{}{
		"success":      result.Success,
		"requiresRoot": result.RequiresRoot,
		"message":      result.Message,
	}

	// If installation failed but script is available, include script info
	if !result.Success && result.Script != "" {
		response["hasScript"] = true
		response["scriptEndpoint"] = "/api/cert/install-script"
	}

	_ = json.NewEncoder(w).Encode(response)
}

// handleCertUninstall 处理卸载证书请求
func handleCertUninstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Attempt uninstallation
	result := cert.UninstallCertificate()

	response := map[string]interface{}{
		"success":      result.Success,
		"requiresRoot": result.RequiresRoot,
		"message":      result.Message,
	}

	// If uninstallation failed but script is available, include script info
	if !result.Success && result.Script != "" {
		response["hasScript"] = true
		response["scriptEndpoint"] = "/api/cert/uninstall-script"
	}

	_ = json.NewEncoder(w).Encode(response)
}

// handleInstallScript 处理生成安装脚本请求
func handleInstallScript(w http.ResponseWriter, r *http.Request) {
	generator := cert.NewScriptGenerator()

	script, filename, err := generator.GenerateInstallScript(cert.CACertPath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate script: %v", err), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type based on platform
	sysInfo := cert.DetectSystem()
	if sysInfo.OS == cert.OSWindows {
		w.Header().Set("Content-Type", "application/x-bat")
	} else {
		w.Header().Set("Content-Type", "application/x-sh")
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	_, _ = w.Write([]byte(script))
	log.Printf("Install script generated: %s", filename)
}

// handleUninstallScript 处理生成卸载脚本请求
func handleUninstallScript(w http.ResponseWriter, r *http.Request) {
	generator := cert.NewScriptGenerator()

	script, filename, err := generator.GenerateUninstallScript()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to generate script: %v", err), http.StatusInternalServerError)
		return
	}

	// Set appropriate content type based on platform
	sysInfo := cert.DetectSystem()
	if sysInfo.OS == cert.OSWindows {
		w.Header().Set("Content-Type", "application/x-bat")
	} else {
		w.Header().Set("Content-Type", "application/x-sh")
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	_, _ = w.Write([]byte(script))
	log.Printf("Uninstall script generated: %s", filename)
}
