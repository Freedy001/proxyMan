// 基础类型定义
// noinspection SpellCheckingInspection

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  role: Role;
  content: string | ContentPart[] | null;
  name?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

// OpenAI 格式定义 (基本正确，无需大改)
export namespace OpenAI {

  export interface ChatCompletionMessage extends Message {
    role: Role;
    content: string | ContentPart[] | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: ToolCall[];
  }

  export interface ToolCall {
    id: string;
    type: 'function';
    function: {
      name?: string;
      arguments?: string;
    };
  }

  export interface ChatCompletionRequest {
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    top_p?: number;
    n?: number;
    stream?: boolean;
    stop?: string | string[];
    max_tokens?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    logit_bias?: Record<string, number>;
    user?: string;
    tools?: Tool[];
    tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
    response_format?: { type: 'text' | 'json_object' };
  }

  export interface Tool {
    type: 'function';
    function: {
      name: string;
      description?: string;
      // MODIFIED: 建议使用更具体的类型，但 any 也能工作
      parameters?: Record<string, unknown>;
      strict?: boolean;
    };
  }

  export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Choice[];
    usage: Usage;
    system_fingerprint?: string;
  }

  export interface Choice {
    index: number;
    message: ChatCompletionMessage;
    // MODIFIED: logprobs 类型复杂，any 是可接受的简化
    logprobs: any;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }

  export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }

  export interface Chunk {
    id: string;
    object: string;
    created: number;
    model: string;
    usage?: Usage;
    choices: ChunkChoice[];
  }

  export interface ChunkChoice {
    index: number;
    delta: {
      role?: Role;
      content?: string;
      tool_calls?: DeltaToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  }

  export interface DeltaToolCall extends ToolCall {
    index: number;
  }
}

// Anthropic 格式定义 (已修正)
export namespace Anthropic {
  export type MessageRole = 'user' | 'assistant';

  export interface Message {
    role: MessageRole;
    // MODIFIED: 明确了 content 的类型可以是多种 Block 组合
    content: string | ContentBlock[];
  }

  // ADDED: 为工具调用新增的 Block 类型
  export interface ToolUseBlock {
    type: 'tool_use';
    id: string;
    name: string;
    input: Record<string, any>;
  }

  // ADDED: 为工具返回结果新增的 Block 类型
  export interface ToolResultBlock {
    type: 'tool_result';
    tool_use_id: string;
    content: string | (TextBlock | ImageBlock)[];
    is_error?: boolean;
  }

  export interface TextBlock {
    type: 'text';
    text: string;
  }

  export interface ImageBlock {
    type: 'image';
    source: {
      type: 'base64';
      media_type: string; // e.g., 'image/jpeg', 'image/png'
      data: string;
    };
  }

  // MODIFIED: ContentBlock 现在包含了工具相关的类型
  export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

  export type SystemMessage =
    | { type: "text"; text: string }
    | { type: "cache_control"; cache_type: "ephemeral" };

  // MODIFIED: system 类型从 `string | SystemMessage[]` 改为 `string`
  export interface MessageRequest {
    model: string;
    messages: Message[];
    system?: string | SystemMessage[];
    max_tokens: number;
    metadata?: {
      user_id?: string;
    };
    stop_sequences?: string[];
    stream?: boolean;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    // ADDED: Anthropic API 支持 tools 参数
    tools?: Tool[];
  }

  export interface MessageResponse {
    id: string;
    type: 'message';
    role: 'assistant';
    // MODIFIED: 响应的 content 类型可以是 TextBlock 或 ToolUseBlock
    content: (TextBlock | ToolUseBlock)[];
    model: string;
    // MODIFIED: stop_reason 添加了 'tool_use'
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
    stop_sequence: string | null;
    usage: Usage;
  }

  export interface Usage {
    input_tokens: number;
    output_tokens: number;
  }

  export interface Tool {
    name: string;
    description: string;
    input_schema: Record<string, unknown>; // JSON Schema
  }

  // DELETED: 下面这些类型被新的 Block 类型和流式事件定义所替代
  // export interface ToolResult { ... }
  // export interface ToolUse { ... }

  // --- Streaming Chunks ---
  // MODIFIED: 重构了 AnthropicChunk 为可辨识联合类型，更精确

  export interface MessageStartEvent {
    type: 'message_start';
    message: Omit<MessageResponse, 'content' | 'stop_reason' | 'stop_sequence'> & {
      content: [];
      stop_reason: null;
      stop_sequence: null;
    };
  }

  export interface ContentBlockStartEvent {
    type: 'content_block_start';
    index: number;
    content_block: TextBlock | ToolUseBlock;
  }

  export interface PingEvent {
    type: 'ping';
  }

  export interface ContentBlockDeltaEvent {
    type: 'content_block_delta';
    index: number;
    delta: {
      type: 'text_delta';
      text: string;
    } | {
      type: 'input_json_delta';
      partial_json: string;
    };
  }

  export interface ContentBlockStopEvent {
    type: 'content_block_stop';
    index: number;
  }

  export interface MessageDeltaEvent {
    type: 'message_delta';
    delta: {
      stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
      stop_sequence: string | null;
    };
    usage: {
      output_tokens: number;
    };
  }

  export interface MessageStopEvent {
    type: 'message_stop';
  }

  export type AnthropicChunk =
    | MessageStartEvent
    | ContentBlockStartEvent
    | PingEvent
    | ContentBlockDeltaEvent
    | ContentBlockStopEvent
    | MessageDeltaEvent
    | MessageStopEvent;
}

export namespace Gemini {
  // Based on Google AI for Developers documentation

  export interface GenerateContentRequest {
    contents: Content[];
    tools?: Tool[];
    generationConfig?: GenerationConfig;
    safetySettings?: SafetySetting[];
  }

  export interface Content {
    role: 'user' | 'model';
    parts: Part[];
  }

  export type Part =
    | { text: string; }
    | { inlineData: BlobPart; }
    | { functionCall: FunctionCall; }
    | { functionResponse: FunctionResponse; };


  export interface BlobPart {
    mimeType: string;
    data: string; // base64 encoded
  }

  export interface FunctionCall {
    name: string;
    args: Record<string, any>;
  }

  export interface FunctionResponse {
    name: string;
    response: Record<string, any>;
  }

  export interface Tool {
    functionDeclarations: FunctionDeclaration[];
  }

  export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  }

  export interface GenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  }

  export interface SafetySetting {
    category: string;
    threshold: string;
  }

  export interface GenerateContentResponse {
    candidates: Candidate[];
    usageMetadata?: UsageMetadata;
  }

  export interface ChunkResponse {
    candidates: Candidate[];
    usageMetadata?: UsageMetadata;
  }

  export interface Candidate {
    content: Content;
    finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'TOOL_CALLS' | 'OTHER' | null;
    index: number;
    safetyRatings?: SafetyRating[];
    citationMetadata?: any;
  }

  export interface SafetyRating {
    category: string;
    probability: string;
  }

  export interface UsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  }
}
