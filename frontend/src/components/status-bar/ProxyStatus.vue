<template>
  <div class="proxy-status">
    <div class="status-label">代理地址:</div>
    <div class="status-value-wrapper" @mouseenter="showTooltip = true" @mouseleave="showTooltip = false">
      <div
          class="status-value clickable"
          @click="showChangeDialog = true"
          :class="{ 'has-error': !isActive }">
        <span v-if="!isActive" class="error-icon">⚠️</span>
        {{ proxyAddress }}
      </div>
      <!-- 自定义 tooltip -->
      <div v-if="errorMsg && showTooltip" class="custom-tooltip">
        {{ errorMsg }}
      </div>
    </div>

    <!-- 修改代理配置对话框 -->
    <Teleport to="body">
      <div v-if="showChangeDialog" class="modal-overlay" @click="showChangeDialog = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>修改代理配置</h3>
            <button class="close-btn" @click="showChangeDialog = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="input-group">
              <label>监听地址:</label>
              <input
                  v-model="newHost"
                  type="text"
                  placeholder="输入监听地址 (如: 127.0.0.1 或 0.0.0.0)"
                  @keyup.enter="handleChangeProxy"
              />
              <div class="input-hint">
                <span>• 127.0.0.1 - 仅本机访问</span>
                <span>• 0.0.0.0 - 允许局域网访问</span>
              </div>
            </div>
            <div class="input-group">
              <label>端口 (1024-65535):</label>
              <input
                  v-model.number="newPort"
                  type="number"
                  min="1024"
                  max="65535"
                  placeholder="输入新端口号"
                  @keyup.enter="handleChangeProxy"
              />
            </div>
            <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
            <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showChangeDialog = false">取消</button>
            <button class="btn-primary" @click="handleChangeProxy">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import {ref, onMounted, computed} from 'vue'
import {ApiClient} from '@/utils/ApiClient'

const proxyHost = ref('127.0.0.1')
const proxyPort = ref(8888)
const newHost = ref('127.0.0.1')
const newPort = ref(8888)
const isActive = ref(false)
const showChangeDialog = ref(false)
const showTooltip = ref(false)

const errorMessage = ref('')
const successMessage = ref('')
const errorMsg = ref('')

const proxyAddress = computed(() => {
  return isActive.value ? `http://${proxyHost.value}:${proxyPort.value}` : "端口监听失败，请重新设置端口"
})

async function loadProxyConfig() {
  if (showChangeDialog.value) return
  try {
    const config = await ApiClient.getProxyConfig()
    proxyHost.value = config.host
    proxyPort.value = config.port
    newHost.value = config.host
    newPort.value = config.port
    isActive.value = !!config.status
    errorMsg.value = config.msg || ''
  } catch (error) {
    console.error('Failed to get proxy config:', error)
    isActive.value = false
    errorMsg.value = '无法获取代理配置'
  }
}

async function handleChangeProxy() {
  errorMessage.value = ''
  successMessage.value = ''

  // 验证端口
  if (!newPort.value || newPort.value < 1024 || newPort.value > 65535) {
    errorMessage.value = '端口必须在 1024-65535 之间'
    return
  }

  // 验证主机地址
  if (!newHost.value || newHost.value.trim() === '') {
    errorMessage.value = '监听地址不能为空'
    return
  }

  // 简单的 IP 地址格式验证
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipPattern.test(newHost.value) && newHost.value !== 'localhost') {
    errorMessage.value = '无效的 IP 地址格式'
    return
  }

  if (newHost.value === proxyHost.value && newPort.value === proxyPort.value) {
    errorMessage.value = '你未修改地址/端口'
    return
  }

  try {
    let res = await ApiClient.changeProxyConfig(newHost.value, newPort.value)
    if (res.status) {
      successMessage.value = `修改请求发送成功 ${newHost.value}:${newPort.value}`
      // 1.5秒后自动关闭对话框
      setTimeout(() => {
        showChangeDialog.value = false
        successMessage.value = ''
        loadProxyConfig()
      }, 1500)
      return
    }

    errorMessage.value = '修改失败.请重试. ' + res.msg ? "原因" + res.msg : ''
  } catch (error) {
    console.error('Failed to change proxy config:', error)
    errorMessage.value = '修改失败,请重试.原因 ' + error.msg()
  }
}

onMounted(() => {
  loadProxyConfig()
  setInterval(loadProxyConfig, 3000)
})

</script>

<style scoped>
.proxy-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 13px;
  /* 禁用文本选择 */
  user-select: none;
  -webkit-user-select: none;
}

.status-label {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.status-value-wrapper {
  position: relative;
  display: inline-block;
}

.status-value {
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Monaco', 'Menlo', monospace;
  font-weight: 600;
}

.status-value.clickable {
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
}

.status-value.clickable:hover {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.status-value.has-error {
  color: #fbbf24;
}

.status-value.has-error:hover {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}

.error-icon {
  margin-left: 4px;
  font-size: 12px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

/* 自定义 tooltip 样式 */
.custom-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 30, 0.95);
  color: #fbbf24;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 10000;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(251, 191, 36, 0.3);
  animation: tooltipFadeIn 0.2s ease-out;
}

.custom-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(30, 30, 30, 0.95);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.status-indicator {
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.status-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
  transition: background-color 0.3s;
}

.status-indicator.active .dot {
  background-color: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: #1f2937;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 1);
}

.modal-body {
  padding: 24px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
}

.input-group input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  font-family: 'Monaco', 'Menlo', monospace;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.input-group input:focus {
  border-color: #3b82f6;
  background: rgba(0, 0, 0, 0.4);
}

.input-group ::selection {
  background-color: #3e3e3e; /* 选中背景色 */
  color: #ffcc25; /* 选中文字颜色 */
}

/* 移除 number 类型输入框的默认按钮 */
.input-group input::-webkit-outer-spin-button,
.input-group input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input-group input[type=number] {
  -moz-appearance: textfield;
}

.input-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
  padding: 8px 10px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

.input-hint span {
  display: block;
}

.error-message {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
}

.success-message {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 6px;
  color: #10b981;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-message::before {
  content: '✓';
  font-size: 16px;
  font-weight: bold;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary, .btn-primary {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.btn-primary {
  border: none;
  background: #3b82f6;
  color: #fff;
}

.btn-primary:hover {
  background: #2563eb;
}
</style>
