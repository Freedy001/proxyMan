/**
 * AI API 检测工具
 * 用于识别和解析大模型 API 请求/响应
 */

// AI API URL 模式
const AI_URL_PATTERNS = [
  // OpenAI API
  /\/v1\/chat\/completions$/,
  /\/chat\/completions$/,
  
  // Anthropic API  
  /\/v1\/messages(\?.*)?$/,
  /\/messages$/,
  
  // 其他常见 AI API
  /\/v1\/completions$/,
  /\/completions$/,
  /\/generate$/,
  /\/inference$/,
  /\/api\/chat$/,
  /\/api\/generate$/
]

/**
 * 检测是否为 AI API 请求
 * @param {string} url - 请求 URL
 * @param {string} method - HTTP 方法
 * @param {Object} headers - 请求头
 * @returns {boolean}
 */
export function isAIRequest(url, method = 'POST', headers = {}) {
  if (!url || method.toUpperCase() !== 'POST') {
    return false
  }

  // 检查 URL 模式
  const urlMatch = AI_URL_PATTERNS.some(pattern => pattern.test(url))
  if (!urlMatch) {
    return false
  }

  // 检查 Content-Type
  const contentType = headers['content-type'] || headers['Content-Type'] || ''
  if (contentType.includes('application/json')) {
    return true
  }

  return urlMatch
}

/**
 * 检测 AI API 类型
 * @param {string} url - 请求 URL
 * @returns {string} 'openai' | 'anthropic' | 'generic'
 */
export function detectAIProvider(url) {
  if (!url) return 'generic'
  
  if (url.includes('/chat/completions')) {
    return 'openai'
  }
  
  if (url.includes('/v1/messages') || url.includes('/messages')) {
    return 'anthropic'
  }
  
  return 'generic'
}

/**
 * 解析 OpenAI 格式的消息
 * @param {Object} data - 请求或响应数据
 * @returns {Object} 解析后的对话数据
 */
export function parseOpenAIMessages(data) {
  try {
    if (typeof data === 'string') {
      data = JSON.parse(data)
    }
    
    // 请求格式
    if (data.messages && Array.isArray(data.messages)) {
      return {
        type: 'request',
        messages: data.messages,
        model: data.model,
        stream: data.stream || false,
        tools: data.tools || data.functions,
        temperature: data.temperature,
        max_tokens: data.max_tokens
      }
    }
    
    // 响应格式
    if (data.choices && Array.isArray(data.choices)) {
      return {
        type: 'response',
        choices: data.choices,
        model: data.model,
        usage: data.usage,
        id: data.id,
        created: data.created
      }
    }
    
    // 流式响应格式
    if (data.delta || (data.choices && data.choices[0] && data.choices[0].delta)) {
      return {
        type: 'stream',
        delta: data.delta || data.choices[0].delta,
        id: data.id,
        model: data.model,
        finish_reason: data.choices?.[0]?.finish_reason
      }
    }
    
  } catch (error) {
    console.warn('Failed to parse OpenAI message:', error)
  }
  
  return null
}

/**
 * 解析 Anthropic 格式的消息
 * @param {Object} data - 请求或响应数据
 * @returns {Object} 解析后的对话数据
 */
export function parseAnthropicMessages(data) {
  try {
    if (typeof data === 'string') {
      data = JSON.parse(data)
    }
    
    // 请求格式
    if (data.messages && Array.isArray(data.messages)) {
      return {
        type: 'request',
        messages: data.messages,
        model: data.model,
        max_tokens: data.max_tokens,
        system: data.system,
        tools: data.tools,
        temperature: data.temperature,
        stream: data.stream || false
      }
    }
    
    // 响应格式
    if (data.content && Array.isArray(data.content)) {
      return {
        type: 'response',
        content: data.content,
        model: data.model,
        role: data.role,
        id: data.id,
        usage: data.usage,
        stop_reason: data.stop_reason
      }
    }
    
    // 流式响应格式
    if (data.delta && data.delta.text !== undefined) {
      return {
        type: 'stream',
        delta: data.delta,
        id: data.id,
        model: data.model
      }
    }
    
  } catch (error) {
    console.warn('Failed to parse Anthropic message:', error)
  }
  
  return null
}

/**
 * 解析 AI 消息内容
 * @param {string} requestBody - 请求体字符串
 * @param {string} responseBody - 响应体字符串
 * @param {string} url - 请求 URL
 * @returns {Object} 统一格式的对话数据 (始终使用 OpenAI 格式)
 */
export function parseAIConversation(requestBody, responseBody, url) {
  const provider = detectAIProvider(url)
  
  let parsedRequest = null
  let parsedResponse = null
  
  try {
    // 解析请求数据
    if (requestBody) {
      if (provider === 'openai') {
        parsedRequest = parseOpenAIMessages(requestBody)
      } else if (provider === 'anthropic') {
        const anthropicRequest = parseAnthropicMessages(requestBody)
        parsedRequest = convertToOpenAIFormat(anthropicRequest, provider)
      }
    }
    
    // 解析响应数据
    if (responseBody) {
      if (provider === 'openai') {
        parsedResponse = parseOpenAIMessages(responseBody)
      } else if (provider === 'anthropic') {
        const anthropicResponse = parseAnthropicMessages(responseBody)
        parsedResponse = convertToOpenAIFormat(anthropicResponse, provider)
      }
    }
  } catch (error) {
    console.warn('Failed to parse AI conversation:', error)
  }
  
  return {
    provider,
    request: parsedRequest,
    response: parsedResponse,
    url
  }
}

/**
 * 检测是否为流式响应数据
 * @param {string} text - 响应文本
 * @returns {boolean}
 */
export function isStreamResponse(text) {
  if (!text || typeof text !== 'string') {
    return false
  }
  
  // 检测 SSE 格式
  const lines = text.split('\n')
  return lines.some(line => 
    line.startsWith('data: ') || 
    line.startsWith('event: ') ||
    line === 'data: [DONE]'
  )
}

/**
 * 解析 SSE 流式数据
 * @param {string} text - SSE 文本
 * @param {string} provider - AI 提供商类型 ('openai' | 'anthropic' | 'generic')
 * @returns {Array} 解析后的数据块数组 (统一转换为 OpenAI 格式)
 */
export function parseStreamData(text, provider = 'generic') {
  if (!isStreamResponse(text)) {
    return []
  }
  
  const chunks = []
  const lines = text.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('data: ')) {
      const dataStr = line.substring(6).trim()
      
      if (dataStr === '[DONE]') {
        chunks.push({ type: 'done' })
        continue
      }
      
      try {
        const data = JSON.parse(dataStr)
        
        // 根据 provider 参数进行不同的处理
        if (provider === 'anthropic') {
          // Anthropic 流式格式转换
          if (data.delta && data.delta.text !== undefined) {
            // Anthropic 流式响应转换为 OpenAI 格式
            const convertedData = {
              choices: [{
                delta: {
                  content: data.delta.text
                }
              }],
              id: data.id,
              model: data.model
            }
            chunks.push({ type: 'data', data: convertedData })
          } else if (data.delta && data.delta.type === 'tool_use') {
            // Anthropic 工具调用流转换为 OpenAI 格式
            const convertedData = {
              choices: [{
                delta: {
                  tool_calls: [{
                    index: 0, // Anthropic 没有 index，使用 0
                    type: 'function',
                    id: data.delta.id,
                    function: {
                      name: data.delta.name,
                      arguments: JSON.stringify(data.delta.input || {})
                    }
                  }]
                }
              }],
              id: data.id,
              model: data.model
            }
            chunks.push({ type: 'data', data: convertedData })
          } else {
            // 其他 Anthropic 流式数据
            chunks.push({ type: 'data', data })
          }
        } else {
          // OpenAI 格式或其他格式直接使用
          chunks.push({ type: 'data', data })
        }
      } catch (error) {
        console.warn('Failed to parse stream data:', dataStr, error)
      }
    }
  }
  
  return chunks
}

/**
 * 将工具调用标准化为 OpenAI 格式
 * @param {Array} toolCalls - 原始工具调用数组
 * @returns {Array} 标准化后的工具调用数组
 */
export function normalizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return []
  
  return toolCalls.map(toolCall => {
    // 如果已经是 OpenAI 格式
    if (toolCall.type === 'function' && toolCall.function) {
      return toolCall
    }
    
    // Anthropic 格式转换
    if (toolCall.type === 'tool_use') {
      return {
        type: 'function',
        id: toolCall.id,
        function: {
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.input || {})
        }
      }
    }
    
    // 旧版 function_call 格式
    if (toolCall.function_call) {
      return {
        type: 'function',
        function: toolCall.function_call
      }
    }
    
    return toolCall
  })
}

/**
 * 将 Anthropic 消息转换为 OpenAI 格式
 * @param {Object} anthropicMessage - Anthropic 格式消息
 * @returns {Object} OpenAI 格式消息
 */
export function convertAnthropicToOpenAI(anthropicMessage) {
  if (!anthropicMessage) return null
  
  // 请求格式转换
  if (anthropicMessage.type === 'request') {
    const openaiRequest = {
      messages: [],
      model: anthropicMessage.model,
      stream: anthropicMessage.stream || false,
      temperature: anthropicMessage.temperature,
      max_tokens: anthropicMessage.max_tokens
    }
    
    // 转换 system 消息
    if (anthropicMessage.system) {
      let systemContent = ''
      
      if (typeof anthropicMessage.system === 'string') {
        systemContent = anthropicMessage.system
      } else if (Array.isArray(anthropicMessage.system)) {
        // 处理 Anthropic 系统消息的数组格式
        const textParts = anthropicMessage.system
          .filter(part => part.type === 'text')
          .map(part => part.text)
        systemContent = textParts.join('\n')
      }
      
      if (systemContent) {
        openaiRequest.messages.push({
          role: 'system',
          content: systemContent
        })
      }
    }
    
    // 转换普通消息
    if (anthropicMessage.messages && Array.isArray(anthropicMessage.messages)) {
      anthropicMessage.messages.forEach(msg => {
        const openaiMsg = {
          role: msg.role,
          content: ''
        }
        
        // 处理内容
        if (typeof msg.content === 'string') {
          openaiMsg.content = msg.content
        } else if (Array.isArray(msg.content)) {
          // 处理 tool_result 消息 (用户角色的工具返回结果)
          if (msg.role === 'user') {
            const toolResults = msg.content.filter(part => part.type === 'tool_result')
            if (toolResults.length > 0) {
              // 将 tool_result 转换为 OpenAI 的 tool 角色消息
              toolResults.forEach(toolResult => {
                openaiRequest.messages.push({
                  role: 'tool',
                  content: toolResult.content || '',
                  tool_call_id: toolResult.tool_use_id
                })
              })
              return // 跳过当前消息，已经转换为 tool 消息
            }
          }
          
          // 提取文本内容
          const textParts = msg.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
          openaiMsg.content = textParts.join('\n')
          
          // 提取工具调用
          const toolUses = msg.content.filter(part => part.type === 'tool_use')
          if (toolUses.length > 0) {
            openaiMsg.tool_calls = normalizeToolCalls(toolUses)
          }
        }
        
        openaiRequest.messages.push(openaiMsg)
      })
    }
    
    // 转换工具定义
    if (anthropicMessage.tools) {
      openaiRequest.tools = anthropicMessage.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }))
    }
    
    return openaiRequest
  }
  
  // 响应格式转换
  if (anthropicMessage.type === 'response') {
    const openaiResponse = {
      choices: [{
        message: {
          role: anthropicMessage.role || 'assistant',
          content: ''
        },
        finish_reason: anthropicMessage.stop_reason || 'stop'
      }],
      model: anthropicMessage.model,
      id: anthropicMessage.id,
      usage: anthropicMessage.usage
    }
    
    // 处理内容
    if (Array.isArray(anthropicMessage.content)) {
      const textParts = anthropicMessage.content
        .filter(part => part.type === 'text')
        .map(part => part.text)
      openaiResponse.choices[0].message.content = textParts.join('\n')
      
      // 提取工具调用
      const toolUses = anthropicMessage.content.filter(part => part.type === 'tool_use')
      if (toolUses.length > 0) {
        openaiResponse.choices[0].message.tool_calls = normalizeToolCalls(toolUses)
      }
    }
    
    return openaiResponse
  }
  
  // 流式响应转换
  if (anthropicMessage.type === 'stream') {
    return {
      choices: [{
        delta: {
          content: anthropicMessage.delta?.text || ''
        }
      }],
      id: anthropicMessage.id,
      model: anthropicMessage.model
    }
  }
  
  return anthropicMessage
}

/**
 * 将任意格式转换为 OpenAI 格式
 * @param {Object} message - 原始消息
 * @param {string} provider - 提供商类型
 * @returns {Object} OpenAI 格式消息
 */
export function convertToOpenAIFormat(message, provider) {
  if (!message) return null
  
  switch (provider) {
    case 'anthropic':
      return convertAnthropicToOpenAI(message)
    case 'openai':
      return message // 已经是 OpenAI 格式
    default:
      return message // 通用格式暂时不转换
  }
}

/**
 * 提取工具调用信息
 * @param {Object} message - 消息对象
 * @param {string} provider - AI 提供商类型 ('openai' | 'anthropic' | 'generic')
 * @returns {Array} 标准化后的工具调用数组 (OpenAI 格式)
 */
export function extractToolCalls(message, provider = 'generic') {
  if (!message) return []
  
  const toolCalls = []
  
  if (provider === 'openai') {
    // OpenAI 格式
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      toolCalls.push(...message.tool_calls)
    }
    
    // 旧版 function_call 格式
    if (message.function_call) {
      toolCalls.push({
        type: 'function',
        function: message.function_call
      })
    }
  } else if (provider === 'anthropic') {
    // Anthropic 格式
    if (message.content && Array.isArray(message.content)) {
      message.content.forEach(item => {
        if (item.type === 'tool_use') {
          toolCalls.push({
            type: 'tool_use',
            id: item.id,
            name: item.name,
            input: item.input
          })
        }
      })
    }
  } else {
    // 通用格式 - 兼容所有格式
    // OpenAI 格式
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      toolCalls.push(...message.tool_calls)
    }
    
    // 旧版 function_call 格式
    if (message.function_call) {
      toolCalls.push({
        type: 'function',
        function: message.function_call
      })
    }
    
    // Anthropic 格式
    if (message.content && Array.isArray(message.content)) {
      message.content.forEach(item => {
        if (item.type === 'tool_use') {
          toolCalls.push({
            type: 'tool_use',
            id: item.id,
            name: item.name,
            input: item.input
          })
        }
      })
    }
  }
  
  return normalizeToolCalls(toolCalls)
}