/**
 * 环境检测工具
 * 用于检测是否在 Wails 环境中运行以及获取操作系统信息
 */

import {Environment, EnvironmentInfo} from '@/wailsjs/runtime'
import {GetServerPort} from '@/wailsjs/go/server/App'

/**
 * 检测是否在 Wails 桌面应用环境中运行
 * @returns {boolean}
 */
export function isWailsEnvironment(): boolean {
  return typeof window !== 'undefined' && (window as any).runtime !== undefined;
}

/**
 * 获取 HTTP API 基础地址
 * - Wails 环境：返回 http://localhost:{port}
 * - Web 环境：返回空字符串（使用相对路径）
 * @returns {Promise<string>}
 */
export async function getHttpBaseUrl(): Promise<string> {
  if (isWailsEnvironment()) {
    try {
      const port = await GetServerPort()
      return `http://localhost:${port}`
    } catch (error) {
      console.error('Failed to get server port:', error)
      return ''
    }
  }
  return '' // Web 环境使用相对路径
}

/**
 * 获取 WebSocket 服务器地址
 * - Wails 环境：返回 ws://localhost:{port}{path}
 * - Web 环境：返回相对路径 {path}
 * @param {string} path WebSocket 路径（如 '/ws'）
 * @returns {Promise<string>} 完整的 WebSocket URL
 */
export async function getWebSocketUrl(path: string): Promise<string> {
  if (isWailsEnvironment()) {
    try {
      const port = await GetServerPort()
      return `ws://localhost:${port}${path}`
    } catch (error) {
      console.error('Failed to get WebSocket URL:', error)
      // 降级处理：使用默认端口
      return `ws://localhost:8080${path}`
    }
  }
  // Web 环境使用相对路径，浏览器会自动处理
  return `${window.location.protocol.includes('https') ? 'wss' : 'ws'}://${window.location.host}${path.startsWith('/') ? path : '/' + path}`
}

/**
 * 获取环境信息
 * @returns {Promise<{platform: string, arch: string, buildType: string} | null>}
 */
export async function getEnvironmentInfo(): Promise<EnvironmentInfo | null> {
  if (!isWailsEnvironment()) {
    return Promise.resolve(null);
  }

  try {
    return await Environment()
  } catch (error) {
    console.warn('Failed to get environment info:', error)
    return Promise.resolve(null);
  }
}

/**
 * 检测是否为 macOS 环境
 * @returns {Promise<boolean>}
 */
export async function isMacOS(): Promise<boolean> {
  if (!isWailsEnvironment()) {
    // 在浏览器环境中检测
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
  }

  const info = await getEnvironmentInfo()
  return info?.platform === 'darwin'
}

/**
 * 检测是否为 Windows 环境
 * @returns {Promise<boolean>}
 */
export async function isWindows(): Promise<boolean> {
  if (!isWailsEnvironment()) {
    // 在浏览器环境中检测
    return /Win/i.test(navigator.platform)
  }

  const info = await getEnvironmentInfo()
  return info?.platform === 'windows'
}

/**
 * 检测是否为 Linux 环境
 * @returns {Promise<boolean>}
 */
export async function isLinux(): Promise<boolean> {
  if (!isWailsEnvironment()) {
    // 在浏览器环境中检测
    return /Linux/i.test(navigator.platform)
  }

  const info = await getEnvironmentInfo()
  return info?.platform === 'linux'
}

/**
 * 获取平台名称
 * @returns {Promise<'darwin' | 'windows' | 'linux' | 'web' | 'unknown'>}
 */
export async function getPlatform(): Promise<string> {
  if (!isWailsEnvironment()) {
    return 'web'
  }

  const info = await getEnvironmentInfo()
  return info?.platform || 'unknown'
}