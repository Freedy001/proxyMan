export const WebSocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}

export const createWebSocketURL = (path, protocol = 'ws') => {
  const host = window.location.hostname
  const port = window.location.hostname === 'localhost' ? '8080' : window.location.port
  return `${protocol}://${host}:${port}${path}`
}

export const isWebSocketSupported = () => {
  return 'WebSocket' in window || 'MozWebSocket' in window
}

export const getWebSocketCloseReason = (code) => {
  const reasons = {
    1000: 'Normal Closure',
    1001: 'Going Away',
    1002: 'Protocol Error',
    1003: 'Unsupported Data',
    1004: 'Reserved',
    1005: 'No Status Received',
    1006: 'Abnormal Closure',
    1007: 'Invalid frame payload data',
    1008: 'Policy Violation',
    1009: 'Message too big',
    1010: 'Missing Extension',
    1011: 'Internal Error',
    1012: 'Service Restart',
    1013: 'Try Again Later',
    1014: 'Bad Gateway',
    1015: 'TLS Handshake'
  }
  
  return reasons[code] || `Unknown (${code})`
}

export const parseWebSocketMessage = (event) => {
  try {
    return JSON.parse(event.data)
  } catch (error) {
    console.error('Failed to parse WebSocket message:', error)
    return null
  }
}

export const createReconnectDelay = (attempt, baseDelay = 1000, maxDelay = 30000) => {
  // Exponential backoff with jitter
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  const jitter = delay * 0.1 * Math.random()
  return delay + jitter
}

export const validateWebSocketURL = (url) => {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:'
  } catch (error) {
    return false
  }
}

export class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url
    this.options = {
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      enableHeartbeat: true,
      enableReconnect: true,
      ...options
    }
    
    this.ws = null
    this.reconnectAttempts = 0
    this.reconnectTimeout = null
    this.heartbeatTimeout = null
    this.isIntentionallyClosed = false
    
    this.onOpen = null
    this.onMessage = null
    this.onClose = null
    this.onError = null
    this.onReconnect = null
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    this.isIntentionallyClosed = false
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = (event) => {
          this.reconnectAttempts = 0
          this.clearReconnectTimeout()
          
          if (this.options.enableHeartbeat) {
            this.startHeartbeat()
          }
          
          if (this.onOpen) {
            this.onOpen(event)
          }
          
          resolve(event)
        }

        this.ws.onmessage = (event) => {
          if (this.onMessage) {
            this.onMessage(event)
          }
        }

        this.ws.onclose = (event) => {
          this.clearHeartbeat()
          
          if (this.onClose) {
            this.onClose(event)
          }
          
          if (!this.isIntentionallyClosed && this.options.enableReconnect) {
            this.attemptReconnect()
          }
        }

        this.ws.onerror = (event) => {
          if (this.onError) {
            this.onError(event)
          }
          reject(event)
        }

      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect() {
    this.isIntentionallyClosed = true
    this.clearReconnectTimeout()
    this.clearHeartbeat()
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }

  getReadyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    const delay = createReconnectDelay(this.reconnectAttempts, this.options.reconnectDelay)
    this.reconnectAttempts++

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts}) in ${delay}ms`)

    this.reconnectTimeout = setTimeout(() => {
      if (this.onReconnect) {
        this.onReconnect(this.reconnectAttempts)
      }
      this.connect().catch(() => {
        // Reconnection failed, will try again
      })
    }, delay)
  }

  startHeartbeat() {
    this.clearHeartbeat()
    
    this.heartbeatTimeout = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' })
      }
    }, this.options.heartbeatInterval)
  }

  clearHeartbeat() {
    if (this.heartbeatTimeout) {
      clearInterval(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
}