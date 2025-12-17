<template>
  <div class="cert-status">
    <div class="status-container cert-path" @click="copyPath">
      <div class="status-label">证书:</div>
      <div class="status-indicator" :class="{ installed: isInstalled }">
        <span class="dot"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>

      <span class="path-text">{{ certPath }}</span>
    </div>

    <div v-if="!isInstalled && certExists" class="cert-actions">
      <button class="action-btn install" @click="handleOneClickInstall" :disabled="installing">
        <span class="icon">⚡</span>
        {{ installing ? '安装中...' : '一键安装' }}
      </button>
      <button class="action-btn guide" @click="showInstallGuide">
        <span class="icon">📖</span>
        安装说明
      </button>
    </div>

    <div v-if="isInstalled" class="cert-actions">
      <button class="action-btn uninstall" @click="handleUninstall" :disabled="uninstalling">
        <span class="icon">✕</span>
        {{ uninstalling ? '卸载中...' : '卸载证书' }}
      </button>
    </div>

    <!-- Toast 通知组件 -->
    <Toast ref="toastRef"/>

    <!-- Confirm 对话框组件 -->
    <Confirm ref="confirmRef"/>

    <!-- 安装说明模态框 -->
    <Teleport to="body">
      <div v-if="showGuide" class="modal-overlay" @click="showGuide = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>证书安装说明</h3>
            <button class="close-btn" @click="showGuide = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="platform-info">
              <span class="label">检测到系统:</span>
              <span class="value">{{ guideData.platform }}</span>
            </div>
            <pre class="guide-text">{{ guideData.guide }}</pre>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showGuide = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 降级脚本提示模态框 -->
    <Teleport to="body">
      <div v-if="showScriptPrompt" class="modal-overlay" @click="showScriptPrompt = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>{{ scriptPromptData.title }}</h3>
            <button class="close-btn" @click="showScriptPrompt = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="message">{{ scriptPromptData.message }}</p>
            <div class="script-actions">
              <button class="btn-primary" @click="downloadScript(scriptPromptData.scriptEndpoint)">
                <span class="icon">⬇</span>
                下载{{ scriptPromptData.type }}脚本
              </button>
            </div>
            <div class="instructions">
              <h4>使用说明:</h4>
              <div v-html="scriptPromptData.instructions" style="margin-left: 20px"></div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="showScriptPrompt = false">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import {ref, onMounted, computed} from 'vue'
import Toast from '../../common/Toast.vue'
import Confirm from '../../common/Confirm.vue'
import {ApiClient} from '@/utils/ApiClient'

const isInstalled = ref(false)
const certExists = ref(false)
const certPath = ref('')
const platformInfo = ref({
  os: '',
  display: ''
})
const installing = ref(false)
const uninstalling = ref(false)
const showGuide = ref(false)
const showScriptPrompt = ref(false)
const scriptPromptData = ref({
  title: '',
  message: '',
  scriptEndpoint: '',
  type: '',
  instructions: ''
})

const toastRef = ref(null)
const confirmRef = ref(null)

// 当前指南数据
const guideData = ref({
  guide: '',
  detectedOS: '',
  platform: ''
})

const statusText = computed(() => {
  if (!certExists.value) return '未生成'
  return isInstalled.value ? '已安装' : '未安装'
})

// 从后端平台字符串映射到安装指南的key
function mapPlatformToGuideKey(platformStr) {
  const lower = platformStr.toLowerCase()
  if (lower.includes('darwin') || lower.includes('macos')) {
    return {key: 'macos', display: 'macOS'}
  } else if (lower.includes('windows')) {
    return {key: 'windows', display: 'Windows'}
  } else if (lower.includes('linux')) {
    return {key: 'linux', display: 'Linux'}
  }
  return {key: 'macos', display: platformStr}
}

// 获取脚本执行说明
function getScriptInstructions(platform) {
  if (platform === 'windows') {
    return `
      <ol>
        <li>右键点击下载的脚本文件</li>
        <li>选择"以管理员身份运行"</li>
        <li>按照提示完成操作</li>
      </ol>
    `
  } else {
    return `
      <ol>
        <li>打开终端（Terminal）</li>
        <li>导航到脚本所在目录</li>
        <li>执行命令：<code>chmod +x 脚本文件名</code></li>
        <li>执行命令：<code>sudo ./脚本文件名</code></li>
        <li>输入管理员密码完成操作</li>
      </ol>
    `
  }
}

async function checkCertStatus() {
  try {
    const status = await ApiClient.getCertStatus()
    isInstalled.value = status.installed
    certExists.value = status.exists
    certPath.value = status.path || './proxyMan-ca.crt'

    // 保存后端返回的平台信息
    if (status.platform) {
      const platformMapping = mapPlatformToGuideKey(status.platform)
      platformInfo.value = {
        os: platformMapping.key,
        display: status.platform // 使用后端返回的完整平台信息
      }
    }
  } catch (error) {
    console.error('Failed to check certificate status:', error)
  }
}

function copyPath() {
  navigator.clipboard.writeText(certPath.value)
  toastRef.value?.addToast('成功', '证书地址复制成功', 'success', 3000)
}

function showInstallGuide() {
  // 使用后端返回的平台信息，如果没有则使用默认值
  const platform = platformInfo.value.os || 'macos'
  const displayName = platformInfo.value.display || 'macOS'

  let installGuides = platform === 'macos' ? `macOS 证书安装步骤：

证书位置：${certPath.value}

1. 双击 ca.crt 证书文件
2. 在弹出的"钥匙串访问"窗口中，证书会被添加到"登录"钥匙串
3. 在钥匙串列表中找到 "ProxyMan" 证书
4. 右键点击证书，选择"显示简介"
5. 展开"信任"部分
6. 将"使用此证书时"设置为"始终信任"
7. 关闭窗口，输入管理员密码确认

完成后，浏览器将信任 ProxyMan 代理的 HTTPS 连接。` : platform === 'windows' ? `Windows 证书安装步骤：

证书位置：${certPath.value}

1. 右键点击 ca.crt 证书文件
2. 选择"安装证书"
3. 选择"计算机所有用户"，点击"下一步"
4. 选择"将所有证书放入以下存储"
5. 点击"浏览"，选择"受信任的根证书颁发机构"
6. 点击"确定"，然后"下一步"
7. 点击"完成"

系统可能会显示安全警告，点击"是"确认安装。
完成后，浏览器将信任 ProxyMan 代理的 HTTPS 连接。` : platform === 'linux' ? `Linux 证书安装步骤：

证书位置：${certPath.value}

方法一：系统级安装（推荐）
1. 复制证书到系统证书目录：
   sudo cp ca.crt /usr/local/share/ca-certificates/
2. 更新证书存储：
   sudo update-ca-certificates
3. 重启浏览器

方法二：Firefox 浏览器
1. 打开 Firefox 设置 → 隐私与安全 → 证书
2. 点击"查看证书" → "证书颁发机构"
3. 点击"导入"，选择 ca.crt
4. 勾选"信任由此证书颁发机构来标识网站"

方法三：Chrome/Chromium 浏览器
1. 打开 chrome://settings/certificates
2. 切换到"授权机构"标签
3. 点击"导入"，选择 ca.crt
4. 勾选"信任此证书以标识网站"` : "位置操纵系统"

  guideData.value = {
    guide: installGuides,
    platform: platform,
    detectedOS: displayName
  }
  showGuide.value = true
}

async function handleOneClickInstall() {
  installing.value = true
  try {
    const result = await ApiClient.installCert()

    if (result.success) {
      isInstalled.value = true
      toastRef.value?.addToast('证书安装成功', 'ProxyMan 证书已成功安装到系统', 'success', 4000)
      await checkCertStatus()
    } else {
      // 自动安装失败，检查是否有脚本可用
      if (result.hasScript) {
        const platform = platformInfo.value.os || 'macos'
        scriptPromptData.value = {
          title: '需要管理员权限',
          message: result.message || '自动安装需要管理员权限，请下载脚本手动执行。',
          scriptEndpoint: result.scriptEndpoint || '',
          type: '安装',
          instructions: getScriptInstructions(platform)
        }
        showScriptPrompt.value = true
      } else {
        // 降级到手动流程
        toastRef.value?.addToast(
            '安装失败',
            result.message || '未知错误，请查看手动安装说明',
            'error',
            5000
        )
        showInstallGuide()
      }
    }
  } catch (error) {
    console.error('Failed to install certificate:', error)
    toastRef.value?.addToast(
        '安装失败',
        '网络错误或服务异常，请查看手动安装说明',
        'error',
        5000
    )
    showInstallGuide()
  } finally {
    installing.value = false
  }
}

async function handleUninstall() {
  const confirmed = await confirmRef.value?.show({
    title: '确认卸载',
    message: '确定要卸载 ProxyMan 证书吗？卸载后将无法拦截 HTTPS 流量。',
    type: 'warning',
    confirmText: '确定卸载',
    cancelText: '取消'
  })

  if (!confirmed) {
    return
  }

  uninstalling.value = true
  try {
    const result = await ApiClient.uninstallCert()

    if (result.success) {
      isInstalled.value = false
      toastRef.value?.addToast('证书卸载成功', 'ProxyMan 证书已从系统中移除', 'success', 4000)
      await checkCertStatus()
    } else {
      // 自动卸载失败，检查是否有脚本可用
      if (result.hasScript) {
        const platform = platformInfo.value.os || 'macos'
        scriptPromptData.value = {
          title: '需要管理员权限',
          message: result.message || '自动卸载需要管理员权限，请下载脚本手动执行。',
          scriptEndpoint: result.scriptEndpoint || '',
          type: '卸载',
          instructions: getScriptInstructions(platform)
        }
        showScriptPrompt.value = true
      } else {
        toastRef.value?.addToast(
            '卸载失败',
            result.message || '未知错误',
            'error',
            5000
        )
      }
    }
  } catch (error) {
    console.error('Failed to uninstall certificate:', error)
    toastRef.value?.addToast(
        '卸载失败',
        '网络错误或服务异常，请稍后重试',
        'error',
        5000
    )
  } finally {
    uninstalling.value = false
  }
}

async function downloadScript(endpoint) {
  const url = await ApiClient.getInstallScriptUrl()
  window.open(endpoint || url, '_blank')
  showScriptPrompt.value = false
}

onMounted(() => {
  checkCertStatus()
  // 定期检查证书状态
  setInterval(checkCertStatus, 10_000)
})
</script>

<style scoped>
.cert-status {
  display: flex;
  align-items: center;
  gap: 12px;
  /* 禁用文本选择 */
  user-select: none;
  -webkit-user-select: none;
}

.status-container {
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

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-indicator .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #ef4444;
  transition: background-color 0.3s;
}

.status-indicator.installed .dot {
  background-color: #10b981;
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}

.status-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
}

.cert-path {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.cert-path:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.5);
}

.path-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.cert-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 1);
}

.action-btn .icon {
  font-size: 13px;
}

.action-btn.install:not(:disabled):hover {
  border-color: #10b981;
  color: #10b981;
}

.action-btn.guide:not(:disabled):hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.action-btn.uninstall:not(:disabled):hover {
  border-color: #ef4444;
  color: #ef4444;
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
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  overflow-y: auto;
}

.platform-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}

.platform-info .label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}

.platform-info .value {
  color: #3b82f6;
  font-weight: 600;
  font-size: 14px;
}

.guide-text {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.message {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 20px;
}

.script-actions {
  margin-bottom: 20px;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #60a5fa;
}

.instructions {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px;
  border-radius: 8px;
  border-left: 3px solid #f59e0b;
}

.instructions h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #f59e0b;
}

.instructions ol {
  margin: 0;
  padding-left: 20px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  line-height: 1.8;
}

.instructions li {
  margin-bottom: 8px;
}

.instructions code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #60a5fa;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: flex-end;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}
</style>
