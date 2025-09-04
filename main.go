package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
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

	port := "8888"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: http.HandlerFunc(proxy.HandleHTTP),
	}

	log.Println("Starting Proxy Server on :" + port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
