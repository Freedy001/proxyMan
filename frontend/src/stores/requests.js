import { defineStore } from 'pinia'
import { computed, ref, onUnmounted } from 'vue'
import { WebSocketManager } from '../composables/WebSocket'
import { RequestFilteringManager } from '../composables/RequestFiltering'

export const useRequestsStore = defineStore('requests', () => {
  // State
  const requests = ref([])
  const selectedRequestId = ref(null)
  const sortColumn = ref('id')
  const sortOrder = ref('desc')
  
  // Managers
  const wsManager = new WebSocketManager()
  const filterManager = new RequestFilteringManager(requests)
  
  // Cleanup on unmount
  onUnmounted(() => {
    wsManager.disconnect()
  })

  // Computed properties
  const selectedRequest = computed(() => {
    return requests.value.find(req => req.id === selectedRequestId.value) || null
  })

  const sortedAndFilteredRequests = computed(() => {
    // Use slice() for better performance with large arrays
    const filtered = filterManager.filteredRequests.value.slice()
    return filtered.sort((a, b) => {
      const aVal = a[sortColumn.value]
      const bVal = b[sortColumn.value]

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return sortOrder.value === 'asc' ? -1 : 1
      if (bVal == null) return sortOrder.value === 'asc' ? 1 : -1

      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
  })

  const requestCount = computed(() => requests.value.length)

  // WebSocket connection handlers
  const connect = () => {
    wsManager.connect('/requests', handleRequestSummary, handleConnectionError, true)
  }

  const disconnect = () => {
    wsManager.disconnect()
  }

  // Handle incoming request summaries from WebSocket
  const handleRequestSummary = (summary) => {
    // Validate incoming data
    if (!summary || !summary.id) {
      console.warn('Invalid request summary received:', summary)
      return
    }

    const existingIndex = requests.value.findIndex(req => req.id === summary.id)

    if (existingIndex >= 0) {
      // Update existing request with new data
      const updatedRequest = {
        ...requests.value[existingIndex],
        ...summary,
        duration: calculateDuration(summary.startTime, summary.endTime)
      }
      requests.value.splice(existingIndex, 1, updatedRequest)
    } else {
      // Add new request to the beginning of the list
      const newRequest = {
        ...summary,
        duration: calculateDuration(summary.startTime, summary.endTime),
        isNew: true
      }
      
      requests.value.unshift(newRequest)

      // Remove "new" flag after animation completes
      setTimeout(() => {
        const index = requests.value.findIndex(req => req.id === summary.id)
        if (index >= 0) {
          requests.value[index].isNew = false
        }
      }, 500)
    }
    
    // Limit the number of requests to prevent memory issues
    if (requests.value.length > 10000) {
      requests.value.splice(5000) // Remove older requests
    }
  }

  const handleConnectionError = (error) => {
    console.error('WebSocket connection error:', error)
  }

  // Utility function to calculate request duration
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null

    try {
      const start = new Date(startTime)
      const end = new Date(endTime)
      
      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null
      }
      
      const duration = end - start

      if (duration < 1000) {
        return `${duration}ms`
      } else {
        return `${(duration / 1000).toFixed(2)}s`
      }
    } catch (e) {
      console.error('Error calculating duration:', e)
      return null
    }
  }

  // Action methods
  const selectRequest = (requestId) => {
    selectedRequestId.value = requestId
  }

  const clearRequests = () => {
    requests.value = []
    selectedRequestId.value = null
  }

  const setSorting = (column) => {
    if (sortColumn.value === column) {
      // Toggle sort order
      if (sortOrder.value === 'desc') {
        sortOrder.value = 'asc'
      } else {
        // Reset to default sorting
        sortColumn.value = 'id'
        sortOrder.value = 'desc'
      }
    } else {
      // Set new sort column
      sortColumn.value = column
      sortOrder.value = 'desc'
    }
  }

  // Utility methods for UI styling
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
      // Validate date
      if (isNaN(date.getTime())) {
        return ''
      }
      
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (e) {
      console.error('Error formatting time:', e)
      return ''
    }
  }

  // Return store interface
  return {
    // State
    requests,
    selectedRequestId,
    sortColumn,
    sortOrder,

    // Computed properties
    selectedRequest,
    sortedAndFilteredRequests,
    requestCount,
    isConnected: wsManager.isConnected,
    isConnecting: wsManager.isConnecting,
    connectionError: wsManager.error,

    // Filtering
    searchQuery: filterManager.getSearchQuery(),
    statusFilter: filterManager.getStatusFilter(),
    contentTypeFilter: filterManager.getContentTypeFilter(),
    setSearchQuery: filterManager.setSearchQuery.bind(filterManager),
    setStatusFilter: filterManager.setStatusFilter.bind(filterManager),
    setContentTypeFilter: filterManager.setContentTypeFilter.bind(filterManager),
    clearFilters: filterManager.clearFilters.bind(filterManager),

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