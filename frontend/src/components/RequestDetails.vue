<template>
  <div class="details-panel">
    <div v-if="!requestsStore.selectedRequest" class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">Select a request</div>
      <div class="empty-state-description">
        Choose a request from the list to view detailed information
      </div>
    </div>

    <div v-else class="details-content">
      <div class="details-header">
        <div class="details-title">
          {{ requestsStore.selectedRequest.method }} {{ requestsStore.selectedRequest.statusCode || 'Pending' }}
        </div>
        <div class="details-url">{{ requestsStore.selectedRequest.url }}</div>
      </div>

      <div class="details-tabs">
        <button
            v-for="tab in tabs"
            :key="tab.key"
            class="details-tab"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="details-body">
        <div v-if="requestDetails.isLoading.value" class="loading-state">
          <div class="loading-spinner"></div>
          <div>Loading request data...</div>
        </div>

        <div v-else-if="requestDetails.error.value" class="error-state">
          <div class="error-icon">⚠️</div>
          <div class="error-message">{{ requestDetails.error.value }}</div>
        </div>

        <div v-else class="tab-content">
          <!-- Summary Tab -->
          <div v-if="activeTab === 'summary'" class="tab-pane">
            <div class="details-section">
              <div class="details-section-title">Request Summary</div>
              <div class="summary-table-container">
                <table class="summary-table">
                  <tbody>
                  <tr v-for="item in getSummaryData()" :key="item.name" class="summary-row">
                    <td class="summary-name">{{ item.name }}</td>
                    <td class="summary-value" :class="item.valueClass">{{ item.value }}</td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Request Headers Tab -->
          <div v-if="activeTab === 'headers'" class="tab-pane headers-tab-pane">
            <div class="details-section headers-section">
              <div class="details-section-title">Request Headers</div>
              <div v-if="Object.keys(requestDetails.requestHeaders.value).length > 0" class="headers-table-container">
                <table class="headers-table">
                  <thead>
                  <tr>
                    <th class="header-name-col">Name</th>
                    <th class="header-value-col">Value</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="(value, name) in requestDetails.requestHeaders.value" :key="name" class="header-row">
                    <td class="header-name">{{ name }}</td>
                    <td class="header-value">{{ formatHeaderValue(value) }}</td>
                  </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-headers">
                No request headers available
              </div>
            </div>

            <!-- Response Headers Tab -->
            <div class="details-section headers-section">
              <div class="details-section-title">Response Headers</div>
              <div v-if="Object.keys(requestDetails.responseHeaders.value).length > 0" class="headers-table-container">
                <table class="headers-table">
                  <thead>
                  <tr>
                    <th class="header-name-col">Name</th>
                    <th class="header-value-col">Value</th>
                  </tr>
                  </thead>
                  <tbody>
                  <tr v-for="(value, name) in requestDetails.responseHeaders.value" :key="name" class="header-row">
                    <td class="header-name">{{ name }}</td>
                    <td class="header-value">{{ formatHeaderValue(value) }}</td>
                  </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="empty-headers">
                No response headers available
              </div>
            </div>
          </div>

          <!-- Request Body Tab -->
          <div v-if="activeTab === 'request'" class="tab-pane">
            <div class="details-section">
              <BodyViewer
                  :body="requestDetails.requestBody.value"
                  :headers="requestDetails.requestHeaders.value"
                  :finished="requestDetails.requestState.value>=1"
                  :view-mode="requestViewMode"
                  :auto-scroll="true"
                  label="Request Body"
                  @update:view-mode="requestViewMode = $event"
              />
            </div>
          </div>

          <!-- Response Body Tab -->
          <div v-if="activeTab === 'response'" class="tab-pane">
            <div class="details-section">
              <BodyViewer
                  :body="requestDetails.responseBody.value"
                  :headers="requestDetails.responseHeaders.value"
                  :finished="requestDetails.requestState.value>=3"
                  :view-mode="responseViewMode"
                  :auto-scroll="false"
                  label="Response Body"
                  @update:view-mode="responseViewMode = $event"
              />
            </div>
          </div>

          <!-- AI Chat Tab -->
          <div v-if="activeTab === 'ai-chat'" class="tab-pane">
            <div class="details-section">
              <ChatViewer
                  :request-body="requestDetails.requestBody.value"
                  :response-body="requestDetails.responseBody.value"
                  :url="requestsStore.selectedRequest?.url || ''"
                  :finished="requestDetails.requestState.value>=3"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, watch, computed} from 'vue'
import {useRequestsStore} from '../stores/requests'
import {useRequestDetails} from '../composables/useRequestDetails'
import {isAIRequest} from '../utils/aiDetector'
import BodyViewer from './BodyViewer.vue'
import ChatViewer from './ai-components/ChatViewer.vue'

const requestsStore = useRequestsStore()
const requestDetails = useRequestDetails()

const activeTab = ref('summary')
const requestViewMode = ref('raw')
const responseViewMode = ref('raw')

// 检测是否为 AI 请求
const isAIConversation = computed(() => {
  const request = requestsStore.selectedRequest
  if (!request) return false
  
  return isAIRequest(request.url, request.method, request.headers || {})
})

// 动态生成 tabs
const tabs = computed(() => {
  const baseTabs = [
    {key: 'summary', label: 'Summary'},
    {key: 'headers', label: 'Headers'},
    {key: 'request', label: 'Request'},
    {key: 'response', label: 'Response'}
  ]
  
  // 如果是 AI 请求，在 response 后添加 AI Chat tab
  if (isAIConversation.value) {
    baseTabs.push({key: 'ai-chat', label: 'AI Chat'})
  }
  
  return baseTabs
})

// Watch for selected request changes
watch(() => requestsStore.selectedRequestId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    requestDetails.clearDetails()
    requestDetails.loadRequestDetails(newId)
    activeTab.value = 'summary'
  } else if (!newId) {
    requestDetails.clearDetails()
  }
}, {immediate: true})

const getSummaryData = () => {
  const request = requestsStore.selectedRequest
  if (!request) return []

  const summaryItems = [
    {
      name: 'Request ID',
      value: request.id || 'N/A',
      valueClass: 'value-monospace'
    },
    {
      name: 'Method',
      value: request.method || 'N/A',
      valueClass: `value-method ${requestsStore.getMethodClass(request.method)}`
    },
    {
      name: 'URL',
      value: request.url || 'N/A',
      valueClass: 'value-url'
    },
    {
      name: 'Host',
      value: request.host || 'N/A',
      valueClass: 'value-monospace'
    },
    {
      name: 'Status',
      value: request.status || 'Pending',
      valueClass: 'value-normal'
    }
  ]

  // Status information
  if (request.statusCode) {
    summaryItems.push({
      name: 'Status Code',
      value: request.statusCode,
      valueClass: `value-status ${requestsStore.getStatusClass(request.statusCode)}`
    })
  }

  // Content type
  if (request.contentType) {
    summaryItems.push({
      name: 'Content Type',
      value: request.contentType,
      valueClass: 'value-monospace'
    })
  }

  // Timing information
  if (request.startTime) {
    summaryItems.push({
      name: 'Start Time',
      value: new Date(request.startTime).toLocaleString(),
      valueClass: 'value-normal'
    })
  }

  if (request.endTime) {
    summaryItems.push({
      name: 'End Time',
      value: new Date(request.endTime).toLocaleString(),
      valueClass: 'value-normal'
    })
  }

  if (request.duration) {
    summaryItems.push({
      name: 'Duration',
      value: request.duration,
      valueClass: 'value-duration'
    })
  }
  return summaryItems
}

const formatHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return String(value)
}
</script>

<!--suppress CssUnusedSymbol -->
<style scoped>
.details-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-foreground-secondary);
  text-align: center;
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-lg);
  opacity: 0.5;
}

.empty-state-title {
  font-size: var(--font-size-large);
  margin-bottom: var(--spacing-sm);
}

.empty-state-description {
  font-size: var(--font-size-normal);
  color: var(--color-foreground-disabled);
}

.details-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.details-header {
  padding: var(--spacing-lg);
  background: var(--color-background-elevation-2);
  border-bottom: 1px solid var(--color-details-hairline);
  flex-shrink: 0;
  max-height: 100px;
  overflow-y: auto;
}

.details-title {
  font-size: var(--font-size-large);
  font-weight: 600;
  margin-bottom: var(--spacing-xs);
}

.details-url {
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: var(--color-foreground-secondary);
  word-break: break-all;
  font-size: var(--font-size-small);
  line-height: 1.4;
  max-height: 2.8em;
  overflow-y: auto;
  padding: 2px 0;
}

.details-tabs {
  display: flex;
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-details-hairline);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-foreground-secondary) transparent;
}

.details-tabs::-webkit-scrollbar {
  height: 4px;
}

.details-tabs::-webkit-scrollbar-track {
  background: transparent;
}

.details-tabs::-webkit-scrollbar-thumb {
  background: var(--color-foreground-secondary);
  border-radius: 2px;
}

.details-tabs::-webkit-scrollbar-thumb:hover {
  background: var(--color-foreground);
}

.details-tab {
  padding: var(--spacing-md) var(--spacing-lg);
  background: none;
  border: none;
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-normal);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.details-tab:hover {
  color: var(--color-foreground);
  background: var(--color-background-hover);
}

.details-tab.active {
  color: var(--color-accent);
}

.details-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-accent);
}

.details-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-foreground-secondary);
  text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-md);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.error-icon {
  font-size: 32px;
  margin-bottom: var(--spacing-md);
}

.error-message {
  color: var(--color-error);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-pane {
  animation: fadeIn 0.2s ease-in;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-lg);
}

/* Headers标签页特殊样式 - 允许滚动 */
.headers-tab-pane {
  overflow-y: auto;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.details-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

/* Headers标签页中的section样式 */
.headers-section {
  flex-shrink: 0;
  overflow: visible;
}

.details-section-title {
  font-size: var(--font-size-medium);
  font-weight: 600;
  margin-bottom: var(--spacing-md);
  color: var(--color-foreground);
}

.json-viewer {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
  line-height: 1.5;
  max-height: 400px;
  overflow: auto;
}

.json-content {
  padding: var(--spacing-md);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

/* Summary table styles */
.summary-table-container {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-small);
}

.summary-row {
  border-bottom: 1px solid var(--color-details-hairline);
}

.summary-row:hover {
  background: var(--color-background-hover);
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-name {
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-info);
  font-weight: 500;
  vertical-align: top;
  word-break: break-word;
  width: 30%;
  min-width: 150px;
}

.summary-value {
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-foreground);
  vertical-align: top;
  line-height: 1.4;
  width: 70%;
}

/* Summary value type styles */
.value-monospace {
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.value-url {
  font-family: 'SFMono-Regular', Consolas, monospace;
  word-break: break-all;
}

.value-normal {
  color: var(--color-foreground);
}

.value-duration {
  font-weight: 500;
  color: var(--color-accent);
}

.value-method {
  font-weight: 600;
  text-transform: uppercase;
}

.value-status {
  font-weight: 600;
}

/* Method-specific colors */
.value-method.method-get {
  color: #10b981;
}

.value-method.method-post {
  color: #3b82f6;
}

.value-method.method-put {
  color: #f59e0b;
}

.value-method.method-delete {
  color: #ef4444;
}

.value-method.method-patch {
  color: #8b5cf6;
}

/* Status code colors */
.value-status.status-2xx {
  color: #10b981;
}

.value-status.status-3xx {
  color: #f59e0b;
}

.value-status.status-4xx {
  color: #ef4444;
}

.value-status.status-5xx {
  color: #dc2626;
}

/* Headers table styles */
.headers-table-container {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.headers-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
}

.headers-table th {
  background: var(--color-background-elevation-1);
  color: var(--color-foreground-secondary);
  font-weight: 600;
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--color-details-hairline);
  font-size: var(--font-size-small);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-name-col {
  width: 30%;
  min-width: 150px;
}

.header-value-col {
  width: 70%;
}

.header-row {
  border-bottom: 1px solid var(--color-details-hairline);
}

.header-row:hover {
  background: var(--color-background-hover);
}

.header-row:last-child {
  border-bottom: none;
}

.header-name {
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-info);
  font-weight: 500;
  vertical-align: top;
  word-break: break-word;
}

.header-value {
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-foreground);
  vertical-align: top;
  word-break: break-all;
  line-height: 1.4;
}

.empty-headers {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-foreground-secondary);
  font-style: italic;
}
</style>