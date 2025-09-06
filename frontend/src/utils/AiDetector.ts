import { OpenAIProvider, Provider, AnthropicProvider, GeminiProvider } from "@/utils/Provider.ts";

interface AIRequestHeaders {
  [key: string]: string;
}

// AI API URL 模式
const AI_URL_PATTERNS: { provider: string, pattern: RegExp }[] = [
  // OpenAI API
  { provider: 'openai', pattern: /\/v1\/chat\/completions$/ },
  { provider: 'openai', pattern: /\/chat\/completions$/ },

  // Anthropic API
  { provider: 'anthropic', pattern: /\/v1\/messages(\?.*)?$/ },
  { provider: 'anthropic', pattern: /\/messages$/ },
  
  // Google Gemini API
  { provider: 'google', pattern: /:generateContent(\?.*)?$/ },
  { provider: 'google', pattern: /:streamGenerateContent(\?.*)?$/ }
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

  const urlMatch = AI_URL_PATTERNS.some(p => p.pattern.test(url));
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
 * @returns Provider | null
 */
export function getAIProvider(url: string): Provider | null {
  if (!url) return null;

  for (const p of AI_URL_PATTERNS) {
    if (p.pattern.test(url)) {
      switch (p.provider) {
        case 'openai':
          return new OpenAIProvider();
        case 'anthropic':
          return new AnthropicProvider();
        case 'google':
          return new GeminiProvider();
        default:
          return null;
      }
    }
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

  // 优化检测 SSE 格式的逻辑
  const lines = text.trim().split('\n');
  if (lines.length === 0) return false;
  
  // 检查是否有 "data: " 开头的行
  const hasDataLine = lines.some(line => line.startsWith('data: '));
  
  // 检查是否以 "[DONE]" 结尾
  const endsWithDone = lines[lines.length - 1] === 'data: [DONE]';
  
  // 检查是否有事件行
  const hasEventLine = lines.some(line => line.startsWith('event: '));

  return hasDataLine || endsWithDone || hasEventLine;
}