import {OpenAIProvider, Provider, AnthropicProvider} from "@/utils/Provider.ts";

interface AIRequestHeaders {
  [key: string]: string;
}


// AI API URL 模式
const AI_URL_PATTERNS: RegExp[] = [
  // OpenAI API
  /\/v1\/chat\/completions$/,
  /\/chat\/completions$/,

  // Anthropic API
  /\/v1\/messages(\?.*)?$/,
  /\/messages$/,
];

/**
 * 检测是否为 AI API 请求
 * @param url - 请求 URL
 * @param method - HTTP 方法
 * @param headers - 请求头
 * @returns boolean
 */
export function isAIRequest(url: string, method: string = 'POST', headers: AIRequestHeaders = {}): boolean {
  if (!url || method.toUpperCase() !== 'POST') {
    return false;
  }

  // 检查 URL 模式
  const urlMatch = AI_URL_PATTERNS.some(pattern => pattern.test(url));
  if (!urlMatch) {
    return false;
  }

  // 检查 Content-Type
  const contentType = headers['content-type'] || headers['Content-Type'] || '';
  if (contentType.includes('application/json')) {
    return true;
  }

  return urlMatch;
}

/**
 * 检测 AI API 类型
 * @param url - 请求 URL
 * @returns AIProvider
 */
export function getAIProvider(url: string): Provider | null {
  if (!url) return null;

  if (url.includes('/chat/completions')) {
    return new OpenAIProvider();
  }

  if (url.includes('/v1/messages') || url.includes('/messages')) {
    return new AnthropicProvider();
  }

  return null;
}

/**
 * 检测是否为流式响应数据
 * @param text - 响应文本
 * @returns boolean
 */
export function isStreamResponse(text: string): boolean {
  if (!text) {
    return false;
  }

  // 检测 SSE 格式
  const lines = text.split('\n');
  return lines.some(line =>
      line.startsWith('data: ') ||
      line.startsWith('event: ') ||
      line === 'data: [DONE]'
  );
}
