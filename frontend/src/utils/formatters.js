export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDuration = (ms) => {
  if (ms < 1000) {
    return `${ms}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`
  } else {
    const minutes = Math.floor(ms / 60000)
    const seconds = ((ms % 60000) / 1000).toFixed(0)
    return `${minutes}:${seconds.padStart(2, '0')}`
  }
}

export const formatTime = (timestamp) => {
  if (!timestamp) return ''
  
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  } catch (e) {
    return ''
  }
}

export const formatJson = (obj, indent = 2) => {
  try {
    return JSON.stringify(obj, null, indent)
  } catch (e) {
    return String(obj)
  }
}

export const parseJson = (str) => {
  try {
    return JSON.parse(str)
  } catch (e) {
    return null
  }
}

export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export const getFileExtension = (url) => {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('.')
    return parts.length > 1 ? parts.pop().toLowerCase() : ''
  } catch (e) {
    return ''
  }
}

export const getContentTypeCategory = (contentType) => {
  if (!contentType) return 'unknown'
  
  const type = contentType.toLowerCase()
  
  if (type.includes('application/json')) return 'json'
  if (type.includes('text/html')) return 'html'
  if (type.includes('text/css')) return 'css'
  if (type.includes('javascript')) return 'js'
  if (type.includes('text/xml') || type.includes('application/xml')) return 'xml'
  if (type.startsWith('image/')) return 'image'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  if (type.includes('application/pdf')) return 'pdf'
  if (type.startsWith('text/')) return 'text'
  
  return 'binary'
}

export const isTextContent = (contentType) => {
  if (!contentType) return false
  
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/xhtml+xml'
  ]
  
  return textTypes.some(type => contentType.toLowerCase().includes(type))
}

export const formatContentType = (contentType) => {
  if (!contentType) return 'UNKNOWN'
  
  // Extract main type
  const mainType = contentType.split('/')[1]?.split(';')[0]
  if (mainType) {
    return mainType.toUpperCase()
  }
  
  // Fallback to first part
  const firstPart = contentType.split('/')[0]
  return firstPart ? firstPart.toUpperCase() : 'UNKNOWN'
}

export const getStatusCategory = (statusCode) => {
  if (!statusCode) return 'unknown'
  
  if (statusCode >= 100 && statusCode < 200) return '1xx'
  if (statusCode >= 200 && statusCode < 300) return '2xx'
  if (statusCode >= 300 && statusCode < 400) return '3xx'
  if (statusCode >= 400 && statusCode < 500) return '4xx'
  if (statusCode >= 500) return '5xx'
  
  return 'unknown'
}

export const getStatusText = (statusCode) => {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
  
  return statusTexts[statusCode] || ''
}

export const highlightText = (text, query) => {
  if (!query || !text) return text
  
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  return text.replace(regex, '<span class="search-highlight">$1</span>')
}

export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export const throttle = (func, limit) => {
  let inThrottle
  return function() {
    const args = arguments
    const context = this
    if (!inThrottle) {
      func.apply(context, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}