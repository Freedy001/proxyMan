<template>
  <div class="app-container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-title">ProxyMan</div>
      <div class="toolbar-controls">
        <SearchBar />
        <StatusFilters />
        <button class="clear-button" @click="clearRequests" title="Clear all requests">
          🗑️
        </button>
        <ConnectionStatus />
      </div>
    </div>

    <!-- 主内容区域 -->
    <div class="main-content">
      <div class="split-view">
        <!-- 请求列表侧边栏 -->
        <div class="split-view-sidebar" :style="{ width: sidebarWidth + '%' }">
          <RequestList />
        </div>

        <!-- 分割器 -->
        <div 
          class="split-view-resizer" 
          @mousedown="startResize"
        ></div>

        <!-- 详情面板 -->
        <div class="split-view-main">
          <RequestDetails />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRequestsStore } from './stores/requests'
import SearchBar from './components/SearchBar.vue'
import StatusFilters from './components/StatusFilters.vue'
import ConnectionStatus from './components/ConnectionStatus.vue'
import RequestList from './components/RequestList.vue'
import RequestDetails from './components/RequestDetails.vue'

const requestsStore = useRequestsStore()
const sidebarWidth = ref(60)

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
})

onUnmounted(() => {
  requestsStore.disconnect()
})
</script>