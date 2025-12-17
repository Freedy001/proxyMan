<template>
  <div class="app-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-title">{{ showTitle ? 'ProxyMan' : '' }}</div>
      <div class="toolbar-controls">
        <SearchBar/>
        <StatusFilters/>
        <button class="clear-button" @click="clearRequests" title="Clear all requests">
          🗑️
        </button>
        <ConnectionStatus/>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <div class="split-view">
        <!-- 请求列表侧边栏 -->
        <div class="split-view-sidebar" :style="{ width: sidebarWidth + '%' }">
          <RequestList/>
        </div>

        <!-- 分割器 -->
        <div
            class="split-view-resizer"
            @mousedown="startResize"
        ></div>

        <!-- 详情面板 -->
        <div class="split-view-main">
          <RequestDetails/>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <ProxyStatus/>
      <UpstreamProxyStatus/>
      <CertificateStatus/>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted, onUnmounted} from 'vue'
import {useRequestsStore} from './stores/requests'
import SearchBar from './components/SearchBar.vue'
import StatusFilters from './components/StatusFilters.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import RequestList from './components/RequestList.vue'
import RequestDetails from './components/RequestDetails.vue'
import ProxyStatus from './components/status-bar/ProxyStatus.vue'
import UpstreamProxyStatus from './components/status-bar/UpstreamProxyStatus.vue'
import CertificateStatus from './components/status-bar/CertificateStatus.vue'
import {isMacOS, isWailsEnvironment} from './utils/Environment.ts'

const requestsStore = useRequestsStore()
const sidebarWidth = ref(60)
const showTitle = ref(true) // 默认显示标题

let isResizing = false

const startResize = () => {
  isResizing = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
}

const handleResize = (e) => {
  if (!isResizing) return

  const containerWidth = e.target.closest('.split-view').offsetWidth
  const newWidth = (e.clientX / containerWidth) * 100

  if (newWidth >= 30 && newWidth <= 80) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = 'default'
}

const clearRequests = () => {
  requestsStore.clearRequests()
}

onMounted(() => {
  requestsStore.connect()

  // 检查环境并设置是否显示标题
  // 只有 Wails 环境下的 macOS 才隐藏标题（因为系统标题栏会显示应用名）
  if (isWailsEnvironment()) {
    isMacOS().then(isMac => {
      showTitle.value = !isMac // macOS 隐藏，Windows/Linux 显示
    })
  }
})

onUnmounted(() => {
  requestsStore.disconnect()
})
</script>
<style scoped>

.toolbar {
  --wails-draggable: drag;
  /* 禁用文本选择和设置默认光标 */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.status-bar {
  --wails-draggable: drag;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  z-index: 100;
  /* 禁用文本选择和设置默认光标 */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
}

.main-content {
  padding-bottom: 48px;
}
</style>
