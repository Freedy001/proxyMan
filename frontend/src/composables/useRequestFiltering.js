import { ref, computed } from 'vue'

export function useRequestFiltering(requests) {
  const searchQuery = ref('')
  const statusFilter = ref('all')
  const contentTypeFilter = ref('all')

  const filteredRequests = computed(() => {
    let filtered = requests.value

    // Status filter
    if (statusFilter.value !== 'all') {
      const statusRange = statusFilter.value
      filtered = filtered.filter(request => {
        const status = request.statusCode
        if (statusRange === '2xx') return status >= 200 && status < 300
        if (statusRange === '3xx') return status >= 300 && status < 400
        if (statusRange === '4xx') return status >= 400 && status < 500
        if (statusRange === '5xx') return status >= 500 && status < 600
        return true
      })
    }

    // Content type filter
    if (contentTypeFilter.value !== 'all') {
      filtered = filtered.filter(request => {
        const contentType = request.contentType?.toLowerCase() || ''
        
        switch (contentTypeFilter.value) {
          case 'json':
            return contentType.includes('application/json')
          case 'html':
            return contentType.includes('text/html')
          case 'image':
            return contentType.startsWith('image/')
          case 'css':
            return contentType.includes('text/css')
          case 'js':
            return contentType.includes('javascript') || contentType.includes('application/javascript')
          default:
            return true
        }
      })
    }

    // Search filter
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.trim().toLowerCase()
      
      filtered = filtered.filter(request => {
        // Parse advanced search syntax
        if (query.includes(':')) {
          const parts = query.split(' ')
          
          for (const part of parts) {
            if (part.includes(':')) {
              const [key, value] = part.split(':')
              
              switch (key.toLowerCase()) {
                case 'method':
                  if (!request.method.toLowerCase().includes(value.toLowerCase())) {
                    return false
                  }
                  break
                case 'status':
                  if (!request.statusCode.toString().includes(value)) {
                    return false
                  }
                  break
                case 'domain':
                case 'host':
                  if (!request.host.toLowerCase().includes(value.toLowerCase())) {
                    return false
                  }
                  break
                case 'url':
                  if (!request.url.toLowerCase().includes(value.toLowerCase())) {
                    return false
                  }
                  break
                case 'type':
                  if (!request.contentType?.toLowerCase().includes(value.toLowerCase())) {
                    return false
                  }
                  break
              }
            } else {
              // Simple text search in URL, host, method
              const searchText = part.toLowerCase()
              if (
                !request.url.toLowerCase().includes(searchText) &&
                !request.host.toLowerCase().includes(searchText) &&
                !request.method.toLowerCase().includes(searchText)
              ) {
                return false
              }
            }
          }
          return true
        } else {
          // Simple text search
          return (
            request.url.toLowerCase().includes(query) ||
            request.host.toLowerCase().includes(query) ||
            request.method.toLowerCase().includes(query) ||
            request.statusCode.toString().includes(query)
          )
        }
      })
    }

    return filtered
  })

  const setSearchQuery = (query) => {
    searchQuery.value = query
  }

  const setStatusFilter = (filter) => {
    statusFilter.value = filter
  }

  const setContentTypeFilter = (filter) => {
    contentTypeFilter.value = filter
  }

  const clearFilters = () => {
    searchQuery.value = ''
    statusFilter.value = 'all'
    contentTypeFilter.value = 'all'
  }

  return {
    searchQuery,
    statusFilter,
    contentTypeFilter,
    filteredRequests,
    setSearchQuery,
    setStatusFilter,
    setContentTypeFilter,
    clearFilters
  }
}