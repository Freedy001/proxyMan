<template>
  <div class="upstream-proxy-status">
    <div class="status-label">上游代理:</div>
    <div class="status-value-wrapper" @mouseenter="showTooltip = true" @mouseleave="showTooltip = false">
      <div
          class="status-value clickable"
          @click="showChangeDialog = true"
      >
        {{ upstreamAddress }}
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showChangeDialog" class="modal-overlay" @click="showChangeDialog = false;newMode=mode">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>设置上游代理</h3>
            <button class="close-btn" @click="showChangeDialog = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="input-group">
              <label>模式:</label>
              <select v-model="newMode" @change="handleModeChange">
                <option value="none">不使用上游代理</option>
                <option value="env">使用环境变量</option>
                <option value="custom">自定义代理</option>
              </select>
            </div>

            <!-- 环境变量模式下显示当前环境变量 -->
            <div v-if="newMode === 'env'" class="env-proxy-display">
              <div class="env-label">当前环境变量代理:</div>
              <div class="env-value">{{ envProxyAddress || '未设置' }}</div>
            </div>

            <!-- 自定义代理模式下显示配置表单 -->
            <template v-if="newMode === 'custom'">
              <div class="input-group">
                <label>协议:</label>
                <select v-model="newProtocol">
                  <option value="http">HTTP 代理</option>
                  <option value="socket5">socket5 代理</option>
                </select>
              </div>

            <div class="input-group">
              <label>主机:</label>
              <input
                  v-model="newHost"
                  type="text"
                  placeholder="例如 127.0.0.1 或 localhost"
                  @keyup.enter="handleChangeUpstream"
              />
            </div>

            <div class="input-group">
              <label>端口 (1-65535):</label>
              <input
                  v-model.number="newPort"
                  type="number"
                  min="1"
                  max="65535"
                  placeholder="输入端口号"
                  @keyup.enter="handleChangeUpstream"
              />
            </div>
            </template>

            <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
            <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showChangeDialog = false">取消</button>
            <button class="btn-primary" @click="handleChangeUpstream">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import {ref, computed, onMounted} from 'vue'
import {ApiClient} from '@/utils/ApiClient'

const mode = ref('none')
const protocol = ref('')
const host = ref('')
const port = ref(0)
const envProxy = ref('')

const newMode = ref('none')
const newProtocol = ref('http')
const newHost = ref('127.0.0.1')
const newPort = ref(0)

const showChangeDialog = ref(false)
const showTooltip = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const upstreamAddress = computed(() => {
  if (mode.value === 'none') {
    return '不使用上游代理'
  }
  if (mode.value === 'env') {
    return envProxy.value || '环境变量(未设置)'
  }
  if (mode.value === 'custom' && protocol.value && host.value && port.value) {
    return `${protocol.value}://${host.value}:${port.value}`
  }
  return '未配置上游代理'
})

const envProxyAddress = computed(() => {
  return envProxy.value || '未设置'
})

async function loadUpstreamConfig() {
  try {
    const config = await ApiClient.getUpstreamProxyConfig()
    mode.value = config.mode || 'none'
    protocol.value = config.protocol || ''
    host.value = config.host || ''
    port.value = config.port || 0
    envProxy.value = config.envProxy || ''

    newMode.value = mode.value
    newProtocol.value = protocol.value || 'http'
    newHost.value = host.value || '127.0.0.1'
    newPort.value = port.value || 0

  } catch (e) {
    console.error('Failed to get upstream proxy config:', e)
  }
}

async function handleModeChange() {
  errorMessage.value = ''
  successMessage.value = ''

  // 如果切换到环境变量模式，立即获取环境变量地址
  if (newMode.value === 'env') {
    try {
      const config = await ApiClient.getUpstreamProxyConfig()
      envProxy.value = config.envProxy || ''
    } catch (e) {
      console.error('Failed to get env proxy:', e)
    }
  }
}

async function handleChangeUpstream() {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    let res

    if (newMode.value === 'none') {
      // 不使用上游代理
      res = await ApiClient.changeUpstreamProxyConfig('none')
    } else if (newMode.value === 'env') {
      // 使用环境变量
      res = await ApiClient.changeUpstreamProxyConfig('env')
    } else if (newMode.value === 'custom') {
      // 自定义代理 - 验证输入
      if (!newProtocol.value) {
        errorMessage.value = '请选择协议类型'
        return
      }

      if (!newHost.value || newHost.value.trim() === '') {
        errorMessage.value = '主机不能为空'
        return
      }

      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!ipPattern.test(newHost.value) && newHost.value !== 'localhost') {
        errorMessage.value = '无效的 IP 地址格式'
        return
      }

      if (!newPort.value || newPort.value < 1 || newPort.value > 65535) {
        errorMessage.value = '端口必须在 1-65535 之间'
        return
      }

      res = await ApiClient.changeUpstreamProxyConfig('custom', newProtocol.value, newHost.value, newPort.value)
    }

    if (res && res.status) {
      successMessage.value = '上游代理配置已更新'
      setTimeout(() => {
        showChangeDialog.value = false
        successMessage.value = ''
        loadUpstreamConfig()
      }, 1500)
    } else {
      errorMessage.value = '修改失败: ' + (res?.msg || '')
    }
  } catch (e) {
    console.error('Failed to change upstream proxy config:', e)
    errorMessage.value = '修改失败, 请重试'
  }
}

onMounted(() => {
  loadUpstreamConfig()
})
</script>

<style scoped>
.upstream-proxy-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 13px;
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

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

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
  margin-bottom: 12px;
}

.input-group label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
}

.input-group input,
.input-group select {
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

.input-group select {
  cursor: pointer;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.6)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

.input-group input:focus,
.input-group select:focus {
  border-color: #3b82f6;
  background: rgba(0, 0, 0, 0.4);
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

.env-proxy-display {
  margin: 12px 0;
  padding: 12px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
}

.env-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  margin-bottom: 6px;
}

.env-value {
  color: #3b82f6;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
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

.input-group ::selection {
  background-color: #3e3e3e; /* 选中背景色 */
  color: #ffcc25; /* 选中文字颜色 */
}
</style>
