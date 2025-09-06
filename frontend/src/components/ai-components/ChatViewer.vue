<template>
  <div class="chat-viewer">
    <div v-if="!requestData" class="empty-chat">
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
          <span class="provider-badge"
                :class="'provider-'+(aiProvider?.name.toLowerCase() ?? 'generic')">
            {{ aiProvider?.name ?? 'Unknown' }}
          </span>
          <span class="model-info" v-if="requestData?.model">{{ requestData?.model }}</span>
        </div>
        <div class="chat-controls">
          <button
              class="control-button"
              :class="{ active: showMetadata }"
              @click="toggleMetadata"
              title="Toggle metadata"
          >
            <span class="control-icon">📊</span>
            <span class="control-text">Metadata</span>
          </button>
          <button
              class="control-button"
              :class="{ active: autoScroll }"
              @click="toggleAutoScroll"
              title="Toggle auto-scroll"
          >
            <span class="control-icon">📄</span>
            <span class="control-text">Auto-scroll</span>
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
          <div v-if="usage" class="metadata-item">
            <label>Token Usage:</label>
            <span>{{ formatTokenUsage(usage) }}</span>
          </div>
          <div v-if="requestData?.stream !== undefined" class="metadata-item">
            <label>Stream:</label>
            <span>{{ requestData.stream ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </div>

      <!-- Messages Container -->
      <div class="messages-container" ref="messagesContainer">
        <!-- System Message -->
        <div v-if="systemMessage" class="message system-message">
          <div class="message-header" style="justify-content: center">
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
          <div class="message-header" :style="(message.role==='user')?'justify-content: right':'' "  >
            <span class="message-role">
              {{ message.role.charAt(0).toUpperCase() + message.role.substring(1) }}
            </span>
          </div>

          <div class="message-content">
            <!-- 图片内容 -->
            <div v-if="hasImageContent(message)" class="message-images">
              <ImageMessage :content="getImageContent(message)" />
            </div>
            
            <!-- 文本内容 -->
            <div v-if="message.content && getTextContent(message)" class="message-text">
              <!-- 使用折叠组件显示工具回复 -->
              <ToolMessage
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

              <div v-else class="message-text-content" style="">{{ getTextContent(message) }}</div>
            </div>

            <!-- Tool Calls -->
            <div v-if="message.tool_calls && message.tool_calls.length > 0" class="tool-calls">
              <ToolCallViewer
                  v-for="(toolCall, idx) in message.tool_calls"
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

<script lang="ts" setup>
import {computed, nextTick, onMounted, ref, watch} from 'vue'
import {getAIProvider, isStreamResponse} from '@/utils/AiDetector.ts'
import ToolCallViewer from './ToolCallViewer.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ToolMessage from './ToolMessage.vue'
import ImageMessage from './ImageMessage.vue'
import {OpenAI} from "@/utils/LLMSModels.ts"

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
const messagesContainer = ref<Element>()
const showMetadata = ref(false)
const autoScroll = ref(true)
const error = ref('')
const usage = ref<OpenAI.Usage | null>(null)

// 获取 AI Provider
const aiProvider = getAIProvider(props.url)

// 请求和响应数据
const requestData = computed<OpenAI.ChatCompletionRequest | null>(() => {
  try {
    if (!props.requestBody || !aiProvider) return null
    return aiProvider.parseRequest(props.requestBody)
  } catch (err) {
    console.error(err)
    error.value = `Failed to parse AI request: ${(err as Error).message}`
    return null
  }
})

// 系统消息
const systemMessage = computed(() => {
  const systemMsg = requestData.value?.messages?.find(msg => msg.role === 'system')
  return systemMsg?.content
})

// 解析流式数据
const parseStreamData = (responseBody: string): OpenAI.Chunk[] => {
  if (!responseBody || !aiProvider) return []

  const chunks: OpenAI.Chunk[] = []

  for (const line of responseBody.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const chunk = aiProvider.parseChunk(line)
        if (chunk) chunks.push(chunk)
      } catch (err) {
        console.warn('Failed to parse chunk:', err)
      }
    }
  }

  return chunks
}

interface Message extends OpenAI.ChatCompletionMessage {
  id: string
  isStreaming?: boolean
}

// 显示的消息列表
const displayMessages = computed<Message[]>(() => {
  const messages: Message[] = []

  try {
    // 添加请求消息
    if (requestData?.value?.messages) {
      requestData.value.messages.forEach(msg => {
        if (msg.role !== 'system') {
          messages.push({
            id: `req-${messages.length}`,
            ...msg,
          })
        }
      })
    }

    // 处理流式响应
    if (isStreamResponse(props.responseBody)) {
      const streamChunks = parseStreamData(props.responseBody)
      let assistantMessage = {
        id: 'stream-assistant',
        role: 'assistant',
        content: '',
        tool_calls: [] as OpenAI.DeltaToolCall[],
        isStreaming: !props.finished
      }

      // 用于累积工具调用的临时存储
      const toolCallsMap = new Map<number, OpenAI.DeltaToolCall>()

      // 合并流式数据块
      streamChunks.forEach(chunk => {
        if (chunk?.usage) usage.value = chunk.usage

        // 处理文本内容
        if (chunk.choices?.[0]?.delta?.content) {
          assistantMessage.content += chunk.choices[0].delta.content
        }

        // 处理工具调用
        if (chunk.choices?.[0]?.delta?.tool_calls) {
          chunk.choices[0].delta.tool_calls.forEach(toolCall => {
            if (toolCall.index === undefined) {
              return
            }

            const existingCall = toolCallsMap.get(toolCall.index) || {
              type: 'function',
              id: toolCall.id || '',
              function: {name: '', arguments: ''}
            } as OpenAI.DeltaToolCall

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
          })
        }
      })

      // 将累积的工具调用添加到消息中
      if (toolCallsMap.size > 0) {
        assistantMessage.tool_calls = Array.from(toolCallsMap.values())
      }


      if (assistantMessage.content || assistantMessage.tool_calls.length > 0) {
        messages.push(assistantMessage as Message)
      }

    } else {
      // 处理普通响应
      if (props.responseBody) {
        let response = aiProvider?.parseResponse(props.responseBody);
        if (response?.usage) usage.value = response.usage
        response?.choices.forEach((choice, idx) => {
          if (choice.message) {
            messages.push({
              ...choice.message,
              id: `resp-${idx}`
            } as Message)
          }
        })
      }
    }
  } catch (e) {
    error.value = `Failed to parse AI response: ${(e as Error).message}`
    console.log(e)
  }

  return messages
})

// 消息样式类
const getMessageClass = (message: Message) => {
  const classes = [`${message.role}-message`]

  if (message.isStreaming) {
    classes.push('streaming')
  }

  if (message.tool_calls && message.tool_calls.length > 0) {
    classes.push('has-tools')
  }

  return classes
}


// 获取文本内容
const getTextContent = (message: Message) => {
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

// 检查消息是否包含图片
const hasImageContent = (message: Message) => {
  if (typeof message.content === 'string') {
    return false
  }
  
  if (Array.isArray(message.content)) {
    return message.content.some(part => part.type === 'image_url')
  }
  
  return false
}

// 获取图片内容
const getImageContent = (message: Message) => {
  if (typeof message.content === 'string') {
    return []
  }
  
  if (Array.isArray(message.content)) {
    return message.content
  }
  
  return []
}


// 格式化 token 使用量
const formatTokenUsage = (usage: OpenAI.Usage) => {
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
      if (messagesContainer.value && autoScroll.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
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
  container-type: inline-size;
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
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-background-elevation-2);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  gap: var(--spacing-sm);
}

.chat-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  flex-shrink: 1;
}

.provider-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: 12px;
  font-size: var(--font-size-small);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-controls {
  display: flex;
  gap: var(--spacing-xs);
  flex-shrink: 0;
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

.control-text {
  display: none;
}

/* 在较大屏幕上显示按钮文本 */
@media (min-width: 480px) {
  .control-text {
    display: inline;
  }
}

.metadata-panel {
  padding: var(--spacing-md);
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.metadata-item {
  margin: 0 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metadata-item label {
  font-weight: 500;
  color: var(--color-foreground-secondary);
  margin-right: var(--spacing-xs);
}

.metadata-item span {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  text-align: right;
  flex: 1;
}

.monospace {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.message {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
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

/* 消息对齐和宽度 */
.system-message {
  width: 100%;
  align-self: center;
}

.user-message {
  align-self: flex-end;
}

.assistant-message,
.tool-message,
.error-message {
  align-self: flex-start;
}

/* 消息内容样式 */
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

.message-content {
  background: var(--color-background-elevation-1);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-width: 100%;
  word-wrap: break-word;
}

.user-message .message-content {
  background: #5a4ca5;
  color: white;
  border-color: var(--color-accent);
}

.system-message .message-content {
  background: var(--color-background-elevation-2);
  border-color: var(--color-info);
  border-style: dashed;
}

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

.message-images {
  margin-bottom: var(--spacing-sm);
}

.message-text + .message-images,
.message-images + .message-text {
  margin-top: var(--spacing-sm);
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
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
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
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

/* 响应式设计 - 小屏幕 */
@media (max-width: 479px) {
  .chat-header {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-xs);
  }

  .chat-controls {
    justify-content: flex-end;
  }

  .control-button {
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .metadata-grid {
    grid-template-columns: 1fr;
  }

  .messages-container {
    padding: var(--spacing-sm);
  }

  .message-content {
    padding: var(--spacing-xs);
  }
}

/* 响应式设计 - 中等屏幕 */
@media (min-width: 480px) and (max-width: 768px) {
  .messages-container {
    padding: var(--spacing-md);
  }

  .metadata-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}

/* 响应式设计 - 大屏幕 */
@media (min-width: 769px) {
  .messages-container {
    padding: var(--spacing-lg);
  }

  .message-content {
    padding: var(--spacing-md);
  }

  .metadata-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
}

.messages-container {
  padding: var(--spacing-lg) var(--spacing-xl);
}

.message {
  max-width: 90%;
}

.user-message {
  max-width: 90%;
}

.assistant-message {
  max-width: 90%;
}

/* 容器查询 - 基于组件宽度的响应式 */
@container (min-width: 400px) {
  .metadata-grid {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
}

@container (min-width: 600px) {
  .metadata-grid {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .message-content {
    padding: var(--spacing-md);
  }
}
</style>