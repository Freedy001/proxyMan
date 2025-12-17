<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup>
import {ref, onMounted, onUnmounted, watch, nextTick} from 'vue'
// 使用按需加载的 Monaco 配置，减少包体积
import monaco from '@/utils/MonacoConfig';


const editorContainer = ref(null);
let editor = null;
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
  }
})
const emit = defineEmits(['update:value'])


const initEditor = () => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: props.value,
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    wordWrap: 'off',
    wordWrapColumn: 0,
    wordWrapMinified: false,
    wrappingIndent: 'none',
    wordWrapOverride1: 'off',
    wordWrapOverride2: 'off',
    minimap: { enabled: true},
    scrollBeyondLastLine: false,
    fontSize: 12,
    lineHeight: 18,
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
    parameterHints: {enabled: false},
    suggestOnTriggerCharacters: false,
    acceptSuggestionOnEnter: 'off',
    tabCompletion: 'off',
    wordBasedSuggestions: 'off',
    hover: {enabled: false},
    lightbulb: {enabled: false},
    // 保留基本语法高亮但禁用语义功能
    'semanticHighlighting.enabled': false
  })

  // 监听内容变化
  if (!props.readOnly) {
    editor.onDidChangeModelContent(() => {
      emit('update:value', editor.getValue())
    })
  }

  setTimeout(() => formatEditorContent(), 500) //等待初始化完毕
}

const updateEditorValue = (newValue) => {
  if (editor && editor.getValue() !== newValue) {
    editor.setValue(newValue || '')
    formatEditorContent()
  }
}

const updateEditorLanguage = (newLanguage) => {
  if (editor) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLanguage)
      formatEditorContent()
    }
  }
}

const updateEditorTheme = (newTheme) => {
  if (editor) {
    monaco.editor.setTheme(newTheme)
  }
}

// 提供一个格式化函数
function formatEditorContent() {
  if (!editor) return;

  // 1. 保存当前状态
  const isCurrentlyReadOnly = editor.getOption(monaco.editor.EditorOption.readOnly);

  // 如果当前不是只读，直接格式化即可
  if (!isCurrentlyReadOnly) {
    editor.getAction('editor.action.formatDocument').run();
    return;
  }

  // --- 核心逻辑 ---
  // 2. 临时设置为可写
  editor.updateOptions({readOnly: false});

  // 3. 执行格式化
  const formatAction = editor.getAction('editor.action.formatDocument');

  if (formatAction) {
    // 格式化动作是异步的，返回一个 Promise
    formatAction.run().then(() => {
      // 4. 在格式化完成后，恢复原来的只读状态
      editor.updateOptions({readOnly: true});
    }).catch(error => {
      console.error('格式化失败:', error);
      // 即使失败也要恢复只读状态
      editor.updateOptions({readOnly: true});
    });
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