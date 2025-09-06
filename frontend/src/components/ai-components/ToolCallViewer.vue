<template>
  <div class="tool-call-viewer" :class="toolCallClass">
    <div class="tool-call-header" @click="isExpanded = !isExpanded">
      <div class="tool-call-title">
        <span class="tool-icon">🔧</span>
        <span class="tool-type-badge">{{ props.toolCall.type }}</span>
        <span class="tool-name">{{ toolName }}</span>
      </div>
      <div class="tool-call-controls">
        <span class="expand-icon" :class="{ expanded: isExpanded }">▼</span>
      </div>
    </div>

    <div v-if="isExpanded" class="tool-call-content">
      <!-- Tool Input/Arguments -->
      <div v-if=" props.toolCall.function?.arguments " class="tool-section">
        <span v-if="props.toolCall.id" class="tool-call-id">ID: {{ props.toolCall.id }}</span>

        <div class="section-content" style="margin-top: 10px">
          <pre class="json-content">{{ formatJson(props.toolCall.function?.arguments) }}</pre>
        </div>
      </div>

    </div>
  </div>
</template>

<script lang="ts" setup>
import {ref, computed} from 'vue'
import {OpenAI} from "@/utils/LLMSModels.js";

const props = defineProps<{
  toolCall: OpenAI.ToolCall;
  defaultExpanded?: boolean;
}>();

const isExpanded = ref(props.defaultExpanded)

// 工具名称
const toolName = computed(() => {
  if (props.toolCall.function?.name) {
    return props.toolCall.function.name
  }

  return 'Unknown Tool'
})

// CSS 类名
const toolCallClass = computed(() => {
  const classes = [`tool-type-${props.toolCall.type}`]

  if (isExpanded.value) {
    classes.push('expanded')
  }

  return classes
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

.tool-call-id {
  font-size: var(--font-size-small);
  color: var(--color-foreground-secondary);
  font-family: 'SFMono-Regular', Consolas, monospace;
  background: var(--color-background-elevation-2);
  padding: 3px 0;
  border-radius: 3px;
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
  word-break: break-all;
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
  margin-left: 10px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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