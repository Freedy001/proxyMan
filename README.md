# ProxyMan

[![Go Version](https://img.shields.io/badge/Go-1.25.0-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Proxy](https://img.shields.io/badge/Proxy-HTTP%2FHTTPS-red.svg)](#)

ProxyMan 是一个基于 Go 语言开发的 HTTP/HTTPS 代理服务器，具备中间人（MITM）拦截功能和实时监控界面。它提供透明的代理功能，能够拦截和监控 HTTP 和 HTTPS 流量，并通过 Web 界面实时展示。

## ✨ 功能特性

![img_1.png](img_1.png)

### 🔐 代理功能
- **HTTP/HTTPS 代理**：完全支持 HTTP 和 HTTPS 协议
- **中间人拦截**：自动生成证书，实现 HTTPS 流量拦截
- **透明代理**：对客户端完全透明，无需特殊配置
- **高性能**：基于 Go 原生网络库，支持高并发连接
- **上游代理支持**：支持配置上游代理服务器

### 📊 实时监控
- **Web 界面**：直观的 Web 管理界面
- **实时数据流**：WebSocket 实时推送请求信息
- **详细数据**：支持查看请求/响应的完整内容
- **大模型接口兼容**： 支持查看大模型对话内容

## 🚀 快速开始

### 环境要求
- Go 1.25.0 或更高版本,Nodejs 22 或更高版本
- 操作系统：Windows、macOS、Linux

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/proxyMan.git
   cd proxyMan
   ```

2. **安装依赖**
   ```bash
   go mod tidy
   cd frontend && npm install
   ```

3. **构建项目**
   ```bash
   cd frontend && npm build
   go build -o proxyMan
   ```

4. **运行代理**
   ```bash
   # 使用默认端口
   ./proxyMan
   
   # 指定代理端口
   ./proxyMan 8888
   
   # 指定代理端口和 Web 端口
   ./proxyMan 8888 8080
   ```

5. **访问 Web 界面**
   打开浏览器访问 `http://localhost:8080`

### 开发模式运行
```bash
go run main.go
```

## 📖 使用指南

### 基本配置

#### 默认端口
- **代理服务器**：8888
- **Web 管理界面**：8080

#### 自定义端口
```bash
# 代理端口 8888，Web 端口 8080（默认）
./proxyMan

# 自定义代理端口
./proxyMan 8080

# 自定义代理端口和 Web 端口
./proxyMan 8080 9090
```

### 代理设置

#### 浏览器配置
1. 打开浏览器设置
2. 配置代理服务器为 `localhost:8888`
3. 保存设置

#### 系统代理
- **Windows**：网络设置 → 代理 → 手动配置代理
- **macOS**：系统偏好设置 → 网络 → 高级 → 代理
- **Linux**：设置环境变量 `export http_proxy=http://localhost:8888`

### HTTPS 信任证书

1. **获取证书**
    - 程序启动时会检测当前路径是否存在证书`ca.crt`，没有则自动生成

2. **安装证书**
    - **Windows**：双击 `ca.crt` → 安装证书 → 受信任的根证书颁发机构
    - **macOS**：双击 `ca.crt` → 钥匙串访问 → 系统 → 信任 → 始终信任
    - **Linux**：将证书复制到 `/usr/local/share/ca-certificates/` 并运行 `update-ca-certificates`

3. **验证设置**
   访问 HTTPS 网站，确认浏览器无证书警告

### 上游代理配置

ProxyMan 支持通过环境变量配置上游代理，所有流量将自动转发到指定的上游代理服务器。

#### 设置上游代理
```bash
# HTTP 上游代理
export HTTP_PROXY=http://proxy.example.com:8080
export http_proxy=http://proxy.example.com:8080

# HTTPS 上游代理
export HTTPS_PROXY=http://proxy.example.com:8080
export https_proxy=http://proxy.example.com:8080

# SOCKS5 代理
export ALL_PROXY=socks5://proxy.example.com:1080
export all_proxy=socks5://proxy.example.com:1080

# 设置代理认证（如果需要）
export HTTP_PROXY=http://username:password@proxy.example.com:8080
export HTTPS_PROXY=http://username:password@proxy.example.com:8080
```

#### 使用示例
```bash
# 配置上游代理并启动 ProxyMan
export HTTP_PROXY=http://company-proxy:8080
export HTTPS_PROXY=http://company-proxy:8080
./proxyMan

# 使用 SOCKS5 代理
export ALL_PROXY=socks5://127.0.0.1:1080
./proxyMan

# 临时设置（仅当前会话有效）
HTTP_PROXY=http://proxy.example.com:8080 HTTPS_PROXY=http://proxy.example.com:8080 ./proxyMan
```

#### 验证上游代理
```bash
# 测试代理连接
curl -x http://localhost:8888 https://httpbin.org/ip

# 查看日志确认上游代理被使用
go run main.go
# 观察日志中的连接信息
```

#### 代理链配置
```
Client → ProxyMan (localhost:8888) → Upstream Proxy → Target Server
```

## 🏗️ 架构设计

### 核心组件

#### 🎯 代理服务器 (`proxy/proxy.go`)
- **请求路由**：区分 HTTP 和 HTTPS 请求
- **连接处理**：处理 CONNECT 请求，建立 TLS 隧道
- **流量转发**：透明的请求/响应转发
- **协议嗅探**：自动检测 HTTP/HTTPS 协议
- **上游代理**：自动使用环境变量中的上游代理配置

#### 🔐 证书管理 (`cert/cert.go`)
- **CA 管理**：根证书的生成和加载
- **动态证书**：为每个域名生成 TLS 证书
- **缓存优化**：智能证书缓存和清理机制
- **并发安全**：线程安全的证书操作

#### 🌐 Web 界面 (`web/server.go`)
- **WebSocket 服务**：实时数据推送
- **静态文件**：前端资源服务
- **连接管理**：多客户端连接处理

### 数据流处理
```
Client Request → Proxy Server → Certificate Generation → Target Server
     ↓
Request Capture → WebSocket Broadcast → Web Interface → Real-time Display
```

## 🚨 安全说明

### 安全特性
- 仅用于开发和测试环境
- 证书私钥本地存储，不对外传输

### 风险提示
- 代理可以查看所有明文流量
- HTTPS 流量通过 MITM 解密
- 请遵守相关法律法规
- 不要用于非法用途

## 🐛 故障排除

### 常见问题

#### 1. 证书信任问题
**问题**：浏览器显示证书不受信任
**解决**：
- 确保正确安装 CA 证书
- 检查证书是否安装到受信任的根证书颁发机构
- 重启浏览器

#### 2. 端口占用
**问题**：提示端口已被占用
**解决**：
```bash
# 查看端口占用
lsof -i :8888
lsof -i :8080

# 更换端口
./proxyMan 8080 9090
```

#### 3. HTTPS 拦截失败
**问题**：HTTPS 网站无法访问
**解决**：
- 确保正确安装 CA 证书
- 检查域名是否包含端口号
- 查看日志文件排查错误

#### 4. Web 界面无法访问
**问题**：无法打开 Web 管理界面
**解决**：
- 检查防火墙设置
- 确认 Web 服务器端口配置
- 查看服务器日志

#### 5. 上游代理连接失败
**问题**：上游代理无法连接或认证失败
**解决**：
- 检查环境变量设置是否正确
- 验证上游代理服务器地址和端口
- 确认代理认证信息格式正确
- 检查网络连接和防火墙设置


---

**注意**：本工具仅用于开发和测试目的，请遵守相关法律法规，不要用于非法用途。