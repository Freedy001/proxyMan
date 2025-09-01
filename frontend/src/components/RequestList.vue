<template>
  <div class="requests-container">
    <div class="requests-header">
      <span id="requestCount">{{ requestsStore.requestCount }} requests</span>
    </div>
    
    <div class="requests-table">
      <table class="request-table">
        <thead>
          <tr>
            <th 
              v-for="column in columns" 
              :key="column.key"
              @click="handleSort(column.key)"
              :class="{ 
                'sorted-asc': requestsStore.sortColumn === column.key && requestsStore.sortOrder === 'asc',
                'sorted-desc': requestsStore.sortColumn === column.key && requestsStore.sortOrder === 'desc'
              }"
            >
              {{ column.label }}
              <span v-if="requestsStore.sortColumn === column.key" class="sort-indicator">
                {{ requestsStore.sortOrder === 'asc' ? '↑' : '↓' }}
              </span>
            </th>
          </tr>
        </thead>
        
        <tbody>
          <tr 
            v-for="request in requestsStore.sortedAndFilteredRequests"
            :key="request.id"
            @click="selectRequest(request.id)"
            :class="{
              'selected': requestsStore.selectedRequestId === request.id,
              'new-request': request.isNew
            }"
          >
            <td class="method-cell" :class="requestsStore.getMethodClass(request.method)">
              {{ request.method }}
            </td>
            
            <td class="status-cell" :class="requestsStore.getStatusClass(request.statusCode)">
              {{ request.statusCode || '-' }}
            </td>
            
            <td class="type-cell">
              {{ requestsStore.formatContentType(request.contentType) }}
            </td>
            
            <td class="host-cell" :title="request.host">
              {{ request.host }}
            </td>
            
            <td class="url-cell" :title="request.url">
              {{ getDisplayUrl(request.url) }}
            </td>
            
            <td class="time-cell">
              {{ request.duration || requestsStore.formatTime(request.startTime) }}
            </td>
          </tr>
        </tbody>
      </table>
      
      <div v-if="requestsStore.sortedAndFilteredRequests.length === 0" class="empty-requests">
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No requests found</div>
          <div class="empty-state-description">
            {{ requestsStore.requestCount === 0 ? 'No requests captured yet' : 'No requests match your filters' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRequestsStore } from '../stores/requests'

const requestsStore = useRequestsStore()

const columns = [
  { key: 'method', label: 'Method' },
  { key: 'statusCode', label: 'Status' },
  { key: 'contentType', label: 'Type' },
  { key: 'host', label: 'Host' },
  { key: 'url', label: 'URL' },
  { key: 'startTime', label: 'Time' }
]

const handleSort = (column) => {
  requestsStore.setSorting(column)
}

const selectRequest = (requestId) => {
  requestsStore.selectRequest(requestId)
}

const getDisplayUrl = (url) => {
  if (!url) return ''
  
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname + urlObj.search
    return path.length > 50 ? path.substring(0, 47) + '...' : path
  } catch (e) {
    return url.length > 50 ? url.substring(0, 47) + '...' : url
  }
}
</script>

<style scoped>
.requests-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.requests-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-background-elevation-1);
  border-bottom: 1px solid var(--color-details-hairline);
  font-size: var(--font-size-small);
  font-weight: 500;
  color: var(--color-foreground-secondary);
}

.requests-table {
  flex: 1;
  overflow: auto;
  background: var(--color-background);
}

.request-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: var(--font-size-small);
}

.request-table thead th {
  position: sticky;
  top: 0;
  background: var(--color-background-elevation-1);
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  font-weight: 500;
  color: var(--color-foreground-secondary);
  border-bottom: 1px solid var(--color-details-hairline);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.request-table thead th:hover {
  background: var(--color-background-elevation-2);
}

.request-table thead th.sorted-asc,
.request-table thead th.sorted-desc {
  color: var(--color-accent);
}

.sort-indicator {
  margin-left: 4px;
  font-size: 10px;
}

.request-table tbody tr {
  transition: background-color 0.15s ease;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.request-table tbody tr:hover {
  background: var(--color-background-hover);
}

.request-table tbody tr.selected {
  background: var(--color-background-selected);
}

.request-table tbody tr.new-request {
  animation: highlight-new 0.5s ease-out;
}

@keyframes highlight-new {
  0% {
    background: rgba(0, 122, 204, 0.3);
  }
  100% {
    background: transparent;
  }
}

.request-table tbody td {
  padding: var(--spacing-xs) var(--spacing-md);
  vertical-align: middle;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-cell {
  font-weight: 600;
  text-transform: uppercase;
  min-width: 60px;
}

.status-cell {
  font-weight: 600;
  min-width: 60px;
}

.type-cell {
  font-size: var(--font-size-small);
  font-weight: 500;
  color: var(--color-foreground-secondary);
  text-transform: uppercase;
  min-width: 60px;
}

.url-cell {
  font-family: 'SFMono-Regular', Consolas, monospace;
  max-width: 300px;
}

.host-cell {
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
}

.time-cell {
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  text-align: right;
  min-width: 80px;
}

.empty-requests {
  padding: var(--spacing-xl);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
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
</style>