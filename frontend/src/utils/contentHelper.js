export function getContentType(headers) {
  if (!headers || typeof headers !== 'object') return null

  const contentType = headers['content-type'] || headers['Content-Type']

  // 处理字符串值
  if (typeof contentType === 'string') {
    return contentType
  }

  // 处理数组值：取第一个非空元素
  if (Array.isArray(contentType) && contentType.length > 0) {
    const firstValue = contentType.find(value =>
        typeof value === 'string' && value.trim().length > 0
    )
    return firstValue || null
  }

  // 默认返回值
  return null
}