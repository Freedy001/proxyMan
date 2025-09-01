<template>
  <div class="connection-status">
    <span 
      class="status-dot" 
      :class="{
        'connected': requestsStore.isConnected,
        'connecting': requestsStore.isConnecting,
        'disconnected': !requestsStore.isConnected && !requestsStore.isConnecting
      }"
    ></span>
    <span class="status-text">{{ connectionText }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRequestsStore } from '../stores/requests'

const requestsStore = useRequestsStore()

const connectionText = computed(() => {
  if (requestsStore.isConnected) {
    return 'Connected'
  } else if (requestsStore.isConnecting) {
    return 'Connecting...'
  } else if (requestsStore.connectionError) {
    return 'Connection failed'
  } else {
    return 'Disconnected'
  }
})
</script>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-small);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.status-dot.disconnected {
  background: var(--color-error);
}

.status-dot.connected {
  background: var(--color-success);
}

.status-dot.connecting {
  background: var(--color-warning);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.status-text {
  color: var(--color-foreground-secondary);
}
</style>