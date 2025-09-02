<template>
  <div class="body-viewer">
    <div v-if="!body" class="empty-body">
      {{ emptyMessage }}
    </div>
    <div v-else class="body-content">
      <!-- Header with title and controls -->
      <div class="body-header">
        <div class="body-title">{{ label }}</div>
        <div class="view-mode-controls">
          <button
              class="view-mode-button"
              :class="{ active: currentViewMode === 'monaco' }"
              @click="setViewMode('monaco')"
          >
            <span class="indicator-icon">🔧</span>
            Monaco
          </button>
          <button
              class="view-mode-button"
              :class="{ active: currentViewMode === 'raw' }"
              @click="setViewMode('raw')"
          >
            Raw
          </button>
        </div>
      </div>

      <!-- Content info -->
      <div class="body-info">
        <span class="content-type">{{ contentTypeDisplay }}</span>
        <div class="body-controls">
          <button
              class="auto-scroll-button"
              :class="{ active: autoScroll }"
              @click="toggleAutoScroll"
              title="Toggle auto-scroll"
              v-show="currentViewMode === 'raw'"
          >
            <span class="indicator-icon">📄</span>
            Auto-scroll
          </button>
          <span class="body-size">{{ formattedSize }}</span>
        </div>
      </div>

      <!-- Body content -->
      <div class="body-content-wrapper">
        <div v-if="isLoadingBody" class="loading-indicator">
          <span class="loading-text">Processing content...</span>
        </div>
        <div v-else-if="bodyError" class="error-indicator">
          <span class="error-text">Error formatting content. Showing raw data.</span>
        </div>
        <MonacoEditor
            v-if="currentViewMode === 'monaco'"
            ref="monacoEditor"
            :value="formattedBodyForMonaco"
            :language="detectedLanguage"
            :theme="'vs-dark'"
            :read-only="true"
            height="100%"
            :word-wrap="'on'"
        />
        <pre v-else ref="bodyElement" class="body-text" :class="{ loading: isLoadingBody }">{{ formattedBody }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, ref, watch, nextTick, onMounted, onUnmounted} from 'vue'
import {getContentType} from '../utils/contentHelper.js'
import MonacoEditor from './MonacoEditor.vue'

const props = defineProps({
  // 主要内容
  body: {
    type: String,
    default: ''
  },
  // 用于检测content-type的headers
  headers: {
    type: Object,
    default: () => ({})
  },
  requestState: {
    type: Number,
    default: -1
  },
  // 显示标签
  label: {
    type: String,
    default: 'Body'
  },
  // 视图模式 (raw/monaco)
  viewMode: {
    type: String,
    default: 'raw',
    validator: (value) => ['raw', 'monaco'].includes(value)
  }
})

// 模板引用
const bodyElement = ref(null)
const monacoEditor = ref(null)

// 内部视图模式状态
const currentViewMode = ref(props.viewMode)


// 自动滚动相关状态
const autoScroll = ref(true)
const isUserScrolling = ref(false)
const scrollTimeout = ref(null)

// 视图模式切换方法
const setViewMode = (mode) => {
  currentViewMode.value = mode
  if (mode === 'monaco') {
    nextTick(() => {
      if (monacoEditor.value) {
        monacoEditor.value.resizeEditor()
      }
    })
  }
}

// 监听prop变化同步内部状态
watch(() => props.viewMode, (newMode) => {
  currentViewMode.value = newMode
})

// 空内容消息
const emptyMessage = computed(() => `No ${props.label.toLowerCase()}`)

// 显示的Content-Type
const contentTypeDisplay = computed(() => getContentType(props.headers))

// 检测语言类型用于Monaco编辑器
const detectedLanguage = computed(() => {
  if (!props.body) return 'plaintext'
  
  const contentType = getContentType(props.headers)
  
  if (isJsonContent(contentType)) {
    return 'json'
  }
  
  if (isXmlContent(contentType)) {
    if (contentType.toLowerCase().includes('html')) {
      return 'html'
    }
    return 'xml'
  }
  
  if (isFormContent(contentType)) {
    return 'plaintext' // URL编码的表单数据
  }
  
  // 根据URL路径推断语言类型
  if (props.headers && props.headers.url) {
    const url = props.headers.url.toLowerCase()
    if (url.endsWith('.js')) return 'javascript'
    if (url.endsWith('.css')) return 'css'
    if (url.endsWith('.html') || url.endsWith('.htm')) return 'html'
    if (url.endsWith('.xml')) return 'xml'
    if (url.endsWith('.json')) return 'json'
    if (url.endsWith('.md')) return 'markdown'
    if (url.endsWith('.yaml') || url.endsWith('.yml')) return 'yaml'
    if (url.endsWith('.sql')) return 'sql'
  }
  
  // 尝试通过内容检测
  const content = props.body.trim()
  if (content.startsWith('{') || content.startsWith('[')) {
    return 'json'
  }
  
  if (content.startsWith('<')) {
    return 'html'
  }
  
  return 'plaintext'
})

// 为Monaco编辑器准备格式化后的内容
const formattedBodyForMonaco = computed(() => {
  if (!props.body) return ''

  // 在Monaco模式下，始终返回格式化后的内容
  try {
    return formatBody()
  } catch (error) {
    console.error('Error formatting body for Monaco:', error)
    return props.body // 降级到原始内容
  }
})

// 格式化后的内容 - 使用响应式 ref 替代异步计算属性
const formattedBody = ref('')
const isLoadingBody = ref(false)
const bodyError = ref(null)

// 监听依赖项变化，触发异步更新
watch([() => props.body, () => currentViewMode.value], () => {
  formattedBody.value = props.body
  // 自动滚动到底部（仅在raw模式下）
  if (autoScroll.value && !isUserScrolling.value && currentViewMode.value === 'raw') {
    nextTick(() => {
      scrollToBottom()
    })
  }
}, {immediate: true})

// 计算body大小
const getBodySize = (body) => {
  if (!body) return 0
  return new Blob([body]).size
}

// 格式化文件大小
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatBody = () => {
  let body = props.body
  if (!body) return 'No content'

  let contentType = getContentType(props.headers)

  // Format based on content type
  if (isJsonContent(contentType)) {
    try {
      const parsed = JSON.parse(body)
      return JSON.stringify(parsed, null, 2)
    } catch (e) {
      // If JSON parsing fails, return as-is
      return body
    }
  }

  if (isFormContent(contentType)) {
    try {
      // Format URL-encoded data in a readable way
      const params = new URLSearchParams(body)
      const formatted = []
      for (const [key, value] of params) {
        formatted.push(`${key} = ${value}`)
      }
      return formatted.join('\n')
    } catch (e) {
      return body
    }
  }

  if (isXmlContent(contentType)) {
    try {
      // Basic XML formatting (could be enhanced with a proper XML formatter)
      return body.replace(/></g, '>\n<')
    } catch (e) {
      return body
    }
  }

  return formatBinaryContent(body)
}


const formatBinaryContent = (data) => {
  const maxLength = 1000 // Limit displayed length
  const truncatedData = data.length > maxLength ? data.substring(0, maxLength) : data

  let hex = ''
  for (let i = 0; i < truncatedData.length; i++) {
    const byte = truncatedData.charCodeAt(i)
    hex += byte.toString(16).padStart(2, '0') + ' '
    if ((i + 1) % 16 === 0) hex += '\n'
  }

  const result = `[Binary Content - ${data.length} bytes]\n\nHex dump (first ${truncatedData.length} bytes):\n${hex}`

  if (data.length > maxLength) {
    return result + `\n\n... and ${data.length - maxLength} more bytes`
  }

  return result
}

const isJsonContent = (contentType) => {
  return contentType && typeof contentType === 'string' && contentType.toLowerCase().includes('application/json')
}

const isFormContent = (contentType) => {
  return contentType && typeof contentType === 'string' && contentType.toLowerCase().includes('application/x-www-form-urlencoded')
}

const isXmlContent = (contentType) => {
  return contentType && typeof contentType === 'string' && (contentType.toLowerCase().includes('xml') || contentType.toLowerCase().includes('html'))
}

// 格式化后的大小
const formattedSize = computed(() => formatBytes(getBodySize(props.body)))

// 自动滚动相关方法
const scrollToBottom = () => {
  if (bodyElement.value && currentViewMode.value === 'raw') {
    bodyElement.value.scrollTop = bodyElement.value.scrollHeight
  }
}

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) {
    scrollToBottom()
  }
}

const handleScroll = () => {
  if (!bodyElement.value) return
  
  const element = bodyElement.value
  const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 10
  
  // 如果用户手动滚动且不在底部，关闭自动滚动
  if (!isNearBottom) {
    autoScroll.value = false
    isUserScrolling.value = true
  } else {
    // 如果滚动到底部，重新启用自动滚动
    isUserScrolling.value = false
    autoScroll.value = true
  }
  
  // 防抖：500ms后重置用户滚动状态
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  scrollTimeout.value = setTimeout(() => {
    if (isNearBottom) {
      isUserScrolling.value = false
    }
  }, 500)
}

// 生命周期钩子
onMounted(() => {
  if (bodyElement.value) {
    bodyElement.value.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  if (bodyElement.value) {
    bodyElement.value.removeEventListener('scroll', handleScroll)
  }
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
})
</script>

<style scoped>
.body-viewer {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.empty-body {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-foreground-secondary);
  font-style: italic;
}

.body-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
}

.body-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--color-background-elevation-2);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.body-title {
  font-size: var(--font-size-medium);
  font-weight: 600;
  color: var(--color-foreground);
}

.view-mode-controls {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.view-mode-button {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-background);
  border: none;
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
  border-right: 1px solid var(--color-border);
}

.view-mode-button:last-child {
  border-right: none;
}

.view-mode-button:hover:not(:disabled) {
  background: var(--color-background-hover);
  color: var(--color-foreground);
}

.view-mode-button.active {
  background: var(--color-accent);
  color: white;
}

.view-mode-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.body-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
  flex-shrink: 0;
}

.body-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 180px; /* 固定最小宽度防止跳动 */
  justify-content: flex-end;
}

.content-type {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-weight: 500;
}

.body-size {
  font-family: 'SFMono-Regular', Consolas, monospace;
  opacity: 0.8;
}

.view-toggle-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: var(--spacing-sm);
}

.view-toggle-button:hover {
  background: var(--color-background-hover);
  color: var(--color-foreground);
}

.view-toggle-button.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.auto-scroll-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
}

.auto-scroll-button:hover {
  background: var(--color-background-hover);
  color: var(--color-foreground);
}

.auto-scroll-button.active {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
}

.auto-scroll-button.active .indicator-icon {
  opacity: 1;
}

.auto-scroll-indicator {
  display: flex;
  align-items: center;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.auto-scroll-indicator.active {
  opacity: 1;
  color: var(--color-accent);
}

.indicator-icon {
  font-size: var(--font-size-small);
}

.body-text {
  padding: var(--spacing-md);
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: auto;
  background: var(--color-background);
  transition: opacity 0.2s ease;
  flex: 1;
}

.body-text.loading {
  opacity: 0.6;
}

.body-content-wrapper {
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-xs) var(--spacing-md);
}

.loading-text {
  font-size: var(--font-size-small);
  color: var(--color-accent);
  font-style: italic;
}

/*noinspection CssUnresolvedCustomProperty*/
.error-indicator {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--color-error-background, #fee);
  border-bottom: 1px solid var(--color-error, #f56565);
  padding: var(--spacing-xs) var(--spacing-md);
}

.error-text {
  font-size: var(--font-size-small);
  color: var(--color-error, #f56565);
  font-style: italic;
}
</style>