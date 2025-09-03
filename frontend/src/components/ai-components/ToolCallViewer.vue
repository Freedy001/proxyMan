<template>
  <div class="tool-call-viewer" :class="toolCallClass">
    <div class="tool-call-header" @click="toggleExpanded">
      <div class="tool-call-title">
        <span class="tool-icon">🔧</span>
        <span class="tool-name">{{ toolName }}</span>
        <span class="tool-type-badge">{{ toolType }}</span>
      </div>
      <div class="tool-call-controls">
        <span v-if="executionTime" class="execution-time">{{ executionTime }}ms</span>
        <span class="expand-icon" :class="{ expanded: isExpanded }">▼</span>
      </div>
    </div>
    
    <div v-if="isExpanded" class="tool-call-content">
      <!-- Tool Input/Arguments -->
      <div v-if="hasInput" class="tool-section">
        <div class="section-title">
          <span class="section-icon">📥</span>
          Input
        </div>
        <div class="section-content">
          <pre class="json-content">{{ formattedInput }}</pre>
        </div>
      </div>
      
      <!-- Tool Output/Result -->
      <div v-if="hasOutput" class="tool-section">
        <div class="section-title">
          <span class="section-icon">📤</span>
          Output
        </div>
        <div class="section-content">
          <pre class="json-content">{{ formattedOutput }}</pre>
        </div>
      </div>
      
      <!-- Error Information -->
      <div v-if="hasError" class="tool-section error-section">
        <div class="section-title">
          <span class="section-icon">❌</span>
          Error
        </div>
        <div class="section-content">
          <div class="error-message">{{ errorMessage }}</div>
        </div>
      </div>
      
      <!-- Additional Metadata -->
      <div v-if="hasMetadata" class="tool-section metadata-section">
        <div class="section-title">
          <span class="section-icon">📊</span>
          Metadata
        </div>
        <div class="section-content">
          <div class="metadata-grid">
            <div v-if="toolCall.id" class="metadata-item">
              <label>ID:</label>
              <span class="monospace">{{ toolCall.id }}</span>
            </div>
            <div v-if="toolCall.type" class="metadata-item">
              <label>Type:</label>
              <span>{{ toolCall.type }}</span>
            </div>
            <div v-if="toolCall.index !== undefined" class="metadata-item">
              <label>Index:</label>
              <span>{{ toolCall.index }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  toolCall: {
    type: Object,
    required: true
  },
  defaultExpanded: {
    type: Boolean,
    default: false
  }
})

const isExpanded = ref(props.defaultExpanded)

// 工具调用类型检测
const toolType = computed(() => {
  if (props.toolCall.type) {
    return props.toolCall.type
  }
  
  // 推断类型
  if (props.toolCall.function) {
    return 'function'
  }
  
  if (props.toolCall.name && props.toolCall.input) {
    return 'tool_use'
  }
  
  return 'unknown'
})

// 工具名称
const toolName = computed(() => {
  if (props.toolCall.function?.name) {
    return props.toolCall.function.name
  }
  
  if (props.toolCall.name) {
    return props.toolCall.name
  }
  
  return 'Unknown Tool'
})

// CSS 类名
const toolCallClass = computed(() => {
  const classes = [`tool-type-${toolType.value}`]
  
  if (hasError.value) {
    classes.push('has-error')
  }
  
  if (isExpanded.value) {
    classes.push('expanded')
  }
  
  return classes
})

// 输入参数
const toolInput = computed(() => {
  if (props.toolCall.function?.arguments) {
    try {
      return typeof props.toolCall.function.arguments === 'string' 
        ? JSON.parse(props.toolCall.function.arguments)
        : props.toolCall.function.arguments
    } catch {
      return props.toolCall.function.arguments
    }
  }
  
  if (props.toolCall.input) {
    return props.toolCall.input
  }
  
  return null
})

// 输出结果
const toolOutput = computed(() => {
  if (props.toolCall.result) {
    return props.toolCall.result
  }
  
  if (props.toolCall.output) {
    return props.toolCall.output
  }
  
  return null
})

// 错误信息
const errorMessage = computed(() => {
  if (props.toolCall.error) {
    return typeof props.toolCall.error === 'string' 
      ? props.toolCall.error 
      : JSON.stringify(props.toolCall.error, null, 2)
  }
  
  return null
})

// 执行时间
const executionTime = computed(() => {
  if (props.toolCall.execution_time) {
    return props.toolCall.execution_time
  }
  
  if (props.toolCall.duration) {
    return props.toolCall.duration
  }
  
  return null
})

// 条件检查
const hasInput = computed(() => toolInput.value !== null)
const hasOutput = computed(() => toolOutput.value !== null)
const hasError = computed(() => errorMessage.value !== null)
const hasMetadata = computed(() => {
  return props.toolCall.id || props.toolCall.type || props.toolCall.index !== undefined
})

// 格式化 JSON
const formatJson = (obj) => {
  if (obj === null || obj === undefined) {
    return ''
  }
  
  if (typeof obj === 'string') {
    try {
      return JSON.stringify(JSON.parse(obj), null, 2)
    } catch {
      return obj
    }
  }
  
  return JSON.stringify(obj, null, 2)
}

const formattedInput = computed(() => formatJson(toolInput.value))
const formattedOutput = computed(() => formatJson(toolOutput.value))

// 控制方法
const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.tool-call-viewer {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
  transition: all 0.2s ease;
}

.tool-call-viewer:hover {
  border-color: var(--color-accent);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tool-call-viewer.has-error {
  border-color: var(--color-error);
}

.tool-call-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-background-elevation-1);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

.tool-call-header:hover {
  background: var(--color-background-elevation-2);
}

.tool-call-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.tool-icon {
  font-size: var(--font-size-medium);
}

.tool-name {
  font-weight: 600;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--color-foreground);
}

.tool-type-badge {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-accent);
  color: white;
  border-radius: 12px;
  font-size: var(--font-size-small);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.tool-type-function .tool-type-badge {
  background: #3b82f6;
}

.tool-type-tool_use .tool-type-badge {
  background: #10b981;
}

.tool-type-unknown .tool-type-badge {
  background: var(--color-foreground-secondary);
}

.tool-call-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.execution-time {
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

.tool-call-content {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
}

.tool-section {
  margin-bottom: var(--spacing-md);
}

.tool-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
  font-weight: 600;
  color: var(--color-foreground);
  font-size: var(--font-size-small);
}

.section-icon {
  font-size: var(--font-size-medium);
}

.section-content {
  background: var(--color-background-elevation-1);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.json-content {
  margin: 0;
  padding: var(--spacing-sm);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: var(--color-background);
  color: var(--color-foreground);
  max-height: 300px;
  overflow-y: auto;
}

.error-section .section-content {
  border-color: var(--color-error);
  background: var(--color-error-bg);
}

.error-message {
  padding: var(--spacing-sm);
  color: var(--color-error);
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  white-space: pre-wrap;
}

.metadata-section .section-content {
  padding: var(--spacing-sm);
  background: var(--color-background-elevation-2);
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metadata-item label {
  font-weight: 500;
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
}

.metadata-item span {
  font-size: var(--font-size-small);
  color: var(--color-foreground);
}

.monospace {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

/* 动画效果 */
.tool-call-content {
  animation: slideDown 0.2s ease-out;
}

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
.json-content::-webkit-scrollbar {
  width: 6px;
}

.json-content::-webkit-scrollbar-track {
  background: var(--color-background-elevation-1);
}

.json-content::-webkit-scrollbar-thumb {
  background: var(--color-foreground-secondary);
  border-radius: 3px;
}

.json-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-foreground);
}
</style>