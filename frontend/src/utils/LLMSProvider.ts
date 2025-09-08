import {Anthropic, Gemini, OpenAI, Role} from "@/utils/LLMSModels.ts";


export interface LLMSProvider {
  name: string;

  parseRequest(body: string): OpenAI.ChatCompletionRequest | null;

  parseResponse(body: string): OpenAI.ChatCompletionResponse | null;

  parseChunk(body: string): OpenAI.Chunk | null;
}


export class OpenAIProvider implements LLMSProvider {
  name = 'OpenAI';

  parseRequest(body: string): OpenAI.ChatCompletionRequest | null {
    try {
      return JSON.parse(body) as OpenAI.ChatCompletionRequest;
    } catch (e) {
      console.error("Failed to parse OpenAI request:", e);
      return null;
    }
  }

  parseResponse(body: string): OpenAI.ChatCompletionResponse | null {
    try {
      return JSON.parse(body) as OpenAI.ChatCompletionResponse;
    } catch (e) {
      console.error("Failed to parse OpenAI response:", e);
      return null;
    }
  }

  parseChunk(chunk: string): OpenAI.Chunk | null {
    if (!chunk.startsWith('data: ')) return null;

    const jsonData = chunk.slice(6).trim();
    if (jsonData === '[DONE]') {
      return {
        id: 'openai-end',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'openAi',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
    }

    try {
      return JSON.parse(jsonData) as OpenAI.Chunk;
    } catch (e) {
      console.error("Failed to parse OpenAI chunk:", e);
      return null;
    }
  }
}

export class AnthropicProvider implements LLMSProvider {
  name = 'Anthropic';

  parseRequest(body: string): OpenAI.ChatCompletionRequest | null {
    // ... (implementation from original file, with added try/catch)
    try {
      const anthropicRequest = JSON.parse(body) as Anthropic.MessageRequest;

      const convertedMessages: OpenAI.ChatCompletionMessage[] = [];

      // Add system message if present
      if (anthropicRequest.system) {
        const systemContent = typeof anthropicRequest.system === 'string'
            ? anthropicRequest.system
            : anthropicRequest.system.map(msg => msg.type === 'text' ? msg.text : '').join('\n');

        if (systemContent.trim()) {
          convertedMessages.push({
            role: 'system',
            content: systemContent
          });
        }
      }

      // Convert Anthropic messages to OpenAI format
      for (const message of anthropicRequest.messages) {

        if (typeof message.content === 'string') {
          convertedMessages.push({
            role: message.role as OpenAI.ChatCompletionMessage['role'],
            content: message.content
          })
          continue
        }

        if (!Array.isArray(message.content)) {
          continue
        }

        // Convert to OpenAI content format
        let contentParts: {
          type: 'text' | 'image_url';
          text?: string;
          image_url?: {
            url: string;
            detail?: 'low' | 'high' | 'auto';
          };
        }[] = [];

        for (let block of message.content) {
          if (block.type === 'text') {
            contentParts.push({
              type: 'text',
              text: block.text
            });
            continue
          }

          if (block.type === 'image') {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: block.source.data
              }
            });
            continue
          }

          if (block.type === 'tool_use') {
            convertedMessages.push({
              role: message.role as OpenAI.ChatCompletionMessage['role'],
              content: contentParts.length === 0 ? null : contentParts,
              tool_calls: [{
                id: block.id,
                type: 'function',
                function: {
                  name: block.name,
                  arguments: JSON.stringify(block.input)
                }
              }]
            });
            contentParts = [];
            continue
          }

          if (block.type === 'tool_result') {
            convertedMessages.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: typeof block.content === 'string' ? block.content :
                  block.content.map(c => c.type === 'text' ? c.text : '').join('\n')
            })
          }
        }

        if (contentParts.length !== 0) {
          convertedMessages.push({
            role: message.role as OpenAI.ChatCompletionMessage['role'],
            content: contentParts,
          });
        }
      }

      // Convert tools
      const tools: OpenAI.Tool[] = anthropicRequest.tools?.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      })) || [];

      return {
        model: anthropicRequest.model,
        messages: convertedMessages,
        max_tokens: anthropicRequest.max_tokens,
        temperature: anthropicRequest.temperature,
        top_p: anthropicRequest.top_p,
        stream: anthropicRequest.stream,
        stop: anthropicRequest.stop_sequences,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined
      };
    } catch (e) {
      console.error("Failed to parse Anthropic request:", e);
      return null;
    }
  }

  parseResponse(body: string): OpenAI.ChatCompletionResponse | null {
    // ... (implementation from original file, with added try/catch)
    try {
      const anthropicResponse = JSON.parse(body) as Anthropic.MessageResponse;

      // Convert Anthropic content to OpenAI message format
      let content: string | null = null;
      let tool_calls: OpenAI.ToolCall[] | undefined = undefined;

      if (anthropicResponse.content) {
        const textBlocks = anthropicResponse.content.filter(block => block.type === 'text') as Anthropic.TextBlock[];
        const toolUseBlocks = anthropicResponse.content.filter(block => block.type === 'tool_use') as Anthropic.ToolUseBlock[];

        // Handle text content
        if (textBlocks.length > 0) {
          content = textBlocks.map(block => block.text).join('\n');
        }

        // Handle tool calls
        if (toolUseBlocks.length > 0) {
          tool_calls = toolUseBlocks.map(block => ({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          }));
        }
      }

      // Map stop reasons
      let finish_reason: OpenAI.Choice['finish_reason'];
      switch (anthropicResponse.stop_reason) {
        case 'end_turn':
          finish_reason = 'stop';
          break;
        case 'max_tokens':
          finish_reason = 'length';
          break;
        case 'tool_use':
          finish_reason = 'tool_calls';
          break;
        case 'stop_sequence':
          finish_reason = 'stop';
          break;
        default:
          finish_reason = null;
      }

      const message: OpenAI.ChatCompletionMessage = {
        role: 'assistant',
        content: content,
        tool_calls: tool_calls
      };

      return {
        id: anthropicResponse.id,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: anthropicResponse.model,
        choices: [{
          index: 0,
          message: message,
          finish_reason: finish_reason
        }],
        usage: {
          prompt_tokens: anthropicResponse.usage.input_tokens,
          completion_tokens: anthropicResponse.usage.output_tokens,
          total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens
        }
      } as OpenAI.ChatCompletionResponse;
    } catch (e) {
      console.error("Failed to parse Anthropic response:", e);
      return null;
    }
  }

  parseChunk(body: string): OpenAI.Chunk | null {
    // ... (implementation from original file, with improved error handling)
    try {
      // Handle SSE format - extract JSON data from event line
      let jsonData: string;
      if (body.startsWith('data: ')) {
        jsonData = body.slice(6).trim();
        if (jsonData === '[DONE]') {
          // Handle end of stream marker
          return {
            id: 'anthropic-end',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'anthropic',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };
        }
      } else {
        jsonData = body;
      }

      const anthropicChunk = JSON.parse(jsonData) as Anthropic.AnthropicChunk;

      // Handle different types of Anthropic chunks
      switch (anthropicChunk.type) {
        case 'message_start':
          return {
            id: anthropicChunk.message.id,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: anthropicChunk.message.model,
            choices: [{
              index: 0,
              delta: {
                role: 'assistant'
              },
              finish_reason: null
            }]
          };

        case 'content_block_start':
          if (anthropicChunk.content_block.type === 'text') {
            return {
              id: 'anthropic-chunk',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'anthropic',
              choices: [{
                index: anthropicChunk.index,
                delta: {
                  content: ''
                },
                finish_reason: null
              }]
            };
          } else if (anthropicChunk.content_block.type === 'tool_use') {
            const toolUseBlock = anthropicChunk.content_block as Anthropic.ToolUseBlock;
            return {
              id: 'anthropic-chunk',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'anthropic',
              choices: [{
                index: anthropicChunk.index,
                delta: {
                  tool_calls: [{
                    index: anthropicChunk.index,
                    id: toolUseBlock.id,
                    type: 'function',
                    function: {
                      name: toolUseBlock.name,
                      arguments: ''
                    }
                  }]
                },
                finish_reason: null
              }]
            };
          }
          break;

        case 'content_block_delta':
          if (anthropicChunk.delta.type === 'text_delta') {
            return {
              id: 'anthropic-chunk',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'anthropic',
              choices: [{
                index: anthropicChunk.index,
                delta: {
                  content: anthropicChunk.delta.text
                },
                finish_reason: null
              }]
            };
          } else if (anthropicChunk.delta.type === 'input_json_delta') {
            return {
              id: 'anthropic-chunk',
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'anthropic',
              choices: [{
                index: anthropicChunk.index,
                delta: {
                  tool_calls: [{
                    index: anthropicChunk.index,
                    id: '',
                    type: 'function',
                    function: {
                      arguments: anthropicChunk.delta.partial_json
                    }
                  }]
                },
                finish_reason: null
              }]
            };
          }
          break;

        case 'content_block_stop':
          return {
            id: 'anthropic-chunk',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'anthropic',
            choices: [{
              index: anthropicChunk.index,
              delta: {},
              finish_reason: null
            }]
          };

        case 'message_delta':
          let finish_reason: OpenAI.Choice['finish_reason'] = null;
          switch (anthropicChunk.delta.stop_reason) {
            case 'end_turn':
              finish_reason = 'stop';
              break;
            case 'max_tokens':
              finish_reason = 'length';
              break;
            case 'tool_use':
              finish_reason = 'tool_calls';
              break;
            case 'stop_sequence':
              finish_reason = 'stop';
              break;
          }

          return {
            id: 'anthropic-chunk',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'anthropic',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: finish_reason
            }]
          };

        case 'message_stop':
          return {
            id: 'anthropic-chunk',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'anthropic',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: 'stop'
            }]
          };

        case 'ping':
          // Return a minimal chunk for ping events
          return {
            id: 'anthropic-ping',
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: 'anthropic',
            choices: [{
              index: 0,
              delta: {},
              finish_reason: null
            }]
          };
      }
    } catch (e) {
      console.error("Failed to parse Anthropic chunk:", e);
      return null;
    }
    return null;
  }
}

export class GeminiProvider implements LLMSProvider {
  name = 'Gemini';

  parseRequest(body: string): OpenAI.ChatCompletionRequest | null {
    try {
      const geminiRequest = JSON.parse(body) as Gemini.GenerateContentRequest;
      return this.doParseRequest(geminiRequest);
    } catch (e) {
      console.error("Failed to parse Gemini request:", e);
      return null;
    }
  }

  doParseRequest(geminiRequest: Gemini.GenerateContentRequest): OpenAI.ChatCompletionRequest {
    const convertedMessages: OpenAI.ChatCompletionMessage[] = [];

    for (const content of geminiRequest.contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const parts: {
        type: 'text' | 'image_url';
        text?: string;
        image_url?: {
          url: string;
          detail?: 'low' | 'high' | 'auto';
        };
      }[] = [];
      let toolCalls: OpenAI.ToolCall[] = [];

      for (const part of content.parts) {
        if ('text' in part) {
          parts.push({type: 'text', text: part.text});
        } else if ('inlineData' in part) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            },
          });
        } else if ('functionCall' in part) {
          toolCalls.push({
            id: part.functionCall.name, // Gemini doesn't provide a call ID, using name as a stand-in
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args),
            },
          });
        } else if ('functionResponse' in part) {
          convertedMessages.push({
            role: 'tool',
            content: JSON.stringify(part.functionResponse.response),
            tool_call_id: part.functionResponse.name
          });
        }
      }

      if (parts.length > 0) {
        convertedMessages.push({
          role: role,
          content: parts,
        });
      }
      if (toolCalls.length > 0) {
        convertedMessages.push({
          role: role,
          content: null,
          tool_calls: toolCalls
        });
      }
    }

    const tools: OpenAI.Tool[] = geminiRequest.tools?.flatMap(t => t.functionDeclarations).map(fd => ({
      type: 'function',
      function: {
        name: fd.name,
        description: fd.description,
        parameters: fd.parameters,
      },
    })) || [];

    return {
      model: 'gemini-pro', // Model is not in the request body, placeholder
      messages: convertedMessages,
      temperature: geminiRequest.generationConfig?.temperature,
      top_p: geminiRequest.generationConfig?.topP,
      max_tokens: geminiRequest.generationConfig?.maxOutputTokens,
      stream: false, // Assuming not stream if it's a single request
      stop: geminiRequest.generationConfig?.stopSequences,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
    };
  }

  parseResponse(body: string): OpenAI.ChatCompletionResponse | null {
    try {
      const geminiResponse = JSON.parse(body) as Gemini.ContentResponse;
      return this.doParseResponse(geminiResponse);
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      return null;
    }
  }

  doParseResponse(geminiResponse: Gemini.ContentResponse): OpenAI.ChatCompletionResponse | null {
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      return null;
    }

    const candidate = geminiResponse.candidates[0];

    let content: string | null = null;
    let tool_calls: OpenAI.ToolCall[] | undefined = undefined;

    const textParts = candidate.content.parts.filter(p => 'text' in p);
    if (textParts.length > 0) {
      content = textParts.map(p => (p as { text: string }).text).join('');
    }

    const functionCallParts = candidate.content.parts.filter(p => 'functionCall' in p);
    if (functionCallParts.length > 0) {
      tool_calls = functionCallParts.map(p => {
        const fc = (p as { functionCall: Gemini.FunctionCall }).functionCall;
        return {
          id: fc.name, // No ID from Gemini
          type: 'function',
          function: {
            name: fc.name,
            arguments: JSON.stringify(fc.args)
          }
        };
      });
    }

    let finish_reason: OpenAI.Choice['finish_reason'] = null;
    switch (candidate.finishReason) {
      case 'STOP':
        finish_reason = 'stop';
        break;
      case 'MAX_TOKENS':
        finish_reason = 'length';
        break;
      case 'TOOL_CALLS':
        finish_reason = 'tool_calls';
        break;
      case 'SAFETY':
      case 'RECITATION':
        finish_reason = 'content_filter';
        break;
    }

    const message: OpenAI.ChatCompletionMessage = {
      role: 'assistant',
      content: content,
      tool_calls: tool_calls,
    };

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-pro',
      choices: [{
        index: candidate.index,
        message: message,
        logprobs: null,
        finish_reason: finish_reason,
      }],
      usage: {
        prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount ?? 0,
        completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: geminiResponse.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }

  parseChunk(chunk: string): OpenAI.Chunk | null {
    if (!chunk.startsWith('data: ')) return null;

    try {
      const jsonData = chunk.slice(6).trim();
      const geminiChunk = JSON.parse(jsonData) as Gemini.ContentResponse;
      return this.doParseChunk(geminiChunk);

    } catch (e) {
      return null;
    }
  }

  doParseChunk(geminiChunk: Gemini.ContentResponse): OpenAI.Chunk | null {
    if (!geminiChunk.candidates || geminiChunk.candidates.length === 0) {
      return null;
    }

    const candidate = geminiChunk.candidates[0];
    const part = candidate.content?.parts[0];

    let delta: { role?: Role; content?: string; tool_calls?: OpenAI.DeltaToolCall[] } = {};

    if (part && 'text' in part) {
      delta.content = part.text;
    }

    if (part && 'functionCall' in part) {
      delta.tool_calls = [{
        index: 0,
        id: part.functionCall.name,
        type: 'function',
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args)
        }
      }];
    }

    let finish_reason: OpenAI.Choice['finish_reason'] = null;
    if (candidate.finishReason) {
      switch (candidate.finishReason) {
        case 'STOP':
          finish_reason = 'stop';
          break;
        case 'MAX_TOKENS':
          finish_reason = 'length';
          break;
        case 'TOOL_CALLS':
          finish_reason = 'tool_calls';
          break;
        case 'SAFETY':
        case 'RECITATION':
          finish_reason = 'content_filter';
          break;
      }
    }

    return {
      id: `gemini-chunk-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini-pro',
      choices: [{
        index: candidate.index,
        delta: delta,
        finish_reason: finish_reason,
      }],
      usage: {
        prompt_tokens: geminiChunk.usageMetadata?.promptTokenCount ?? 0,
        completion_tokens: geminiChunk.usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: geminiChunk.usageMetadata?.totalTokenCount ?? 0,
      }
    };
  }
}

export class GeminiCliProvider implements LLMSProvider {
  name = 'Gemini';
  private readonly provider = new GeminiProvider()

  parseRequest(body: string): OpenAI.ChatCompletionRequest | null {
    try {
      const cliBody = JSON.parse(body);
      const res = this.provider.doParseRequest(cliBody.request as Gemini.GenerateContentRequest)
      res.model = cliBody.model
      return res;
    } catch (e) {
      console.error("Failed to parse Gemini request:", e);
      return null;
    }
  }

  parseResponse(body: string): OpenAI.ChatCompletionResponse | null {
    try {
      return this.provider.doParseResponse(JSON.parse(body).response as Gemini.ContentResponse)
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      return null;
    }
  }

  parseChunk(chunk: string): OpenAI.Chunk | null {
    if (!chunk.startsWith('data: ')) return null;

    try {
      const jsonData = chunk.slice(6).trim();
      const cliChunk = JSON.parse(jsonData);
      return this.provider.doParseChunk(cliChunk.response as Gemini.ContentResponse)

    } catch (e) {
      return null;
    }
  }
}

// AI API URL 模式
const AI_URL_PATTERNS: { provider: string, pattern: RegExp }[] = [
  // OpenAI API
  {provider: 'openai', pattern: /\/v1\/chat\/completions$/},
  {provider: 'openai', pattern: /\/chat\/completions$/},

  // Anthropic API
  {provider: 'anthropic', pattern: /\/v1\/messages(\?.*)?$/},
  {provider: 'anthropic', pattern: /\/messages$/},

  // Google Gemini API
  {provider: 'gemini-cli', pattern: /v1internal:generateContent(\?.*)?$/},
  {provider: 'gemini-cli', pattern: /v1internal:streamGenerateContent(\?.*)?$/},

  {provider: 'gemini', pattern: /:generateContent(\?.*)?$/},
  {provider: 'gemini', pattern: /:streamGenerateContent(\?.*)?$/},
];

export function getAIProvider(url: string, method: string): LLMSProvider | null {
  if (!url || !method || method.toUpperCase() !== 'POST') return null;

  for (const p of AI_URL_PATTERNS) {
    if (p.pattern.test(url)) {
      switch (p.provider) {
        case 'openai':
          return new OpenAIProvider();
        case 'anthropic':
          return new AnthropicProvider();
        case 'gemini-cli':
          return new GeminiCliProvider();
        case 'gemini':
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
export function isStreamResponse(text?: string): boolean {
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