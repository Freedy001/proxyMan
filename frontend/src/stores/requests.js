import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWebSocket } from '../composables/useWebSocket'
import { useRequestFiltering } from '../composables/useRequestFiltering'

export const useRequestsStore = defineStore('requests', () => {
  const requests = ref([])
  const selectedRequestId = ref(null)
  const sortColumn = ref('id')
  const sortOrder = ref('desc')
  
  const { 
    isConnected, 
    isConnecting, 
    error: connectionError,
    connect: connectWS,
    disconnect: disconnectWS
  } = useWebSocket()

  const {
    searchQuery,
    statusFilter,
    contentTypeFilter,
    filteredRequests,
    setSearchQuery,
    setStatusFilter,
    setContentTypeFilter,
    clearFilters
  } = useRequestFiltering(requests)

  const selectedRequest = computed(() => {
    return requests.value.find(req => req.id === selectedRequestId.value) || null
  })

  const sortedAndFilteredRequests = computed(() => {
    const sorted = [...filteredRequests.value].sort((a, b) => {
      const aVal = a[sortColumn.value]
      const bVal = b[sortColumn.value]
      
      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1
      
      return sortOrder.value === 'asc' ? comparison : -comparison
    })
    
    return sorted
  })

  const requestCount = computed(() => requests.value.length)

  const connect = () => {
    const wsUrl = 'ws://localhost:8080/ws'
    connectWS(wsUrl, handleRequestSummary, handleConnectionError)
  }

  const disconnect = () => {
    disconnectWS()
  }

  const handleRequestSummary = (summary) => {
    const existingIndex = requests.value.findIndex(req => req.id === summary.id)
    
    if (existingIndex >= 0) {
      // Update existing request
      requests.value[existingIndex] = { ...requests.value[existingIndex], ...summary }
    } else {
      // Add new request
      requests.value.unshift({
        ...summary,
        // Add calculated fields
        duration: calculateDuration(summary.startTime, summary.endTime),
        isNew: true
      })
      
      // Remove "new" flag after animation
      setTimeout(() => {
        const newIndex = requests.value.findIndex(req => req.id === summary.id)
        if (newIndex >= 0) {
          requests.value[newIndex].isNew = false
        }
      }, 500)
    }
  }

  const handleConnectionError = (error) => {
    console.error('Connection error:', error)
  }

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null
    
    try {
      const start = new Date(startTime)
      const end = new Date(endTime)
      const duration = end - start
      
      if (duration < 1000) {
        return `${duration}ms`
      } else {
        return `${(duration / 1000).toFixed(2)}s`
      }
    } catch (e) {
      return null
    }
  }

  const selectRequest = (requestId) => {
    selectedRequestId.value = requestId
  }

  const clearRequests = () => {
    requests.value = []
    selectedRequestId.value = null
  }

  const setSorting = (column) => {
    if (sortColumn.value === column) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn.value = column
      sortOrder.value = 'desc'
    }
  }

  const getStatusClass = (statusCode) => {
    if (!statusCode) return ''
    
    if (statusCode >= 100 && statusCode < 200) return 'status-1xx'
    if (statusCode >= 200 && statusCode < 300) return 'status-2xx'
    if (statusCode >= 300 && statusCode < 400) return 'status-3xx'
    if (statusCode >= 400 && statusCode < 500) return 'status-4xx'
    if (statusCode >= 500) return 'status-5xx'
    
    return ''
  }

  const getMethodClass = (method) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'method-get'
      case 'POST': return 'method-post'
      case 'PUT': return 'method-put'
      case 'DELETE': return 'method-delete'
      case 'PATCH': return 'method-patch'
      default: return ''
    }
  }

  const formatContentType = (contentType) => {
    if (!contentType) return ''
    
    const type = contentType.split('/')[1]?.split(';')[0]
    return type?.toUpperCase() || contentType.split('/')[0]?.toUpperCase() || 'UNKNOWN'
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (e) {
      return ''
    }
  }

  return {
    // State
    requests,
    selectedRequestId,
    sortColumn,
    sortOrder,
    
    // Computed
    selectedRequest,
    sortedAndFilteredRequests,
    requestCount,
    isConnected,
    isConnecting,
    connectionError,
    
    // Filtering
    searchQuery,
    statusFilter,
    contentTypeFilter,
    setSearchQuery,
    setStatusFilter,
    setContentTypeFilter,
    clearFilters,
    
    // Actions
    connect,
    disconnect,
    selectRequest,
    clearRequests,
    setSorting,
    
    // Utilities
    getStatusClass,
    getMethodClass,
    formatContentType,
    formatTime
  }
})