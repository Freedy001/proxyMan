import {OpenAI, Anthropic, ContentPart} from "@/utils/LLMSModels.ts";

export interface Provider {
  name: string;

  parseRequest(body: string): OpenAI.ChatCompletionRequest | null;

  parseResponse(body: string): OpenAI.ChatCompletionResponse | null;

  parseChunk(body: string): OpenAI.Chunk | null;
}


export class OpenAIProvider implements Provider {
  name = 'OpenAI';

  parseRequest(body: string): OpenAI.ChatCompletionRequest {
    return JSON.parse(body) as OpenAI.ChatCompletionRequest;
  }

  parseResponse(body: string): OpenAI.ChatCompletionResponse {
    return JSON.parse(body) as OpenAI.ChatCompletionResponse;
  }

  parseChunk(chunk: string): OpenAI.Chunk | null {
    if (chunk.startsWith('data: ')) {
      const jsonData = chunk.slice(6).trim();
      if (jsonData === '[DONE]') {
        // Handle end of stream marker
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
      return JSON.parse(chunk) as OpenAI.Chunk;
    }
    return null;
  }
}


// AnthropicProvider 的完整实现
export class AnthropicProvider implements Provider {
  name = 'Anthropic';

  parseChunk(body: string): OpenAI.Chunk {
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
                      name: null,
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

        default:
          // Fallback for unknown chunk types
          return {
            id: 'anthropic-unknown',
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

      // Fallback return
      return {
        id: 'anthropic-fallback',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'anthropic',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: null
        }]
      };

    } catch (error) {
      // Return error chunk if parsing fails
      return {
        id: 'anthropic-error',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'anthropic',
        choices: [{
          index: 0,
          delta: {
            content: '[Error parsing chunk]'
          },
          finish_reason: null
        }]
      };
    }
  }

  parseRequest(body: string): OpenAI.ChatCompletionRequest {
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
      const convertedMessage: OpenAI.ChatCompletionMessage = {
        role: message.role as OpenAI.ChatCompletionMessage['role'],
        content: null
      };

      if (typeof message.content === 'string') {
        convertedMessage.content = message.content;
      } else if (Array.isArray(message.content)) {
        // Handle content blocks
        //   export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;
        message.content.map(block => {
          if (block.type === 'text') {
            contentParts.push({
              type: 'text',
              text: block.text
            });
            return
          }

          if (block.type === 'image') {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: block.source.url
              }
            });
          }

          if (block.type === 'tool_use') {
            contentParts.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input)
              }
            });
          }

          if (block.type === 'tool_result') {
            convertedMessage.tool_calls = {
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: typeof block.content === 'string' ? block.content :
                  block.content.map(c => c.type === 'text' ? c.text : '').join('\n')
            }
          }

        })
        const textBlocks = message.content.filter(block => block.type === 'text') as Anthropic.TextBlock[];
        const toolUseBlocks = message.content.filter(block => block.type === 'tool_use') as Anthropic.ToolUseBlock[];
        const imageBlocks = message.content.filter(block => block.type === 'image') as Anthropic.ImageBlock[];
        const toolResultBlocks = message.content.filter(block => block.type === 'tool_result') as Anthropic.ToolResultBlock[];

        // Convert to OpenAI content format
        const contentParts: ContentPart[] = [];

        for (const block of textBlocks) {
          contentParts.push({
            type: 'text',
            text: block.text
          });
        }

        for (const block of imageBlocks) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`
            }
          });
        }

        // if (contentParts.length > 0) {
        //   convertedMessage.content = contentParts;
        // } else if (textBlocks.length === 1) {
        //   convertedMessage.content = textBlocks[0].text;
        // }

        // Handle tool calls
        if (toolUseBlocks.length > 0) {
          convertedMessage.tool_calls = toolUseBlocks.map(block => ({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input)
            }
          }));
        }

        // Handle tool results (convert to user messages with tool_call_id)
        for (const block of toolResultBlocks) {
          const toolResultMessage: OpenAI.ChatCompletionMessage = {
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: typeof block.content === 'string' ? block.content :
                block.content.map(c => c.type === 'text' ? c.text : '').join('\n')
          };
          convertedMessages.push(toolResultMessage);
        }
      }

      convertedMessages.push(convertedMessage);
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
  }

  parseResponse(body: string): OpenAI.ChatCompletionResponse {
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
    let finish_reason: OpenAI.Choice['finish_reason'] = null;
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
        logprobs: null,
        finish_reason: finish_reason
      }],
      usage: {
        prompt_tokens: anthropicResponse.usage.input_tokens,
        completion_tokens: anthropicResponse.usage.output_tokens,
        total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens
      }
    };
  }

}