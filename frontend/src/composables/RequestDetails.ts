import {ref, onUnmounted, type Ref} from 'vue'
import {WebSocketManager} from './WebSocket.ts'

export interface Headers {
  [key: string]: string | string[]
}

export interface DataChunk {
  dataType: number
  data?: string
  finished?: boolean
}

export class RequestDetailsManager {
  private wsManager: WebSocketManager
  private currentRequestId: string | null = null

  // State refs
  private readonly requestHeaders: Ref<Headers>
  private readonly responseHeaders: Ref<Headers>
  private readonly requestBody: Ref<string>
  private readonly responseBody: Ref<string>
  private readonly requestState: Ref<number>
  private readonly isLoading: Ref<boolean>
  private readonly error: Ref<string | null>

  constructor() {
    this.wsManager = new WebSocketManager()

    // Initialize reactive state
    this.requestHeaders = ref({})
    this.responseHeaders = ref({})
    this.requestBody = ref('')
    this.responseBody = ref('')
    this.requestState = ref(-1)
    this.isLoading = ref(false)
    this.error = ref(null)

    // Cleanup on unmount
    onUnmounted(() => {
      this.disconnect()
    })
  }

  public loadRequestDetails(requestId: string): void {
    if (this.currentRequestId === requestId) return

    // Reset state
    this.resetState()
    this.currentRequestId = requestId
    this.isLoading.value = true

    // Connect to WebSocket for request details
    this.wsManager.connect(
      `/ws/details/${requestId}`,
      this.handleDataChunk.bind(this),
      this.handleError.bind(this)
    )
  }

  private resetState(): void {
    this.requestHeaders.value = {}
    this.responseHeaders.value = {}
    this.requestBody.value = ''
    this.responseBody.value = ''
    this.error.value = null
    this.requestState.value = -1
    this.isLoading.value = false
  }

  private handleDataChunk(chunk: DataChunk): void {
    try {
      const {dataType, data, finished} = chunk

      // Set loading to false once we receive the first chunk
      if (this.isLoading.value) {
        this.isLoading.value = false
      }

      // Decode base64 data intelligently with UTF-8 support
      const decodedData = data ? this.decodeBase64Data(data) : ''

      this.processDataType(dataType, decodedData, finished)
    } catch (e) {
      console.error('Error processing data chunk:', e)
      this.error.value = 'Failed to process request data'
      this.isLoading.value = false
    }
  }

  private decodeBase64Data(data: string): string {
    try {
      // Always decode from base64 first (server sends all data as base64)
      const binaryString = atob(data)
      // Convert binary string to Uint8Array
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      // Use TextDecoder to properly decode UTF-8
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(bytes)
    } catch (e) {
      console.error('Failed to decode base64 data:', e)
      // Fallback to simple atob
      try {
        return atob(data)
      } catch (e2) {
        // If both fail, use raw data
        return data
      }
    }
  }

  private processDataType(dataType: number, decodedData: string, finished?: boolean): void {
    switch (dataType) {
      case 0: // RequestHeader
        if (decodedData) {
          try {
            this.requestHeaders.value = JSON.parse(decodedData)
          } catch (e) {
            console.error('Failed to parse request headers:', e)
            this.requestHeaders.value = {raw: decodedData}
          }
          this.requestState.value = 0
        }
        break
      case 1: // RequestBody
              // Append chunk to request body
        this.requestBody.value += decodedData
        if (finished) {
          this.requestState.value = 1
        }
        break
      case 2: // ResponseHeader
        if (decodedData) {
          try {
            this.responseHeaders.value = JSON.parse(decodedData)
          } catch (e) {
            console.error('Failed to parse response headers:', e)
            this.responseHeaders.value = {raw: decodedData}
          }
          this.requestState.value = 2
        }
        break
      case 3: // ResponseBody
        this.responseBody.value += decodedData
        if (finished) {
          this.requestState.value = 3
        }
        break
      case 4: // Metadata
              // ignore
        break
      case 5: // ERROR
        this.error.value = decodedData || 'Unknown error occurred'
        console.error('Received error:', this.error.value)
        break
      default:
        console.warn('Unknown data type:', dataType)
    }
  }

  private handleError(err: Error): void {
    this.error.value = 'Failed to load request details'
    this.isLoading.value = false
    console.error('Request details error:', err)
  }

  public clearDetails(): void {
    this.resetState()
    this.currentRequestId = null
    this.disconnect()
  }

  public disconnect(): void {
    this.wsManager.disconnect()
  }

  public getRequestHeaders(): Ref<Headers> {
    return this.requestHeaders
  }

  public getResponseHeaders(): Ref<Headers> {
    return this.responseHeaders
  }

  public getRequestBody(): Ref<string> {
    return this.requestBody
  }

  public getResponseBody(): Ref<string> {
    return this.responseBody
  }

  public getRequestState(): Ref<number> {
    return this.requestState
  }

  public getIsLoading(): Ref<boolean> {
    return this.isLoading
  }

  public getError(): Ref<string | null> {
    return this.error
  }
}

