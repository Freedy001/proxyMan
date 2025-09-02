<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

// 禁用所有语言服务的Worker
if (typeof monaco !== 'undefined') {
  // 禁用TypeScript/JavaScript语言服务
  monaco.languages.typescript?.typescriptDefaults?.setWorkerOptions({
    customWorkerPath: undefined
  })
  monaco.languages.typescript?.javascriptDefaults?.setWorkerOptions({
    customWorkerPath: undefined
  })
  
  // 禁用其他语言服务
  if (monaco.languages.json?.jsonDefaults) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: false,
      allowComments: false,
      schemaValidation: 'ignore'
    })
  }
  
  if (monaco.languages.html?.htmlDefaults) {
    monaco.languages.html.htmlDefaults.setOptions({
      validate: false
    })
  }
  
  if (monaco.languages.css?.cssDefaults) {
    monaco.languages.css.cssDefaults.setOptions({
      validate: false
    })
  }
}

const props = defineProps({
  value: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'plaintext'
  },
  theme: {
    type: String,
    default: 'vs-dark'
  },
  readOnly: {
    type: Boolean,
    default: true
  },
  height: {
    type: String,
    default: '300px'
  },
  wordWrap: {
    type: String,
    default: 'on'
  }
})

const emit = defineEmits(['update:value'])

const editorContainer = ref(null)
let editor = null

const initEditor = () => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: props.value,
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    wordWrap: props.wordWrap,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineHeight: 20,
    automaticLayout: true,
    // 代码折叠相关配置
    folding: true,
    foldingStrategy: 'indentation', // 使用缩进策略而不是auto
    showFoldingControls: 'always',
    foldingHighlight: true,
    unfoldOnClickAfterEndOfLine: true,
    // 基本显示配置
    contextmenu: true,
    selectOnLineNumbers: true,
    roundedSelection: false,
    cursorStyle: 'line',
    renderWhitespace: 'selection',
    renderControlCharacters: true,
    renderLineHighlight: 'line',
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
    glyphMargin: false,
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 5,
      useShadows: false
    },
    // 禁用可能触发Worker的智能功能
    quickSuggestions: false,
    parameterHints: { enabled: false },
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: 'off',
    tabCompletion: 'off',
    wordBasedSuggestions: 'off',
    hover: { enabled: false },
    lightbulb: { enabled: false },
    // 保留基本语法高亮但禁用语义功能
    'semanticHighlighting.enabled': false
  })

  // 监听内容变化
  if (!props.readOnly) {
    editor.onDidChangeModelContent(() => {
      emit('update:value', editor.getValue())
    })
  }
}

const updateEditorValue = (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue || '')
  }
}

const updateEditorLanguage = (newLanguage) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
    }
  }
}

const updateEditorTheme = (newTheme) => {
  if (editor) {
    monaco.editor.setTheme(newTheme)
  }
}

const resizeEditor = () => {
  if (editor) {
    editor.layout()
  }
}

// 监听props变化
watch(() => props.value, updateEditorValue)
watch(() => props.language, updateEditorLanguage)
watch(() => props.theme, updateEditorTheme)

onMounted(() => {
  nextTick(() => {
    initEditor()
  })
})

onUnmounted(() => {
  if (editor) {
    editor.dispose()
  }
})

// 暴露方法给父组件使用
defineExpose({
  resizeEditor,
  getEditor: () => editor
})
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: v-bind(height);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  flex: 1;
}
</style>