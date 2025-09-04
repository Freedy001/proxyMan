import {ref} from 'vue'
import {useWebSocket} from './useWebSocket'

export function useRequestDetails() {
  const currentRequest = ref(null)
  const requestHeaders = ref({})
  const responseHeaders = ref({})
  const requestBody = ref('')
  const responseBody = ref('')
  const requestState = ref(-1)
  const isLoading = ref(false)
  const error = ref(null)

  const {connect: connectWS, disconnect: disconnectWS} = useWebSocket()
  let currentRequestId = null

  const loadRequestDetails = (requestId) => {
    if (currentRequestId === requestId) return

    // Reset state
    requestHeaders.value = {}
    responseHeaders.value = {}
    requestBody.value = ''
    responseBody.value = ''
    error.value = null
    requestState.value = -1
    isLoading.value = true
    currentRequestId = requestId

    // Connect to WebSocket for request details
    connectWS(`/ws/details/${requestId}`, handleDataChunk, handleError)
  }

  const handleDataChunk = (chunk) => {
    try {
      const {dataType, data, finished} = chunk

      // Set loading to false once we receive the first chunk
      if (isLoading.value) {
        isLoading.value = false
      }

      // Decode base64 data intelligently with UTF-8 support
      let decodedData = ''
      if (data) {
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
          decodedData = decoder.decode(bytes)
        } catch (e) {
          console.error('Failed to decode base64 data:', e)
          // Fallback to simple atob
          try {
            decodedData = atob(data)
          } catch (e2) {
            // If both fail, use raw data
            decodedData = data
          }
        }
      }

      switch (dataType) {
        case 0: // RequestHeader
          if (decodedData) {
            try {
              requestHeaders.value = JSON.parse(decodedData)
            } catch (e) {
              console.error('Failed to parse request headers:', e)
              requestHeaders.value = {raw: decodedData}
            }
            requestState.value = 0
          }
          break
        case 1: // RequestBody
          // Append chunk to request body
          requestBody.value += decodedData
          if (finished) {
            requestState.value = 1
          }
          break
        case 2: // ResponseHeader
          if (decodedData) {
            try {
              responseHeaders.value = JSON.parse(decodedData)
            } catch (e) {
              console.error('Failed to parse response headers:', e)
              responseHeaders.value = {raw: decodedData}
            }
            requestState.value = 2
          }
          break
        case 3: // ResponseBody
          responseBody.value += decodedData
          if (finished) {
            requestState.value = 3
          }
          break
        case 4: // Metadata
          //ignore
          break
        case 5: // ERROR
          error.value = decodedData || 'Unknown error occurred'
          console.error('Received error:', error.value)
          break
        default:
          console.warn('Unknown data type:', dataType)
      }
    } catch (e) {
      console.error('Error processing data chunk:', e)
      error.value = 'Failed to process request data'
      isLoading.value = false
    }
  }

  const handleError = (err) => {
    error.value = 'Failed to load request details'
    isLoading.value = false
    console.error('Request details error:', err)
  }

  const clearDetails = () => {
    currentRequest.value = null
    requestHeaders.value = {}
    responseHeaders.value = {}
    requestBody.value = ''
    responseBody.value = ''
    error.value = null
    requestState.value = -1
    isLoading.value = false
    currentRequestId = null
    disconnectWS()
  }


  return {
    currentRequest,
    requestHeaders,
    responseHeaders,
    requestBody,
    responseBody,
    requestState,
    isLoading,
    error,
    loadRequestDetails,
    clearDetails
  }
}