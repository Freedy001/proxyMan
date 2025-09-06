import {ref, type Ref} from 'vue'

export class WebSocketManager {
  private ws: WebSocket | null = null

  private readonly maxReconnectAttempts: number = 5
  private readonly reconnectDelay: number = 1000
  private reconnectTimeout: number | null = null
  private reconnectAttempts: number = 0

  public isConnected: Ref<boolean> = ref(false)
  public isConnecting: Ref<boolean> = ref(false)
  public error: Ref<string | null> = ref(null)

  connect(path: string, onMessage: (data: any) => void, onError?: (error: Error) => void, needReconnect: boolean = false): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    this.isConnecting.value = true
    this.error.value = null

    const url = `${window.location.protocol.includes('https') ? 'wss' : 'ws'}://${window.location.host}${path.startsWith('/') ? path : '/' + path}`

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.isConnected.value = true
        this.isConnecting.value = false
        this.reconnectAttempts = 0
        console.log(`Connected to ${url}`)
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)
          onMessage(data)
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
          if (onError) {
            onError(err as Error)
          }
        }
      }

      this.ws.onclose = (event: CloseEvent) => {
        this.isConnected.value = false
        this.isConnecting.value = false
        console.log(`WebSocket closed: ${event.code} ${event.reason}`)

        if (needReconnect && !event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

          this.reconnectTimeout = window.setTimeout(() => {
            this.connect(path, onMessage, onError, needReconnect)
          }, this.reconnectDelay * this.reconnectAttempts)
        }
      }

      this.ws.onerror = (err: Event) => {
        this.error.value = 'WebSocket connection failed'
        this.isConnecting.value = false
        console.error('WebSocket error:', err)
        if (onError) {
          onError(new Error('WebSocket connection failed'))
        }
      }

    } catch (err) {
      this.error.value = 'Failed to create WebSocket connection'
      this.isConnecting.value = false
      console.error('WebSocket creation error:', err)
      if (onError) {
        onError(err as Error)
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.isConnected.value = false
    this.isConnecting.value = false
    this.reconnectAttempts = 0
  }
}
