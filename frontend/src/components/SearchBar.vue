<template>
  <div class="search-container">
    <span class="search-icon">🔍</span>
    <input 
      type="text" 
      class="search-input" 
      :value="requestsStore.searchQuery"
      @input="handleSearchInput"
      placeholder="Search requests... (method:GET, status:200, domain:example.com)"
    >
    <button 
      v-if="requestsStore.searchQuery"
      class="clear-search-button"
      @click="clearSearch"
      title="Clear search"
    >
      ✕
    </button>
  </div>
</template>

<script setup>
import { useRequestsStore } from '../stores/requests'

const requestsStore = useRequestsStore()

const handleSearchInput = (event) => {
  requestsStore.setSearchQuery(event.target.value)
}

const clearSearch = () => {
  requestsStore.setSearchQuery('')
}
</script>

<style scoped>
.search-container {
  position: relative;
  min-width: 300px;
}

.search-input {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-md);
  padding-left: 32px;
  padding-right: 32px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-foreground);
  font-size: var(--font-size-normal);
  font-family: 'SFMono-Regular', Consolas, monospace;
  transition: border-color 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.search-input::placeholder {
  color: var(--color-foreground-disabled);
}

.search-icon {
  position: absolute;
  left: var(--spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-foreground-secondary);
  font-size: var(--font-size-normal);
  pointer-events: none;
}

.clear-search-button {
  position: absolute;
  right: var(--spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-foreground-secondary);
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  font-size: 12px;
  line-height: 1;
  transition: all 0.2s ease;
}

.clear-search-button:hover {
  color: var(--color-foreground);
  background: var(--color-background-hover);
}
</style>