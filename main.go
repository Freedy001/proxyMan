package main

import (
	"embed"
	"flag"
	"io"
	"log"
	"os"
	"path/filepath"
	"proxyMan/server"
	"proxyMan/server/cert"
	"proxyMan/server/common"
	"proxyMan/server/proxy"
	"proxyMan/server/web"

	"gopkg.in/natefinch/lumberjack.v2"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	initLogger()

	// 定义命令行参数
	port := flag.Int("port", 8080, "WebSocket 服务器端口")
	cfg := common.GetConfig()
	pport := flag.Int("pport", cfg.ProxyPort, "代理服务器端口")
	phost := flag.String("phost", cfg.ProxyHost, "代理服务器监听地址")
	flag.Parse()

	cert.InitCA()
	cert.ClearCertCache() // Clear any cached certificates to use new logic

	err := web.StartWebServer(&assets, *port)
	if err != nil {
		log.Fatalf("Failed to start WebSocket server: %v", err)
	}

	// 启动代理服务
	//goland:noinspection GoUnhandledErrorResult
	go proxy.StartProxy(*phost, *pport)

	// 否则尝试启动桌面模式（仅在 wails build 时可用）
	server.Run(&assets)
}

func initLogger() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal("无法获取home目录，请尝试设置环境变量后再次启动")
	}

	logPath := filepath.Join(homeDir, ".proxyMan", "log", "app.log")

	// 配置日志滚动
	lumberjackLogger := &lumberjack.Logger{
		Filename:   logPath,
		MaxSize:    10,   // 每个日志文件最大 10MB
		MaxBackups: 10,   // 保留最近 10 个日志文件
		MaxAge:     30,   // 保留 30 天内的日志
		Compress:   true, // 压缩旧日志文件
		LocalTime:  true, // 使用本地时间
	}

	// 同时输出到控制台和文件
	multiWriter := io.MultiWriter(os.Stderr, lumberjackLogger)

	log.SetOutput(multiWriter)
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Println("日志系统初始化完成")
}
