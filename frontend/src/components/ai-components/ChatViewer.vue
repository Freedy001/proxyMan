<template>
  <div class="chat-viewer">
    <div v-if="!hasMessages" class="empty-chat">
      <div class="empty-chat-icon">💬</div>
      <div class="empty-chat-title">No AI conversation detected</div>
      <div class="empty-chat-description">
        This request doesn't appear to contain AI chat messages
      </div>
    </div>
    
    <div v-else class="chat-content">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="chat-title">
          <span class="provider-badge" :class="providerClass">{{ providerName }}</span>
          <span class="model-info" v-if="modelName">{{ modelName }}</span>
        </div>
        <div class="chat-controls">
          <button 
            class="control-button"
            :class="{ active: showMetadata }"
            @click="toggleMetadata"
            title="Toggle metadata"
          >
            <span class="control-icon">📊</span>
            Metadata
          </button>
          <button 
            class="control-button"
            :class="{ active: autoScroll }"
            @click="toggleAutoScroll"
            title="Toggle auto-scroll"
          >
            <span class="control-icon">📄</span>
            Auto-scroll
          </button>
        </div>
      </div>
      
      <!-- Metadata Panel -->
      <div v-if="showMetadata" class="metadata-panel">
        <div class="metadata-grid">
          <div v-if="requestData?.model" class="metadata-item">
            <label>Model:</label>
            <span>{{ requestData.model }}</span>
          </div>
          <div v-if="requestData?.temperature !== undefined" class="metadata-item">
            <label>Temperature:</label>
            <span>{{ requestData.temperature }}</span>
          </div>
          <div v-if="requestData?.max_tokens" class="metadata-item">
            <label>Max Tokens:</label>
            <span>{{ requestData.max_tokens }}</span>
          </div>
          <div v-if="responseData?.usage" class="metadata-item">
            <label>Token Usage:</label>
            <span>{{ formatTokenUsage(responseData.usage) }}</span>
          </div>
          <div v-if="requestData?.stream !== undefined" class="metadata-item">
            <label>Stream:</label>
            <span>{{ requestData.stream ? 'Yes' : 'No' }}</span>
          </div>
          <div v-if="responseData?.id" class="metadata-item">
            <label>Request ID:</label>
            <span class="monospace">{{ responseData.id }}</span>
          </div>
        </div>
      </div>
      
      <!-- Messages Container -->
      <div class="messages-container" ref="messagesContainer">
        <!-- System Message -->
        <div v-if="systemMessage" class="message system-message">
          <div class="message-header">
            <span class="message-role">System</span>
          </div>
          <div class="message-content">
            <div class="message-text">{{ systemMessage }}</div>
          </div>
        </div>
        
        <!-- Conversation Messages -->
        <div 
          v-for="(message, index) in displayMessages" 
          :key="message.id || index"
          class="message"
          :class="getMessageClass(message)"
        >
          <div class="message-header">
            <span class="message-role">{{ getRoleDisplay(message.role) }}</span>
            <span v-if="message.timestamp" class="message-timestamp">
              {{ formatTimestamp(message.timestamp) }}
            </span>
          </div>
          
          <div class="message-content">
            <!-- Text Content -->
            <div v-if="getTextContent(message)" class="message-text">
              <!-- 使用折叠组件显示工具回复 -->
              <CollapsibleToolMessage 
                v-if="message.role === 'tool'"
                :message="message"
                class="message-text-content"
              />
              <!-- 使用 Markdown 渲染 AI 助手回复，其他消息保持纯文本 -->
              <MarkdownRenderer 
                v-else-if="message.role === 'assistant'"
                :content="getTextContent(message)"
                class="message-text-content"
              />
              <div v-else class="message-text-content">{{ getTextContent(message) }}</div>
            </div>
            
            <!-- Tool Calls -->
            <div v-if="message.toolCalls && message.toolCalls.length > 0" class="tool-calls">
              <ToolCallViewer 
                v-for="(toolCall, idx) in message.toolCalls" 
                :key="idx"
                :tool-call="toolCall"
              />
            </div>
            
            <!-- Streaming Indicator -->
            <div v-if="message.isStreaming" class="streaming-indicator">
              <span class="streaming-dots">●●●</span>
              <span class="streaming-text">Streaming...</span>
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="error" class="message error-message">
          <div class="message-header">
            <span class="message-role">Error</span>
          </div>
          <div class="message-content">
            <div class="message-text">{{ error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { parseAIConversation, extractToolCalls, parseStreamData, isStreamResponse } from '../../utils/aiDetector.js'
import ToolCallViewer from './ToolCallViewer.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import CollapsibleToolMessage from './CollapsibleToolMessage.vue'

const props = defineProps({
  requestBody: {
    type: String,
    default: ''
  },
  responseBody: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    default: ''
  },
  finished: {
    type: Boolean,
    default: false
  }
})

// Refs
const messagesContainer = ref(null)
const showMetadata = ref(false)
const autoScroll = ref(true)
const error = ref('')

// 解析 AI 对话数据
const conversationData = computed(() => {
  if (!props.requestBody && !props.responseBody) {
    return null
  }
  
  try {
    return parseAIConversation(props.requestBody, props.responseBody, props.url)
  } catch (err) {
    error.value = `Failed to parse AI conversation: ${err.message}`
    return null
  }
})

// 请求和响应数据
const requestData = computed(() => conversationData.value?.request)
const responseData = computed(() => conversationData.value?.response)
const provider = computed(() => conversationData.value?.provider || 'generic')

// Provider 显示
const providerName = computed(() => {
  switch (provider.value) {
    case 'openai': return 'OpenAI'
    case 'anthropic': return 'Anthropic'
    default: return 'AI'
  }
})

const providerClass = computed(() => `provider-${provider.value}`)

// 模型名称
const modelName = computed(() => {
  return requestData.value?.model || responseData.value?.model || ''
})

// 系统消息 (现在总是 OpenAI 格式)
const systemMessage = computed(() => {
  const systemMsg = requestData.value?.messages?.find(msg => msg.role === 'system')
  return systemMsg?.content
})

// 是否有消息
const hasMessages = computed(() => {
  return conversationData.value && (requestData.value || responseData.value)
})

// 显示的消息列表
const displayMessages = computed(() => {
  if (!hasMessages.value) return []
  
  const messages = []
  
  // 添加请求消息 (现在总是 OpenAI 格式)
  if (requestData.value?.messages) {
    requestData.value.messages.forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({
          ...msg,
          id: `req-${messages.length}`,
          toolCalls: extractToolCalls(msg, 'openai'), // 传递provider参数
          timestamp: Date.now()
        })
      }
    })
  }
  
  // 处理流式响应
  if (isStreamResponse(props.responseBody)) {
    const streamChunks = parseStreamData(props.responseBody, provider.value) // 传递provider参数
    let assistantMessage = {
      role: 'assistant',
      content: '',
      id: 'stream-assistant',
      toolCalls: [],
      timestamp: Date.now(),
      isStreaming: !props.finished
    }
    
    // 用于累积工具调用的临时存储
    const toolCallsMap = new Map()
    
    // 合并流式数据块 (现在只处理 OpenAI 格式)
    streamChunks.forEach(chunk => {
      if (chunk.type === 'data' && chunk.data) {
        // 处理文本内容
        if (chunk.data.choices?.[0]?.delta?.content) {
          assistantMessage.content += chunk.data.choices[0].delta.content
        }
        
        // 处理工具调用
        if (chunk.data.choices?.[0]?.delta?.tool_calls) {
          chunk.data.choices[0].delta.tool_calls.forEach(toolCall => {
            if (toolCall.index !== undefined) {
              const existingCall = toolCallsMap.get(toolCall.index) || {
                type: 'function',
                id: toolCall.id || '',
                function: { name: '', arguments: '' }
              }
              
              if (toolCall.function?.name) {
                existingCall.function.name = toolCall.function.name
              }
              if (toolCall.function?.arguments) {
                existingCall.function.arguments += toolCall.function.arguments
              }
              if (toolCall.id) {
                existingCall.id = toolCall.id
              }
              
              toolCallsMap.set(toolCall.index, existingCall)
            }
          })
        }
      }
    })
    
    // 将累积的工具调用添加到消息中
    if (toolCallsMap.size > 0) {
      assistantMessage.toolCalls = Array.from(toolCallsMap.values())
    }
    
    if (assistantMessage.content || assistantMessage.toolCalls.length > 0) {
      messages.push(assistantMessage)
    }
  } else {
    // 处理普通响应 (现在总是 OpenAI 格式)
    if (responseData.value?.choices) {
      responseData.value.choices.forEach((choice, idx) => {
        if (choice.message) {
          messages.push({
            ...choice.message,
            id: `resp-${idx}`,
            toolCalls: extractToolCalls(choice.message, 'openai'), // 传递provider参数
            timestamp: responseData.value.created ? responseData.value.created * 1000 : Date.now()
          })
        }
      })
    }
  }
  
  return messages
})

// 消息样式类
const getMessageClass = (message) => {
  const classes = [`${message.role}-message`]
  
  if (message.isStreaming) {
    classes.push('streaming')
  }
  
  if (message.toolCalls && message.toolCalls.length > 0) {
    classes.push('has-tools')
  }
  
  return classes
}

// 角色显示名称
const getRoleDisplay = (role) => {
  switch (role) {
    case 'user': return 'User'
    case 'assistant': return 'Assistant'
    case 'system': return 'System'
    case 'tool': return 'Tool'
    default: return role
  }
}

// 获取文本内容
const getTextContent = (message) => {
  if (typeof message.content === 'string') {
    return message.content
  }
  
  if (Array.isArray(message.content)) {
    const textParts = message.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
    return textParts.join('\n')
  }
  
  return ''
}

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

// 格式化 token 使用量
const formatTokenUsage = (usage) => {
  if (!usage) return ''
  
  const parts = []
  if (usage.prompt_tokens) parts.push(`${usage.prompt_tokens} prompt`)
  if (usage.completion_tokens) parts.push(`${usage.completion_tokens} completion`)
  if (usage.total_tokens) parts.push(`${usage.total_tokens} total`)
  
  return parts.join(', ')
}

// 控制方法
const toggleMetadata = () => {
  showMetadata.value = !showMetadata.value
}

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) {
    scrollToBottom()
  }
}

// 滚动到底部
const scrollToBottom = () => {
  if (messagesContainer.value && autoScroll.value) {
    nextTick(() => {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    })
  }
}

// 监听消息变化自动滚动
watch(() => displayMessages.value.length, () => {
  if (autoScroll.value) {
    scrollToBottom()
  }
})

// 监听响应体变化（流式更新）
watch(() => props.responseBody, () => {
  if (autoScroll.value) {
    scrollToBottom()
  }
})

// 生命周期
onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-background);
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-foreground-secondary);
  text-align: center;
  padding: var(--spacing-xl);
}

.empty-chat-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-lg);
  opacity: 0.5;
}

.empty-chat-title {
  font-size: var(--font-size-large);
  margin-bottom: var(--spacing-sm);
}

.empty-chat-description {
  font-size: var(--font-size-normal);
  color: var(--color-foreground-disabled);
}

.chat-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  container-type: inline-size;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-background-elevation-2);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.provider-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 12px;
  font-size: var(--font-size-small);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provider-openai {
  background: #10a37f;
  color: white;
}

.provider-anthropic {
  background: #d97706;
  color: white;
}

.provider-generic {
  background: var(--color-accent);
  color: white;
}

.model-info {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
}

.chat-controls {
  display: flex;
  gap: var(--spacing-sm);
}

.control-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: auto;
}

.control-button:hover {
  background: var(--color-background-hover);
  color: var(--color-foreground);
}

.control-button.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.metadata-panel {
  padding: var(--spacing-md);
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.metadata-grid {
  display: flex;
  flex-direction: column;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-sm);
}

.metadata-item {
  margin: 0 10px;
  display: flex;
  justify-content: space-between;
}

.metadata-item label {
  font-weight: 500;
  color: var(--color-foreground-secondary);
}

.metadata-item span {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
}

.monospace {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  
  /* 优化大屏幕体验 */
  @media (min-width: 1024px) {
    padding: var(--spacing-lg) var(--spacing-xl);
  }
  
  /* 移动端优化 */
  @media (max-width: 768px) {
    padding: var(--spacing-md) var(--spacing-sm);
  }
}

.message {
  display: flex;
  flex-direction: column;
  max-width: min(98%, 1400px);
  margin-bottom: var(--spacing-md);
  animation: slideInMessage 0.3s ease-out;
}

@keyframes slideInMessage {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.system-message {
  align-self: center;
  max-width: min(95%, 1200px);
}

.user-message {
  align-self: flex-end;
  max-width: min(90%, 1000px);
}

.assistant-message {
  align-self: flex-start;
  max-width: min(98%, 1400px);
}

.tool-message {
  align-self: flex-start;
  max-width: min(95%, 1200px);
}

.error-message {
  align-self: center;
  max-width: min(95%, 1200px);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-small);
}

.message-role {
  font-weight: 600;
  text-transform: capitalize;
}

.system-message .message-role {
  color: var(--color-info);
}

.user-message .message-role {
  color: var(--color-accent);
}

.assistant-message .message-role {
  color: var(--color-success);
}

.tool-message .message-role {
  color: var(--color-warning);
}

.error-message .message-role {
  color: var(--color-error);
}

.message-timestamp {
  color: var(--color-foreground-disabled);
  font-size: var(--font-size-small);
}

.message-content {
  background: var(--color-background-elevation-1);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.user-message .message-content {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.system-message .message-content {
  background: var(--color-background-elevation-2);
  border-color: var(--color-info);
  border-style: dashed;
}

/*noinspection CssUnresolvedCustomProperty*/
.error-message .message-content {
  background: var(--color-error-bg);
  border-color: var(--color-error);
  color: var(--color-error);
}

.message-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  position: relative;
  max-width: 100%;
  overflow-wrap: break-word;
}

.message-text-content {
  line-height: 1.6;
  min-height: 1.6em;
}

.tool-calls {
  margin-top: var(--spacing-sm);
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
}

.streaming-dots {
  font-size: var(--font-size-large);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.streaming-text {
  font-style: italic;
}

.streaming .message-content {
  position: relative;
}

.streaming .message-content::after {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  border: 2px solid var(--color-accent);
  border-radius: 8px;
  animation: glow 2s infinite;
}

@keyframes glow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* 响应式宽度优化 */
@media (min-width: 1440px) {
  .message {
    max-width: min(95%, 1600px);
  }
  
  .assistant-message {
    max-width: min(95%, 1600px);
  }

  .system-message,
  .tool-message,
  .error-message {
    max-width: min(92%, 1400px);
  }
  
  .user-message {
    max-width: min(88%, 1200px);
  }
}

@media (max-width: 768px) {
  .message {
    max-width: 100%;
  }
  
  .system-message,
  .user-message,
  .assistant-message,
  .tool-message,
  .error-message {
    max-width: 100%;
  }
  
  .user-message {
    align-self: stretch;
  }
  
  .assistant-message {
    align-self: stretch;
  }
}

@media (min-width: 769px) and (max-width: 1023px) {
  .message {
    max-width: min(96%, 1000px);
  }
  
  .assistant-message {
    max-width: min(96%, 1000px);
  }
}

/* 容器查询支持 - 基于ChatViewer容器宽度的响应式调整 */
@container (min-width: 800px) {
  .message {
    max-width: min(95%, 1400px);
  }
  
  .assistant-message {
    max-width: min(95%, 1400px);
  }
  
  .messages-container {
    padding-left: var(--spacing-xl);
    padding-right: var(--spacing-xl);
  }
}

@container (min-width: 1200px) {
  .message {
    max-width: min(92%, 1600px);
  }
  
  .assistant-message {
    max-width: min(92%, 1600px);
  }

  .messages-container {
    padding-left: calc(var(--spacing-xl) * 1.5);
    padding-right: calc(var(--spacing-xl) * 1.5);
  }
}

@container (max-width: 600px) {
  .message {
    max-width: 100%;
  }
  
  .system-message,
  .user-message,
  .assistant-message,
  .tool-message,
  .error-message {
    max-width: 100%;
    align-self: stretch;
  }
  
  .messages-container {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }
}
</style>