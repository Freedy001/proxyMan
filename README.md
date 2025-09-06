# proxyMan

## 项目简介
proxyMan 是一个集成代理管理、请求监控与 AI 能力的工具，支持 HTTP/HTTPS 代理流量分析，前端可视化展示请求详情，适用于开发调试和数据分析场景。

## 技术栈
- 后端：Go
- 前端：Vue 3 + Vite
- 证书管理：自签名 CA

## 目录结构
```
proxyMan/
├── main.go                # 后端入口
├── proxy/                 # 代理相关逻辑
├── model/                 # 数据模型
├── cert/                  # 证书生成与管理
├── web/                   # Web 服务
├── frontend/              # 前端项目（Vue3）
│   ├── src/               # 前端源码
│   ├── index.html         # 前端入口
│   ├── package.json       # 前端依赖
├── ca.crt / ca.key        # CA 证书与私钥
├── build.sh               # 构建脚本
```

## 安装与运行

### 后端（Go）
1. 安装 Go 1.18+。
2. 安装依赖：
   ```bash
   go mod tidy
   ```
3. 启动后端服务：
   ```bash
   go run main.go
   ```

### 前端（Vue3）
1. 进入 frontend 目录：
   ```bash
   cd frontend
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 证书说明
- 默认使用自签名 CA（ca.crt/ca.key），如需自定义证书请替换 cert/ 相关文件。

## 主要功能
- HTTP/HTTPS 代理流量捕获与分析
- 请求列表与详情展示
- 支持 AI 相关请求识别与展示
- WebSocket 实时通信

## 贡献指南
欢迎提交 Issue 或 PR，建议遵循主流 Go/Vue 项目规范。

## License
MIT

