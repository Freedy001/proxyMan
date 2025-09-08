<template>
  <div class="filters-container">
    <div class="status-filter">
      <div 
        v-for="filter in statusFilters"
        :key="filter.value"
        class="filter-chip"
        :class="{ active: requestsStore.statusFilter === filter.value }"
        @click="setStatusFilter(filter.value)"
      >
        {{ filter.label }}
      </div>
    </div>
    
    <div class="status-filter">
      <div 
        v-for="filter in contentTypeFilters"
        :key="filter.value"
        class="filter-chip"
        :class="{ active: requestsStore.contentTypeFilter === filter.value }"
        @click="setContentTypeFilter(filter.value)"
      >
        {{ filter.label }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRequestsStore } from '../stores/requests'

const requestsStore = useRequestsStore()

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: '2xx', label: '2xx' },
  { value: '3xx', label: '3xx' },
  { value: '4xx', label: '4xx' },
  { value: '5xx', label: '5xx' }
]

const contentTypeFilters = [
  { value: 'all', label: 'All Types' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'image', label: 'Image' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JS' },
  { value: 'event-stream', label: 'Event Stream' }
]

const setStatusFilter = (filter) => {
  requestsStore.setStatusFilter(filter)
}

const setContentTypeFilter = (filter) => {
  requestsStore.setContentTypeFilter(filter)
}
</script>

<style scoped>
.filters-container {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.status-filter {
  display: flex;
  gap: var(--spacing-xs);
}

.filter-chip {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-background-elevation-2);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;
}

.filter-chip:hover {
  background: var(--color-background-hover);
}

.filter-chip.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
}
</style>