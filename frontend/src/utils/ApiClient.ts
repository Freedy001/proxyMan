/**
 * 统一 API 客户端
 * 自动处理 Wails 和 Web 两种环境的请求
 */

import {getHttpBaseUrl} from './Environment'

// API 数据类型定义
export interface ProxyConfig {
  status: boolean
  msg: string
  host: string
  port: number
}

export interface CertStatus {
  installed: boolean
  exists: boolean
  path: string
  platform: string
}

export interface InstallResult {
  success: boolean
  requiresRoot: boolean
  message: string
  hasScript?: boolean
  scriptEndpoint?: string
  error?: string
}

export interface UninstallResult {
  success: boolean
  requiresRoot: boolean
  message: string
  hasScript?: boolean
  scriptEndpoint?: string
  error?: string
}

export interface UpstreamProxyConfig {
  mode: string      // "none", "env", "custom"
  protocol: string  // http, socket5
  host: string
  port: number
  envProxy?: string // 环境变量中的代理地址
}

/**
 * 统一的 HTTP 请求方法
 * 自动添加正确的 baseUrl
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = await getHttpBaseUrl()
  const headers: any = {
    'Content-Type': 'application/json',
    'Authorization': localStorage.getItem("Authorization") || undefined,
    ...options?.headers,
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(await response.text())
    }

    return await response.json()
  } catch (error) {
    console.error(`Request failed: ${path}`, error)
    throw error
  }
}

/**
 * API 客户端类
 */
export class ApiClient {
  /**
   * 获取代理配置
   */
  static async getProxyConfig(): Promise<ProxyConfig> {
    return request<ProxyConfig>('/api/proxy/config')
  }

  /**
   * 修改代理配置
   * @param host 代理服务器主机地址
   * @param port 代理服务器端口
   */
  static async changeProxyConfig(host: string, port: number): Promise<ProxyConfig> {
    return request<ProxyConfig>('/api/proxy/change', {
      method: 'POST',
      body: JSON.stringify({host, port}),
    })
  }

  /**
   * 获取证书状态
   */
  static async getCertStatus(): Promise<CertStatus> {
    return request<CertStatus>('/api/cert/status')
  }

  /**
   * 一键安装证书
   */
  static async installCert(): Promise<InstallResult> {
    return request<InstallResult>('/api/cert/install', {
      method: 'POST',
    })
  }

  /**
   * 卸载证书
   */
  static async uninstallCert(): Promise<UninstallResult> {
    return request<UninstallResult>('/api/cert/uninstall', {
      method: 'POST',
    })
  }

  /**
   * 下载证书安装脚本
   * @returns 脚本下载 URL
   */
  static async getInstallScriptUrl(): Promise<string> {
    const baseUrl = await getHttpBaseUrl()
    return `${baseUrl}/api/cert/install-script`
  }

  /**
   * 下载证书卸载脚本
   * @returns 脚本下载 URL
   */
  static async getUninstallScriptUrl(): Promise<string> {
    const baseUrl = await getHttpBaseUrl()
    return `${baseUrl}/api/cert/uninstall-script`
  }

  /**
   * 获取上游代理配置
   */
  static async getUpstreamProxyConfig(): Promise<UpstreamProxyConfig> {
    return request<UpstreamProxyConfig>('/api/proxy/upstream/config')
  }

  /**
   * 修改上游代理配置
   * @param mode 模式 ("none", "env", "custom")
   * @param protocol 协议类型 (http, socket5)
   * @param host 代理服务器主机地址
   * @param port 代理服务器端口
   */
  static async changeUpstreamProxyConfig(
    mode: string,
    protocol?: string,
    host?: string,
    port?: number
  ): Promise<{ status: boolean; msg?: string }> {
    return request<{ status: boolean; msg?: string }>('/api/proxy/upstream/change', {
      method: 'POST',
      body: JSON.stringify({mode, protocol, host, port}),
    })
  }
}
