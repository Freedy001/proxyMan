package main

import (
	"fmt"
	"log"
	"net/http"
	"proxyMan/cert"
	"proxyMan/proxy"
	"proxyMan/web"
)

/*
 */
func main() {
	fmt.Println("ProxyMan starting...")

	cert.InitCA()
	cert.ClearCertCache() // Clear any cached certificates to use new logic

	go web.StartWebServer()

	server := &http.Server{
		Addr:    ":8888",
		Handler: http.HandlerFunc(proxy.HandleHTTP),
	}

	log.Println("Starting Proxy Server on :8888")
	if err := server.ListenAndServe(); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
