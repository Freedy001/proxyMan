import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface Request {
  id: string
  method: string
  url: string
  host: string
  statusCode: number
  contentType?: string
  [key: string]: any
}

export class RequestFilteringManager {
  private readonly requests: Ref<Request[]>
  private readonly searchQuery: Ref<string>
  private readonly statusFilter: Ref<string>
  private readonly contentTypeFilter: Ref<string>

  constructor(requests: Ref<Request[]>) {
    this.requests = requests
    this.searchQuery = ref('')
    this.statusFilter = ref('all')
    this.contentTypeFilter = ref('all')
  }

  public get filteredRequests(): ComputedRef<Request[]> {
    return computed(() => {
      let filtered = this.requests.value

      // Status filter
      if (this.statusFilter.value !== 'all') {
        const statusRange = this.statusFilter.value
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
      if (this.contentTypeFilter.value !== 'all') {
        filtered = filtered.filter(request => {
          const contentType = request.contentType?.toLowerCase() || ''
          
          switch (this.contentTypeFilter.value) {
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
            case 'event-stream':
              return contentType.includes('event-stream')
            default:
              return true
          }
        })
      }

      // Search filter
      if (this.searchQuery.value.trim()) {
        const query = this.searchQuery.value.trim().toLowerCase()
        
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
  }

  public getSearchQuery(): Ref<string> {
    return this.searchQuery
  }

  public getStatusFilter(): Ref<string> {
    return this.statusFilter
  }

  public getContentTypeFilter(): Ref<string> {
    return this.contentTypeFilter
  }

  public setSearchQuery(query: string): void {
    this.searchQuery.value = query
  }

  public setStatusFilter(filter: string): void {
    this.statusFilter.value = filter
  }

  public setContentTypeFilter(filter: string): void {
    this.contentTypeFilter.value = filter
  }

  public clearFilters(): void {
    this.searchQuery.value = ''
    this.statusFilter.value = 'all'
    this.contentTypeFilter.value = 'all'
  }
}
