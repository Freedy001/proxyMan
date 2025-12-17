//go:build !cmd

package server

import (
	"context"
	"embed"
	"fmt"
	"log"
	"os"
	"proxyMan/server/web"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

// Run 启动 Wails 桌面应用模式
func Run(assets *embed.FS) {
	// 启用 CORS（桌面应用需要）
	web.EnableCORS = true
	log.Println("Running in Wails desktop mode, CORS enabled")

	// 创建应用实例
	app := NewApp()

	// 运行 Wails 桌面应用
	err := wails.Run(&options.App{
		Title:  "ProxyMan - Network Proxy Monitor",
		Width:  1400,
		Height: 900,
		AssetServer: &assetserver.Options{
			Assets: *assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnDomReady:       app.domReady,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
		// macOS 特定配置
		Mac: &mac.Options{
			TitleBar: mac.TitleBarHiddenInset(),
			About: &mac.AboutInfo{
				Title:   "ProxyMan",
				Message: "Network Proxy Monitor with MITM Capabilities\n\nVersion 1.0.0",
			},
		},
		// Windows 特定配置
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			DisableWindowIcon:    false,
		},
	})

	if err != nil {
		fmt.Println("Error:", err.Error())
		os.Exit(1)
	}
}

// App Wails 应用结构体
type App struct {
	ctx context.Context
}

// NewApp 创建应用实例
func NewApp() *App {
	return &App{}
}

func (a *App) GetServerPort() int {
	return web.ServerPort
}

// startup 在应用启动时调用
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	log.Println("ProxyMan 桌面应用启动完成")
}

// shutdown 在应用关闭时调用
func (a *App) shutdown(ctx context.Context) {
	log.Println("ProxyMan 应用关闭")
}

// domReady 在前端 DOM 加载完成时调用
func (a *App) domReady(ctx context.Context) {
	log.Println("前端 DOM 加载完成")
}
