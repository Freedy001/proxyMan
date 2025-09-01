# ProxyMan API 文档

## 概述

ProxyMan 的 API 主要通过 WebSocket 进行实时通信，而不是传统的 RESTful API。API 分为两个主要部分：
1.  **请求摘要监控**: 一个 WebSocket 端点，用于实时广播所有代理请求的轻量级摘要信息。
2.  **请求详情查看**: 一个 WebSocket 端点，用于根据请求 ID 流式传输特定请求的完整数据（包括头和体）。

本文档将重点介绍"请求详情查看"接口。

---

## 请求摘要监控 (Request Summary Monitoring)

此接口用于实时监控所有通过代理的HTTP/HTTPS请求的摘要信息。

- **Endpoint**: `/ws`
- **Protocol**: WebSocket (WSS/WS)
- **功能**: 当客户端连接到此端点时，服务器会实时广播所有代理请求的轻量级摘要信息。每当有新的请求开始或完成时，相应的摘要数据会立即推送给所有连接的客户端。

### 数据流 (Data Flow)

1. 客户端通过 WebSocket 连接到 `/ws`。
2. 服务器将客户端添加到广播订阅列表中 (`monitorClients`)。
3. 当有新的HTTP/HTTPS请求通过代理时，服务器将请求摘要发送到 `model.SummaryBodyCast` 通道。
4. 服务器通过 `handleMonitorMessages()` 函数监听该通道，并向所有连接的客户端广播请求摘要信息。
5. 客户端实时接收所有代理请求的摘要数据。

### 响应格式 (Response Format)

服务器通过 WebSocket 发送 JSON 格式的请求摘要对象。每个消息都是一个完整的 `RequestSummary` 结构。

#### `RequestSummary` 结构

| 字段名 (`json`) | 类型 | 描述 |
| :--- | :--- | :--- |
| `id` | `number` | 请求的唯一ID，用于后续查看详细信息。 |
| `startTime`| `string` | 请求开始时间 (Go time.Time 格式化的 JSON 时间)。|
| `endTime` | `string` | 请求结束时间 (Go time.Time 格式化的 JSON 时间)。如果请求仍在进行中，此字段可能为空。|
| `status` | `string` | 请求的当前状态 (`started`, `receiving`, `completed`, `error`)。 |
| `method` | `string` | HTTP 请求方法 (e.g., "GET", "POST", "PUT", "DELETE")。 |
| `host` | `string` | 请求的目标主机名。 |
| `url` | `string` | 完整的请求 URL。 |
| `contentType`| `string` | 响应的 Content-Type。如果响应尚未接收，此字段可能为空。 |
| `statusCode`| `number` | HTTP 响应状态码。如果响应尚未接收，此字段可能为 0。 |

### 广播机制详细说明

**实时广播特性**：
1. **通道驱动广播**：使用 `model.SummaryBodyCast` 通道进行异步消息广播
2. **并发安全**：使用 `monitorMutex` 保护客户端连接列表 (`monitorClients`) 的并发访问
3. **多客户端支持**：支持多个客户端同时连接，所有客户端都会收到相同的广播消息
4. **自动连接清理**：客户端断开连接时自动从广播列表中移除，失败连接会被清理

**广播时机**：
- **请求开始时**：当新的HTTP/HTTPS请求到达代理时，发送初始摘要（状态为 `started`）
- **响应接收时**：当从目标服务器接收到响应头时，发送更新的摘要（状态为 `receiving`，包含状态码、Content-Type等）
- **请求完成时**：当请求处理完毕时，发送最终摘要（状态为 `completed`，包含完整的时间信息和最终状态）
- **错误发生时**：当请求处理过程中发生错误时，发送错误状态摘要（状态为 `error`）

**连接管理**：
- **心跳机制**：每30秒发送 Ping 消息，60秒超时设置
- **写入超时**：广播消息时设置10秒写入超时
- **错误处理**：自动清理失败的客户端连接

### 示例通信流 (Example Flow)

客户端连接到 `/ws` 后，会实时收到如下格式的消息：

1. **新请求开始** (状态：started)
   ```json
   {
     "id": 123,
     "startTime": "2024-01-01T10:00:01Z",
     "endTime": "0001-01-01T00:00:00Z",
     "status": "started",
     "method": "GET",
     "host": "api.example.com",
     "url": "https://api.example.com/users",
     "contentType": "",
     "statusCode": 0
   }
   ```

2. **响应接收中** (状态：receiving)
   ```json
   {
     "id": 123,
     "startTime": "2024-01-01T10:00:01Z",
     "endTime": "2024-01-01T10:00:02.500Z",
     "status": "receiving",
     "method": "GET",
     "host": "api.example.com",
     "url": "https://api.example.com/users",
     "contentType": "application/json",
     "statusCode": 200
   }
   ```

3. **请求完成** (状态：completed)
   ```json
   {
     "id": 123,
     "startTime": "2024-01-01T10:00:01Z",
     "endTime": "2024-01-01T10:00:02.500Z",
     "status": "completed",
     "method": "GET",
     "host": "api.example.com",
     "url": "https://api.example.com/users",
     "contentType": "application/json",
     "statusCode": 200
   }
   ```

4. **错误情况** (状态：error)
   ```json
   {
     "id": 124,
     "startTime": "2024-01-01T10:00:05Z",
     "endTime": "2024-01-01T10:00:06Z",
     "status": "error",
     "method": "POST",
     "host": "api.example.com",
     "url": "https://api.example.com/users",
     "contentType": "",
     "statusCode": 0
   }
   ```

**重要说明**：
- 摘要监控接口主要用于获取所有请求的概览信息
- 如需查看特定请求的详细数据（请求头、请求体、响应体等），需要使用请求详情查看接口 (`/ws/details/{id}`)
- 客户端应该根据 `id` 字段将同一请求的多次更新关联起来
- `status` 字段的变化反映了请求的生命周期状态，可能的值包括：`started`, `receiving`, `completed`, `error`
- WebSocket 连接支持 Origin 检查，允许 localhost 变体用于开发环境

---

## 查看请求详情 (View Request Details)

此接口用于获取单个 HTTP/HTTPS 请求的完整生命周期数据。

- **Endpoint**: `/ws/details/{id}`
- **Protocol**: WebSocket (WSS/WS)
- **功能**: 当客户端连接到此端点时，服务器会流式传输与指定 `{id}` 关联的请求的所有捕获数据。数据以分块的形式发送，直到该请求的所有数据（从请求头到响应体）都发送完毕。

### 数据流 (Data Flow)

1.  客户端通过 WebSocket 连接到 `/ws/details/{id}`。
2.  服务器根据 `id` 查找对应的 `DataProxy` 实例。
3.  如果找到，服务器开始通过 `dataProxy.OnData` 方法，按顺序将捕获的数据块发送到客户端。
4.  每个数据块都封装在一个 `DataChunk` 对象中，并以 JSON 格式发送。
5.  数据流包括：请求头 -> 请求体 -> 响应头 -> 响应体 -> 元数据。

### 响应格式 (Response Format)

服务器通过 WebSocket 发送一系列 JSON 对象。每个对象都是一个 `DataChunk` 结构。

#### `DataChunk` 结构

| 字段名 (`json`) | 类型 | 描述 |
| :--- | :--- | :--- |
| `dataType` | `number` | 数据块的类型。它是一个枚举，定义了数据属于请求的哪个部分。 |
| `data` | `string` | **Base64 编码** 的数据内容。解码后才是实际数据。 |
| `finished` | `boolean` | 标志位。`true` 表示这是当前 `dataType` 的最后一个数据块。例如，当接收到 `dataType: 1` (RequestBody) 且 `finished: true` 的消息时，表示请求体已接收完毕。|
| `timestamp` | `string` | 数据块生成时的时间戳 (RFC3339 格式)。 |

#### `dataType` 枚举

| 值 | 常量名 | 描述 |
| :- | :--- | :--- |
| 0 | `RequestHeader` | 数据是请求头。 |
| 1 | `RequestBody` | 数据是请求体的一部分。 |
| 2 | `ResponseHeader`| 数据是响应头。 |
| 3 | `ResponseBody` | 数据是响应体的一部分。 |
| 4 | `Metadata` | 数据是关于请求的最终摘要信息。 |
| 5 | `ERROR` | 表示在处理过程中发生了错误。 |

### 数据结构详解 (Content of `data` field)

`DataChunk` 中 `data` 字段的内容在 **Base64 解码后**，其结构取决于 `dataType` 的值：

- **当 `dataType` 为 `RequestHeader` (0) 或 `ResponseHeader` (2) 时:**
  `data` 是一个标准 `http.Header` 对象的 JSON 序列化形式。
  ```json
  {
    "Content-Type": ["application/json"],
    "User-Agent": ["Mozilla/5.0..."]
  }
  ```

- **当 `dataType` 为 `RequestBody` (1) 或 `ResponseBody` (3) 时:**
  `data` 是原始请求或响应体的一部分（字节流）。如果 `finished` 为 `false`，则客户端需要拼接这些数据块以重构完整的 body。

- **当 `dataType` 为 `Metadata` (4) 时:**
  `data` 是一个 `RequestSummary` 对象的 JSON 序列化形式，包含了该请求的最终统计信息。
  
  **`RequestSummary` 结构:**
  | 字段名 (`json`) | 类型 | 描述 |
  | :--- | :--- | :--- |
  | `id` | `number` | 请求的唯一ID。 |
  | `startTime`| `string` | 请求开始时间 (RFC3339)。|
  | `endTime` | `string` | 请求结束时间 (RFC3339)。|
  | `status` | `string` | 请求的最终状态 (`completed`, `error` 等)。 |
  | `method` | `string` | HTTP 请求方法 (e.g., "GET", "POST")。 |
  | `host` | `string` | 请求的目标主机名。 |
  | `url` | `string` | 完整的请求 URL。 |
  | `contentType`| `string` | 响应的 Content-Type。 |
  | `statusCode`| `number` | HTTP 响应状态码。 |

- **当 `dataType` 为 `ERROR` (5) 时:**
  `data` 是一个描述错误的字符串。

## 数据分块机制详细说明

### 为什么需要分块传输

ProxyMan 的数据分块机制是为了解决以下核心问题：

1. **实时性要求**：在代理过程中，请求和响应数据是流式产生的，需要边接收边传输，而不是等待完整数据后再发送
2. **内存效率**：大文件或长连接的数据量可能很大，分块传输避免了在内存中缓存完整数据
3. **并发处理**：支持多个请求的数据同时流式传输，每个请求独立处理
4. **错误恢复**：分块机制使得部分数据传输失败时，只需重传失败的块，而不是整个数据

### 分块策略和大小

**分块产生机制**：
- **实时分块**：数据在代理过程中以实际接收到的网络包大小进行分块，没有固定的块大小
- **顺序保证**：每种 `dataType` 的数据块严格按照接收顺序发送
- **完整性标识**：每种 `dataType` 最后一个数据块的 `finished` 字段设为 `true`

**分块控制逻辑**：

### 数据顺序保证

**严格顺序机制**：
1. **状态机控制**：使用状态机确保数据按照 RequestHeader → RequestBody → ResponseHeader → ResponseBody → Metadata 的顺序发送
2. **条件变量同步**：使用 `sync.Cond` 确保状态转换的原子性
3. **链表存储**：使用 `container/list` 保持数据块的接收顺序


### 示例通信流 (Example Flow)

客户端连接到 `/ws/details/123` 后，会按照以下严格顺序收到消息：

1.  **接收请求头**
    ```json
    { "dataType": 0, "data": "eyJVc2VyLUFnZW50IjogWyJjdXJsLzcuNjQuMSJdfQ==", "finished": true, "timestamp": "2024-01-01T10:00:01Z" }
    ```
    (`data` 解码后: `{"User-Agent": ["curl/7.64.1"]}`)

2.  **接收请求体 (可能多个分块)**
    ```json
    { "dataType": 1, "data": "eyJrZXkiOiJ2YWx1ZTEifQ==", "finished": false, "timestamp": "2024-01-01T10:00:01.100Z" }
    ```
    (`data` 解码后: `{"key":"value1"}`)
    ```json
    { "dataType": 1, "data": "eyJrZXkyIjoidmFsdWUyIn0=", "finished": false, "timestamp": "2024-01-01T10:00:01.150Z" }
    ```
    (`data` 解码后: `,"key2":"value2"}`)
    ```json
    { "dataType": 1, "data": "", "finished": true, "timestamp": "2024-01-01T10:00:01.200Z" }
    ```
    (请求体接收完毕，需要将所有分块拼接: `{"key":"value1","key2":"value2"}`)

3.  **接收响应头**
    ```json
    { "dataType": 2, "data": "eyJDb250ZW50LVR5cGUiOiBbImFwcGxpY2F0aW9uL2pzb24iXX0=", "finished": true, "timestamp": "2024-01-01T10:00:02Z" }
    ```
    (`data` 解码后: `{"Content-Type": ["application/json"]}`)

4.  **接收响应体**
    ```json
    { "dataType": 3, "data": "eyJyZXNwb25zZSI6Im9rIn0=", "finished": true, "timestamp": "2024-01-01T10:00:02.500Z" }
    ```
    (`data` 解码后: `{"response":"ok"}`)

5.  **接收元数据**
    ```json
    { "dataType": 4, "data": "eyJpZCI6MTIzLCJzdGFydFRpbWUiOiIyMDI0LTAxLTAxVDEwOjAwOjAxWiIsImVuZFRpbWUiOiIyMDI0LTAxLTAxVDEwOjAwOjAyLjUwMFoiLCJzdGF0dXMiOiJjb21wbGV0ZWQiLCJtZXRob2QiOiJQT1NUIn0=", "finished": true, "timestamp": "2024-01-01T10:00:02.600Z" }
    ```
    (`data` 解码后是完整的 `RequestSummary` JSON)

**重要说明**：
- 所有数据必须按照上述顺序接收处理
- 每种 `dataType` 只有最后一个消息的 `finished` 为 `true`
- 同一 `dataType` 的多个分块需要按接收顺序拼接
- Base64 解码失败时应该记录错误但继续处理后续消息
