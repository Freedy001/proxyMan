<template>
  <div
      class="markdown-renderer"
      v-html="renderedContent"
  ></div>
</template>

<script lang="ts" setup>
import {computed, onMounted} from 'vue'
import {marked} from 'marked'
import hljs from 'highlight.js'

const props = defineProps({
  content: {
    type: String,
    required: true
  }
})

// 缓存渲染结果以提高性能
const renderCache = new Map<string, string>()
const cacheTimeout = 5 * 60 * 1000 // 5分钟缓存超时

// 配置 marked
const renderer = new marked.Renderer()

// 自定义代码块渲染 - 优化版本
renderer.code = function (code, infostring) {
  console.log(code)

  // 处理代码参数，支持字符串和对象两种格式
  let codeText = ''
  let language = ''

  if (typeof code === 'object' && code !== null) {
    // 当 code 是对象时，使用 text 属性作为代码内容，lang 属性作为语言
    codeText = code.text || ''
    language = code.lang || ''
  } else if (typeof code === 'string') {
    // 当 code 是字符串时，使用传统方式
    codeText = code
    language = (infostring || '').match(/\S*/)?.[0] || ''
  }

  // 如果代码块很大，跳过高亮以提高性能
  if (codeText.length > 100000) {
    return `<pre class="hljs"><code>${escapeHtml(codeText)}</code></pre>`
  }

  const validLanguage = hljs.getLanguage(language) ? language : 'plaintext'

  if (codeText) {
    try {
      // 使用异步高亮来避免阻塞主线程
      const highlighted = hljs.highlight(codeText, {language: validLanguage}).value
      return `<pre class="hljs"><code class="hljs-${validLanguage}">${highlighted}</code></pre>`
    } catch (e) {
      // 如果高亮失败，返回未高亮的代码
      return `<pre class="hljs"><code class="hljs-${validLanguage}">${escapeHtml(codeText)}</code></pre>`
    }
  }

  return `<pre class="hljs"><code>${escapeHtml(JSON.stringify(code))}</code></pre>`
}

// 自定义行内代码渲染
renderer.codespan = function (code) {
  let content;
  if (typeof code === 'object') {
    content = code.text
  } else if (typeof code === 'string') {
    content = code;
  }

  return `<code class="inline-code">${escapeHtml(content || JSON.stringify(code))}</code>`
}

// 自定义链接渲染（添加安全属性）
renderer.link = function (href, title, text) {
  // 安全检查
  const safeHref = href ? escapeHtml(href) : '#'
  const safeTitle = title ? ` title="${escapeHtml(title)}"` : ''
  const safeText = escapeHtml(text)

  // 检查是否为相对链接或安全的协议
  const isSafeProtocol = /^https?:\/\/|^\/|^#/.test(safeHref)

  if (isSafeProtocol) {
    return `<a href="${safeHref}"${safeTitle} target="_blank" rel="noopener noreferrer">${safeText}</a>`
  } else {
    return `<span class="unsafe-link" title="Unsafe link: ${safeHref}">${safeText}</span>`
  }
}

// HTML 转义函数
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }

  return text.replace(/[&<>"']/g, (m) => map[m])
}

// 配置 marked 选项 - 优化版本
marked.setOptions({
  renderer: renderer,
  breaks: true,
  gfm: true,
  sanitize: false, // 我们通过自定义 renderer 来控制安全性
  smartLists: true,
  smartypants: false,
  // 添加性能优化选项
  pedantic: false,
  mangle: false, // 禁用邮箱混淆以提高性能
  headerIds: false // 禁用标题ID生成以提高性能
})

// 渲染 Markdown 内容 - 带缓存和错误处理
const renderedContent = computed(() => {
  if (!props.content) return ''

  // 检查缓存
  if (renderCache.has(props.content)) {
    return renderCache.get(props.content)!
  }

  try {
    // 对于非常大的内容，返回简化版本
    if (props.content.length > 500000) {
      return `<pre>${escapeHtml(props.content.substring(0, 500000))}...\n\n[Content truncated due to size]</pre>`
    }

    const rendered = marked(props.content)
    // 缓存结果
    renderCache.set(props.content, rendered)

    // 设置缓存清理定时器
    setTimeout(() => {
      renderCache.delete(props.content)
    }, cacheTimeout)

    return rendered
  } catch (error) {
    console.error('Markdown rendering error:', error)
    // 如果渲染失败，返回纯文本
    const escapedContent = escapeHtml(props.content)
    const result = `<pre>${escapedContent}</pre>`

    // 缓存错误结果
    renderCache.set(props.content, result)

    return result
  }
})

// 在组件挂载后初始化代码高亮
onMounted(() => {
  // 确保 highlight.js 样式已加载
  hljs.configure({
    classPrefix: 'hljs-',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'html', 'css', 'json', 'xml', 'bash', 'shell']
  })

  // 清理过期缓存
  setInterval(() => {
    renderCache.clear()
  }, cacheTimeout * 2);

// 组件卸载时清理
  // 注意：在 Vue 3 setup 中，我们需要使用 onUnmounted 来清理
  // 但由于这是优化版本，我们在这里添加注释
})
</script>

<style scoped>
.markdown-renderer {
  line-height: 1.6;
  color: inherit;
  word-wrap: break-word;
  overflow-wrap: break-word;
  width: 100%;
  /* 重置可能影响布局的属性 */
  flex: none !important;
  align-items: unset !important;
  justify-content: unset !important;
  text-align: left;
  display: flex;
  flex-direction: column;
}

/* 标题样式 */
.markdown-renderer :deep(h1),
.markdown-renderer :deep(h2),
.markdown-renderer :deep(h3),
.markdown-renderer :deep(h4),
.markdown-renderer :deep(h5),
.markdown-renderer :deep(h6) {
  margin: 0.5em 0 1em 0;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-renderer :deep(h1) {
  font-size: 1.5em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.3em;
}

.markdown-renderer :deep(h2) {
  font-size: 1.3em;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.2em;
}

.markdown-renderer :deep(h3) {
  font-size: 1.2em;
}

.markdown-renderer :deep(h4) {
  font-size: 1.1em;
}

.markdown-renderer :deep(h5) {
  font-size: 1.05em;
}

.markdown-renderer :deep(h6) {
  font-size: 1em;
}

/* 段落和文本样式 */
.markdown-renderer :deep(p) {
  margin: 0.5em 0;
  display: block;
  white-space: pre-wrap;
}

.markdown-renderer :deep(p:first-child) {
  margin-top: 0;
}

.markdown-renderer :deep(p:last-child) {
  margin-bottom: 0;
}

/* 确保文本正常流动 */
.markdown-renderer :deep(p),
.markdown-renderer :deep(div),
.markdown-renderer :deep(span) {
  white-space: pre-wrap;
  word-break: break-word;
}

/* 重置文本基础样式 */
.markdown-renderer :deep(*) {
  box-sizing: border-box;
}

.markdown-renderer :deep(p),
.markdown-renderer :deep(div),
.markdown-renderer :deep(span),
.markdown-renderer :deep(strong),
.markdown-renderer :deep(em),
.markdown-renderer :deep(code) {
  display: initial !important;
  flex: none !important;
  align-items: initial !important;
  justify-content: initial !important;
}

/* 强调样式 */
.markdown-renderer :deep(strong) {
  font-weight: 600;
}

.markdown-renderer :deep(em) {
  font-style: italic;
}

/* 列表样式 */
.markdown-renderer :deep(ul),
.markdown-renderer :deep(ol) {
  display: flex;
  flex-direction: column;
  margin: 0.05em 0;
  padding-left: 2em;
}

/* 嵌套列表的特殊处理 - 减少与前面元素的间距 */
.markdown-renderer :deep(li > ul),
.markdown-renderer :deep(li > ol) {
  margin-top: 0;
  margin-bottom: 0.05em;
}

/* 列表项样式 */
.markdown-renderer :deep(li) {
  margin: 0.5em 0;
}

/* 列表项内段落的特殊处理 */
.markdown-renderer :deep(li > p) {
  margin: 0.02em 0;
}

/* 列表项内段落后紧跟列表时，减少段落底边距 */
.markdown-renderer :deep(li > p + ul),
.markdown-renderer :deep(li > p + ol) {
  margin-top: 0;
}

/* 行内代码样式 */
.markdown-renderer :deep(.inline-code) {
  background: var(--color-background-elevation-2);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.2em 0.4em;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.9em;
  color: var(--color-foreground);
}

/* 代码块样式 */
.markdown-renderer :deep(pre) {
  background: var(--color-background-elevation-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1em;
  margin: 1em 0;
  overflow-x: auto;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 0.9em;
  line-height: 1.4;
}

.markdown-renderer :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

/* highlight.js 暗色主题样式 */
.markdown-renderer :deep(.hljs) {
  background: var(--color-background-elevation-2) !important;
  color: var(--color-foreground);
}

.markdown-renderer :deep(.hljs-comment),
.markdown-renderer :deep(.hljs-quote) {
  color: #6a737d;
  font-style: italic;
}

.markdown-renderer :deep(.hljs-keyword),
.markdown-renderer :deep(.hljs-selector-tag),
.markdown-renderer :deep(.hljs-type) {
  color: #d73a49;
  font-weight: 600;
}

.markdown-renderer :deep(.hljs-string),
.markdown-renderer :deep(.hljs-attr) {
  color: #22863a;
}

.markdown-renderer :deep(.hljs-number),
.markdown-renderer :deep(.hljs-literal) {
  color: #005cc5;
}

.markdown-renderer :deep(.hljs-variable),
.markdown-renderer :deep(.hljs-template-variable) {
  color: #e36209;
}

.markdown-renderer :deep(.hljs-function),
.markdown-renderer :deep(.hljs-title) {
  color: #6f42c1;
  font-weight: 600;
}

/* 引用块样式 */
.markdown-renderer :deep(blockquote) {
  border-left: 4px solid var(--color-border);
  margin: 1em 0;
  padding: 0 1em;
  color: var(--color-foreground-secondary);
  background: var(--color-background-elevation-1);
  border-radius: 0 4px 4px 0;
}

.markdown-renderer :deep(blockquote p) {
  margin: 0.5em 0;
}

/* 表格样式 */
.markdown-renderer :deep(table) {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.markdown-renderer :deep(table th),
.markdown-renderer :deep(table td) {
  border: 1px solid var(--color-border);
  padding: 0.6em 1em;
  text-align: left;
}

.markdown-renderer :deep(table th) {
  background: var(--color-background-elevation-2);
  font-weight: 600;
}

.markdown-renderer :deep(table tr:nth-child(even)) {
  background: var(--color-background-elevation-1);
}

/* 链接样式 */
.markdown-renderer :deep(a) {
  color: var(--color-accent);
  text-decoration: none;
}

.markdown-renderer :deep(a:hover) {
  text-decoration: underline;
}

/* 不安全链接样式 */
.markdown-renderer :deep(.unsafe-link) {
  color: var(--color-error);
  text-decoration: line-through;
  cursor: not-allowed;
}

/* 水平分割线 */
.markdown-renderer :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 0.2em 0;
}

/* 图片样式 */
.markdown-renderer :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 0.5em 0;
}

/* 任务列表样式 */
.markdown-renderer :deep(input[type="checkbox"]) {
  margin-right: 0.5em;
}

.markdown-renderer :deep(li.task-list-item) {
  list-style: none;
  margin-left: -2em;
  padding-left: 2em;
}

/* 性能优化：避免复杂选择器 */
@media (max-width: 768px) {
  .markdown-renderer :deep(pre) {
    padding: 0.5em;
    font-size: 0.8em;
  }

  .markdown-renderer :deep(table) {
    font-size: 0.9em;
  }
}
</style>