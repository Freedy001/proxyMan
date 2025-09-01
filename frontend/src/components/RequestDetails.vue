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
        <!-- Debug info -->
        <div style="background: #2d2d2d; padding: 10px; margin-bottom: 10px; font-size: 12px; color: #888;">
          Debug: isLoading={{ requestDetails.isLoading }}, error={{ requestDetails.error }}, 
          hasRequestHeaders={{ Object.keys(requestDetails.requestHeaders).length > 0 }},
          hasResponseHeaders={{ Object.keys(requestDetails.responseHeaders).length > 0 }}
        </div>
        
        <div v-if="requestDetails.isLoading" class="loading-state">
          <div class="loading-spinner"></div>
          <div>Loading request data...</div>
        </div>

        <div v-else-if="requestDetails.error" class="error-state">
          <div class="error-icon">⚠️</div>
          <div class="error-message">{{ requestDetails.error }}</div>
        </div>

        <div v-else class="tab-content">
          <!-- Summary Tab -->
          <div v-if="activeTab === 'summary'" class="tab-pane">
            <div class="details-section">
              <div class="details-section-title">Request Summary</div>
              <div class="json-viewer">
                <pre class="json-content">{{ formatRequestSummary() }}</pre>
              </div>
            </div>
            
            <div v-if="requestDetails.metadata" class="details-section">
              <div class="details-section-title">Response Summary</div>
              <div class="json-viewer">
                <pre class="json-content">{{ requestDetails.formatJson(requestDetails.metadata) }}</pre>
              </div>
            </div>
          </div>

          <!-- Headers Tab -->
          <div v-if="activeTab === 'headers'" class="tab-pane">
            <div class="details-section">
              <div class="details-section-title">Request Headers</div>
              <div class="json-viewer">
                <pre class="json-content">{{ 
                  Object.keys(requestDetails.requestHeaders).length > 0 
                    ? requestDetails.formatJson(requestDetails.requestHeaders) 
                    : 'No request headers available' 
                }}</pre>
              </div>
            </div>
            
            <div class="details-section">
              <div class="details-section-title">Response Headers</div>
              <div class="json-viewer">
                <pre class="json-content">{{ 
                  Object.keys(requestDetails.responseHeaders).length > 0 
                    ? requestDetails.formatJson(requestDetails.responseHeaders) 
                    : 'No response headers available' 
                }}</pre>
              </div>
            </div>
          </div>

          <!-- Request Tab -->
          <div v-if="activeTab === 'request'" class="tab-pane">
            <div class="details-section">
              <div class="details-section-title">Raw Request Body</div>
              <div class="json-viewer">
                <pre class="json-content">{{ 
                  requestDetails.requestBody || 'No request body'
                }}</pre>
              </div>
            </div>
          </div>

          <!-- Response Tab -->
          <div v-if="activeTab === 'response'" class="tab-pane">
            <div class="details-section">
              <div class="details-section-title">Raw Response Body</div>
              <div class="json-viewer">
                <pre class="json-content">{{ 
                  formatResponseBody()
                }}</pre>
              </div>
            </div>
          </div>

          <!-- Timing Tab -->
          <div v-if="activeTab === 'timing'" class="tab-pane">
            <div class="details-section">
              <div class="details-section-title">Request Timing</div>
              <div class="json-viewer">
                <pre class="json-content">{{ formatTimingInfo() }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, watchEffect } from 'vue'
import { useRequestsStore } from '../stores/requests'
import { useRequestDetails } from '../composables/useRequestDetails'

const requestsStore = useRequestsStore()
const requestDetails = useRequestDetails()

const activeTab = ref('summary')

// Debug reactive state changes
watchEffect(() => {
  console.log('RequestDetails component - isLoading changed:', requestDetails.isLoading.value)
  console.log('RequestDetails component - error:', requestDetails.error.value)
  console.log('RequestDetails component - requestHeaders keys:', Object.keys(requestDetails.requestHeaders.value))
  console.log('RequestDetails component - responseHeaders keys:', Object.keys(requestDetails.responseHeaders.value))
})

const tabs = [
  { key: 'summary', label: 'Summary' },
  { key: 'headers', label: 'Headers' },
  { key: 'request', label: 'Request' },
  { key: 'response', label: 'Response' },
  { key: 'timing', label: 'Timing' }
]

// Watch for selected request changes
watch(() => requestsStore.selectedRequestId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    requestDetails.clearDetails()
    requestDetails.loadRequestDetails(newId)
    activeTab.value = 'summary'
  } else if (!newId) {
    requestDetails.clearDetails()
  }
}, { immediate: true })

const formatRequestSummary = () => {
  const request = requestsStore.selectedRequest
  if (!request) return 'No request selected'

  return requestDetails.formatJson({
    id: request.id,
    method: request.method,
    url: request.url,
    host: request.host,
    startTime: request.startTime,
    endTime: request.endTime,
    status: request.status,
    contentType: request.contentType,
    statusCode: request.statusCode
  })
}

const formatResponseBody = () => {
  const body = requestDetails.responseBody
  const contentType = requestsStore.selectedRequest?.contentType
  
  if (!body) return 'No response body'
  
  return requestDetails.formatBody(body, contentType)
}

const formatTimingInfo = () => {
  const request = requestsStore.selectedRequest
  if (!request) return 'No timing information available'

  const timing = {
    startTime: request.startTime,
    endTime: request.endTime,
    status: request.status,
    duration: calculateDuration(request.startTime, request.endTime)
  }

  return requestDetails.formatJson(timing)
}

const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 'N/A'
  
  try {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const duration = end - start
    
    if (duration < 1000) {
      return `${duration}ms`
    } else {
      return `${(duration / 1000).toFixed(2)}s`
    }
  } catch (e) {
    return 'N/A'
  }
}
</script>

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
}

.details-tabs {
  display: flex;
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-details-hairline);
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
  overflow: auto;
  padding: var(--spacing-lg);
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 32px;
  margin-bottom: var(--spacing-md);
}

.error-message {
  color: var(--color-error);
}

.tab-pane {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.details-section {
  margin-bottom: var(--spacing-xl);
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
</style>