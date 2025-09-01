import { ref } from 'vue'
import { useWebSocket } from './useWebSocket'

export function useRequestDetails() {
  const currentRequest = ref(null)
  const requestHeaders = ref({})
  const responseHeaders = ref({})
  const requestBody = ref('')
  const responseBody = ref('')
  const metadata = ref({})
  const isLoading = ref(false)
  const error = ref(null)

  const { connect: connectWS, disconnect: disconnectWS } = useWebSocket()
  let currentRequestId = null

  const loadRequestDetails = (requestId) => {
    console.log('loadRequestDetails called with:', requestId, 'current:', currentRequestId)
    if (currentRequestId === requestId) return

    // Reset state
    requestHeaders.value = {}
    responseHeaders.value = {}
    requestBody.value = ''
    responseBody.value = ''
    metadata.value = {}
    error.value = null
    isLoading.value = true
    console.log('loadRequestDetails - set isLoading to true')

    currentRequestId = requestId

    // Connect to WebSocket for request details
    const wsUrl = `ws://localhost:8080/ws/details/${requestId}`
    console.log('loadRequestDetails - connecting to WebSocket:', wsUrl)
    
    connectWS(wsUrl, handleDataChunk, handleError)
  }

  const handleDataChunk = (chunk) => {
    try {
      console.log('handleDataChunk - Received data chunk:', chunk)
      console.log('handleDataChunk - isLoading before processing:', isLoading.value)
      const { dataType, data, finished, timestamp } = chunk
      
      // Set loading to false once we receive the first chunk
      if (isLoading.value) {
        console.log('handleDataChunk - setting isLoading to false')
        isLoading.value = false
        console.log('handleDataChunk - isLoading after setting to false:', isLoading.value)
      }
      
      // Decode base64 data
      let decodedData = ''
      if (data) {
        try {
          decodedData = atob(data)
        } catch (e) {
          console.error('Failed to decode base64 data:', e)
          // Continue processing even if decode fails
          decodedData = data
        }
      }

      console.log(`Processing dataType ${dataType}, finished: ${finished}, data length: ${decodedData.length}`)

      switch (dataType) {
        case 0: // RequestHeader
          if (decodedData) {
            try {
              requestHeaders.value = JSON.parse(decodedData)
              console.log('Request headers set:', requestHeaders.value)
            } catch (e) {
              console.error('Failed to parse request headers:', e)
              requestHeaders.value = { raw: decodedData }
            }
          }
          break

        case 1: // RequestBody
          // Append chunk to request body
          requestBody.value += decodedData
          console.log('Request body updated, total length:', requestBody.value.length)
          break

        case 2: // ResponseHeader
          if (decodedData) {
            try {
              responseHeaders.value = JSON.parse(decodedData)
              console.log('Response headers set:', responseHeaders.value)
            } catch (e) {
              console.error('Failed to parse response headers:', e)
              responseHeaders.value = { raw: decodedData }
            }
          }
          break

        case 3: // ResponseBody
          // Append chunk to response body
          responseBody.value += decodedData
          console.log('Response body updated, total length:', responseBody.value.length)
          break

        case 4: // Metadata
          if (decodedData) {
            try {
              metadata.value = JSON.parse(decodedData)
              console.log('Metadata set:', metadata.value)
            } catch (e) {
              console.error('Failed to parse metadata:', e)
              metadata.value = { raw: decodedData }
            }
          }
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
    metadata.value = {}
    error.value = null
    isLoading.value = false
    currentRequestId = null
    disconnectWS()
  }

  const formatJson = (obj) => {
    try {
      return JSON.stringify(obj, null, 2)
    } catch (e) {
      return String(obj)
    }
  }

  const isJsonContent = (contentType) => {
    return contentType && contentType.toLowerCase().includes('application/json')
  }

  const formatBody = (body, contentType) => {
    if (!body) return 'No content'
    
    if (isJsonContent(contentType)) {
      try {
        const parsed = JSON.parse(body)
        return JSON.stringify(parsed, null, 2)
      } catch (e) {
        return body
      }
    }
    
    return body
  }

  return {
    currentRequest,
    requestHeaders,
    responseHeaders,
    requestBody,
    responseBody,
    metadata,
    isLoading,
    error,
    loadRequestDetails,
    clearDetails,
    formatJson,
    formatBody,
    isJsonContent
  }
}