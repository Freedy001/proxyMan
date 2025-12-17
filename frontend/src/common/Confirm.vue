<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="visible" class="confirm-overlay" @click="handleCancel">
        <Transition name="confirm-scale">
          <div v-if="visible" class="confirm-dialog" @click.stop>
            <div class="confirm-header">
              <div class="confirm-icon" :class="`confirm-icon-${type}`">
                {{ getIcon(type) }}
              </div>
              <h3 class="confirm-title">{{ title }}</h3>
            </div>
            <div class="confirm-body">
              <p class="confirm-message">{{ message }}</p>
            </div>
            <div class="confirm-footer">
              <button class="confirm-btn confirm-btn-cancel" @click="handleCancel">
                {{ cancelText }}
              </button>
              <button class="confirm-btn confirm-btn-confirm" @click="handleConfirm">
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'

const visible = ref(false)
const title = ref('')
const message = ref('')
const type = ref('warning')
const confirmText = ref('确定')
const cancelText = ref('取消')
let resolvePromise = null

const getIcon = (iconType) => {
  const icons = {
    warning: '⚠️',
    danger: '🚨',
    info: 'ℹ️',
    question: '❓'
  }
  return icons[iconType] || '❓'
}

const show = (options = {}) => {
  title.value = options.title || '确认操作'
  message.value = options.message || ''
  type.value = options.type || 'warning'
  confirmText.value = options.confirmText || '确定'
  cancelText.value = options.cancelText || '取消'
  visible.value = true

  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const handleConfirm = () => {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(true)
    resolvePromise = null
  }
}

const handleCancel = () => {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }
}

defineExpose({ show })
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  background: #1f2937;
  border-radius: 12px;
  width: 90%;
  max-width: 440px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 24px 16px;
}

.confirm-icon {
  font-size: 32px;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.confirm-icon-warning {
  background: rgba(245, 158, 11, 0.1);
}

.confirm-icon-danger {
  background: rgba(239, 68, 68, 0.1);
}

.confirm-icon-info {
  background: rgba(59, 130, 246, 0.1);
}

.confirm-icon-question {
  background: rgba(139, 92, 246, 0.1);
}

.confirm-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.confirm-body {
  padding: 0 24px 24px;
  margin-left: 64px;
}

.confirm-message {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.8);
}

.confirm-footer {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  justify-content: flex-end;
}

.confirm-btn {
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.confirm-btn-cancel {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.confirm-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 1);
}

.confirm-btn-confirm {
  background: #ef4444;
  color: white;
}

.confirm-btn-confirm:hover {
  background: #dc2626;
}

/* 过渡动画 */
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.3s ease;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
}

.confirm-scale-enter-active,
.confirm-scale-leave-active {
  transition: all 0.3s ease;
}

.confirm-scale-enter-from,
.confirm-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
