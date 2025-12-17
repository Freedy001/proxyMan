//go:build cmd

package server

import (
	"embed"
	"log"
	"proxyMan/server/web"
)

// Run 在非桌面模式下不执行任何操作
func Run(assets *embed.FS) {
	log.Printf("web ui mode actived! plaese visit http://127.0.0.1:%d", web.ServerPort)
	select {} // 永久阻塞
}
