# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProxyMan is a Go-based HTTP/HTTPS proxy server with Man-in-the-Middle (MITM) capabilities and real-time monitoring. It provides transparent proxy functionality with the ability to intercept and monitor both HTTP and HTTPS traffic through a web interface.

## Development Commands

### Build and Run
```bash
# Build the project
go build -o proxyMan

# Run development version
go run main.go

# Run compiled version
./proxyMan

# Manage dependencies
go mod tidy
go mod download
```

### Testing
```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run benchmarks
go test -bench ./...
```

## Architecture

### Core Components

**Proxy Server (port 8888)**
- `proxy/proxy.go` - Main proxy handler that routes HTTP and HTTPS requests
- `cert/cert.go` - Certificate authority for HTTPS MITM interception
- Handles both HTTP proxying and HTTPS CONNECT requests with TLS interception

**Web Interface (port 8080)**
- `web/server.go` - WebSocket server for real-time request broadcasting
- `web/static/index.html` - Web UI for monitoring captured requests
- Uses gorilla/websocket for real-time communication

**Entry Point**
- `main.go` - Initializes CA certificate, starts web server in goroutine, launches proxy server

### Key Architecture Patterns

**MITM HTTPS Handling**
- `cert.InitCA()` creates a root CA certificate (4096-bit RSA) if it doesn't exist
- `cert.GetCertificate(host)` dynamically generates domain-specific certificates (1-day validity)
- `proxy.handleConnect()` hijacks HTTPS connections and performs TLS handshake with dynamic certs

**Request Processing Pipeline**
1. HTTP requests: `handlePlainHTTP()` → forward to target → broadcast to WebSocket
2. HTTPS requests: `handleConnect()` → TLS MITM → process HTTPS → forward to target → broadcast to WebSocket

**Real-time Monitoring**
- WebSocket broadcast channel (`web.BroadcastMessage()`)
- Concurrent-safe client management with mutex
- JSON-serialized request data (method, URL, host)

### Data Flow

```
Client Request → Proxy Server (8888) → Certificate Generation → Target Server
     ↓
Request Capture → WebSocket Broadcast → Web Interface (8080) → Real-time Display
```

## Integration Points

### Component Dependencies
- **main → cert**: CA initialization must complete before proxy starts
- **proxy → cert**: Runtime certificate generation for HTTPS domains
- **proxy → web**: Asynchronous request broadcasting via WebSocket
- **web → proxy**: No direct dependency, receives broadcast messages

### Key Technical Details
- **Certificate Cache**: In-memory map in `cert/cert.go` prevents redundant cert generation
- **Connection Hijacking**: Uses `http.Hijacker` interface for HTTPS MITM
- **Concurrent Safety**: WebSocket clients managed with `sync.Mutex`
- **Error Handling**: Graceful degradation when certificate generation fails

## Configuration Notes

### Hardcoded Parameters
- Proxy port: `:8888` (main.go:20)
- Web server port: `:8080` (web/server.go:84)
- CA certificate: 10-year validity (cert/cert.go:39)
- Domain certificates: 1-day validity (cert/cert.go:116)
- CA private key: 4096-bit RSA (cert/cert.go:46)
- Domain certificates: 2048-bit RSA (cert/cert.go:105)

### File Dependencies
- `ca.crt` and `ca.key` files are generated automatically in project root
- Certificate cache is memory-only (reset on restart)
- Static files served from `web/static/` directory

## Development Considerations

### Security Context
- This is a defensive security tool for monitoring and debugging
- MITM capabilities require proper certificate trust installation on client systems
- WebSocket connections allow all origins (dev setting)
- No built-in authentication (development-focused design)

### Testing Strategy
- Currently lacks test coverage - prioritize unit tests for certificate generation
- Integration tests should cover HTTP/HTTPS proxy flows
- Performance testing needed for high-concurrency scenarios
- WebSocket connection handling requires concurrent testing

### Common Development Tasks
- Adding new proxy features: modify `proxy/proxy.go`
- Certificate customization: update `cert/cert.go` generation logic
- Web interface changes: modify `web/static/index.html` and corresponding WebSocket handlers
- Port configuration: currently hardcoded, would need refactoring for configurability