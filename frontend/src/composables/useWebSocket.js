import {onUnmounted, ref} from 'vue'

export function useWebSocket() {
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const error = ref(null)

  let ws = null
  let reconnectTimeout = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  const reconnectDelay = 1000

  const connect = (url, onMessage, onError, needReconnect) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return
    }

    isConnecting.value = true
    error.value = null

    try {
      ws = new WebSocket(url)

      ws.onopen = () => {
        isConnected.value = true
        isConnecting.value = false
        reconnectAttempts = 0
        console.log(`Connected to ${url}`)
      }

      ws.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data))
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
          if (onError) onError(err)
        }
      }

      ws.onclose = (event) => {
        isConnected.value = false
        isConnecting.value = false
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)

        if (needReconnect && !event.wasClean && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`)

          reconnectTimeout = setTimeout(() => {
            connect(url, onMessage, onError)
          }, reconnectDelay * reconnectAttempts)
        }
      }

      ws.onerror = (err) => {
        error.value = 'WebSocket connection failed'
        isConnecting.value = false
        console.error('WebSocket error:', err)
        if (onError) onError(err)
      }

    } catch (err) {
      error.value = 'Failed to create WebSocket connection'
      isConnecting.value = false
      console.error('WebSocket creation error:', err)
      if (onError) onError(err)
    }
  }

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    if (ws) {
      ws.close(1000, 'Client disconnect')
      ws = null
    }

    isConnected.value = false
    isConnecting.value = false
    reconnectAttempts = 0
  }

  const send = (data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    send
  }
}