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
              v-for="column in columnOrder"
              :key="column.key"
              draggable="true"
              @click="handleSort(column.key)"
              @dragstart="handleDragStart($event, column)"
              @dragend="handleDragEnd"
              @dragover="handleDragOver($event, column)"
              @dragleave="handleDragLeave"
              @drop="handleDrop($event, column)"
              :class="{ 
                'draggable': true,
                'sorted-asc': requestsStore.sortColumn === column.key && requestsStore.sortOrder === 'asc',
                'sorted-desc': requestsStore.sortColumn === column.key && requestsStore.sortOrder === 'desc',
                'drag-over': dragOverColumn?.key === column.key,
                'dragging': draggedColumn?.key === column.key
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
          <td 
              v-for="column in columnOrder" 
              :key="column.key"
              :class="typeof getColumnClass(column.key) === 'function' ? getColumnClass(column.key)(request) : getColumnClass(column.key)"
              :title="getCellTitle(column.key, request)"
          >
            {{ getCellValue(column.key, request) }}
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
import { ref } from 'vue'
import {useRequestsStore} from '../stores/requests'

const requestsStore = useRequestsStore()

// Column order state
const columnOrder = ref([
  {key: 'host', label: 'Host'},
  {key: 'url', label: 'URL'},
  {key: 'statusCode', label: 'Status'},
  {key: 'method', label: 'Method'},
  {key: 'contentType', label: 'Type'},
  {key: 'startTime', label: 'Time'},
  {key: 'duration', label: 'Duration'}
])

// Drag and drop state
const draggedColumn = ref(null)
const dragOverColumn = ref(null)

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

// Drag and drop handlers
const handleDragStart = (event, column) => {
  draggedColumn.value = column
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/html', event.target.innerHTML)
  event.target.style.opacity = '0.5'
}

const handleDragEnd = (event) => {
  event.target.style.opacity = ''
  draggedColumn.value = null
  dragOverColumn.value = null
}

const handleDragOver = (event, column) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverColumn.value = column
}

const handleDragLeave = (event) => {
  event.currentTarget.classList.remove('drag-over')
}

const handleDrop = (event, targetColumn) => {
  event.preventDefault()
  event.currentTarget.classList.remove('drag-over')
  
  if (!draggedColumn.value || draggedColumn.value.key === targetColumn.key) {
    return
  }

  const draggedIndex = columnOrder.value.findIndex(col => col.key === draggedColumn.value.key)
  const targetIndex = columnOrder.value.findIndex(col => col.key === targetColumn.key)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    const newOrder = [...columnOrder.value]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn.value)
    columnOrder.value = newOrder
  }

  draggedColumn.value = null
  dragOverColumn.value = null
}

// Helper functions for dynamic cell rendering
const getColumnClass = (columnKey) => {
  const classMap = {
    'host': 'host-cell',
    'url': 'url-cell',
    'statusCode': (request) => requestsStore.getStatusClass(request.statusCode),
    'method': (request) => requestsStore.getMethodClass(request.method),
    'contentType': 'type-cell',
    'startTime': 'time-cell',
    'duration': 'time-cell'
  }
  return classMap[columnKey] || ''
}

const getCellTitle = (columnKey, request) => {
  if (columnKey === 'host') return request.host
  if (columnKey === 'url') return request.url
  if (columnKey === 'contentType') return requestsStore.formatContentType(request.contentType)
  return ''
}

const getCellValue = (columnKey, request) => {
  switch (columnKey) {
    case 'host':
      return request.host
    case 'url':
      return getDisplayUrl(request.url)
    case 'statusCode':
      return request.statusCode || '-'
    case 'method':
      return request.method
    case 'contentType':
      return requestsStore.formatContentType(request.contentType)
    case 'startTime':
      return new Date(request.startTime).toLocaleString('zh-CN', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    case 'duration':
      return request.duration || 'pending'
    default:
      return ''
  }
}
</script>

<!--suppress CssUnusedSymbol -->
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

/* Drag and drop styles */
.request-table thead th.draggable {
  cursor: move;
  user-select: none;
}

.request-table thead th.dragging {
  opacity: 0.5;
  background: var(--color-background-elevation-2);
}

.request-table thead th.drag-over {
  background: var(--color-background-elevation-2);
  border-left: 3px solid var(--color-accent);
  border-right: 3px solid var(--color-accent);
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

.request-table .type-cell {
  font-size: var(--font-size-small);
  font-weight: 500;
  color: var(--color-foreground-secondary);
  text-transform: uppercase;
  max-width: 80px;
}

.url-cell {
  font-family: 'SFMono-Regular', Consolas, monospace;
  max-width: 300px;
}

.request-table .host-cell {
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-small);
  max-width: 150px;
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