<template>
  <div class="collapsible-tool-message">
    <div class="tool-message-header" @click="toggleExpanded">
      <div class="tool-message-title">
        <span class="tool-icon">🛠️</span>
        <span class="tool-label">Tool Response</span>
        <span class="content-preview" v-if="!isExpanded && contentPreview">{{ contentPreview }}</span>
      </div>
      <div class="tool-message-controls">
        <span class="content-length">{{ contentLength }}</span>
        <span class="expand-icon" :class="{ expanded: isExpanded }">▼</span>
      </div>
    </div>
    
    <div v-if="isExpanded" class="tool-message-content">
      <MarkdownRenderer 
        v-if="message.role === 'tool'"
        :content="getTextContent(message)"
        class="tool-message-text"
      />
      <div v-else class="tool-message-text">{{ getTextContent(message) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  defaultExpanded: {
    type: Boolean,
    default: false
  },
  collapseThreshold: {
    type: Number,
    default: 500 // 字符数阈值，超过此数字自动折叠
  }
})

const isExpanded = ref(props.defaultExpanded)

// 获取文本内容
const getTextContent = (message) => {
  if (typeof message.content === 'string') {
    return message.content
  }
  
  if (Array.isArray(message.content)) {
    const textParts = message.content
      .filter(part => part.type === 'text')
      .map(part => {
        if (typeof part.text === 'string') {
          return part.text
        } else if (part.text && typeof part.text === 'object') {
          try {
            return JSON.stringify(part.text, null, 2)
          } catch (err) {
            return String(part.text)
          }
        }
        return String(part.text || '')
      })
    return textParts.join('\n')
  }
  
  if (message.content && typeof message.content === 'object') {
    try {
      return JSON.stringify(message.content, null, 2)
    } catch (err) {
      return String(message.content)
    }
  }
  
  return String(message.content || '')
}

// 内容长度
const contentLength = computed(() => {
  const text = getTextContent(props.message)
  const length = text.length
  
  if (length > 1000) {
    return `${Math.round(length / 1000 * 10) / 10}K chars`
  }
  return `${length} chars`
})

// 内容预览
const contentPreview = computed(() => {
  const text = getTextContent(props.message)
  if (text.length <= 50) return ''
  
  // 获取前50个字符，在单词边界处截断
  let preview = text.substring(0, 50)
  const lastSpace = preview.lastIndexOf(' ')
  if (lastSpace > 30) {
    preview = preview.substring(0, lastSpace)
  }
  return preview + '...'
})

// 自动判断是否应该折叠
const shouldAutoCollapse = computed(() => {
  const text = getTextContent(props.message)
  return text.length > props.collapseThreshold
})

// 初始化展开状态
if (!props.defaultExpanded && shouldAutoCollapse.value) {
  isExpanded.value = false
} else if (!shouldAutoCollapse.value) {
  isExpanded.value = true
}

// 控制方法
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.collapsible-tool-message {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
  transition: all 0.2s ease;
}

.collapsible-tool-message:hover {
  border-color: var(--color-warning);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tool-message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background-elevation-1);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
  border-left: 3px solid var(--color-warning);
}

.tool-message-header:hover {
  background: var(--color-background-elevation-2);
}

.tool-message-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.tool-icon {
  font-size: var(--font-size-medium);
}

.tool-label {
  font-weight: 600;
  color: var(--color-warning);
  font-size: var(--font-size-small);
}

.content-preview {
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  font-family: 'SFMono-Regular', Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.tool-message-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.content-length {
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.expand-icon {
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.tool-message-content {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
  animation: slideDown 0.2s ease-out;
}

.tool-message-text {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  color: var(--color-foreground);
}

/* 动画效果 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 滚动条样式 */
.tool-message-text::-webkit-scrollbar {
  width: 6px;
}

.tool-message-text::-webkit-scrollbar-track {
  background: var(--color-background-elevation-1);
}

.tool-message-text::-webkit-scrollbar-thumb {
  background: var(--color-foreground-secondary);
  border-radius: 3px;
}

.tool-message-text::-webkit-scrollbar-thumb:hover {
  background: var(--color-foreground);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .content-preview {
    max-width: 150px;
  }
  
  .tool-message-header {
    padding: var(--spacing-xs) var(--spacing-sm);
  }
}
</style>