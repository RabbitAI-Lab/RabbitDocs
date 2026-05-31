// 流式事件类型
export type StreamDeltaEvent = { type: "text_delta"; text: string };
export type StreamDoneEvent = { type: "done"; fullText: string };
export type StreamErrorEvent = {
  type: "error";
  error: string;
  code?: string;
};
export type StreamToolCallEvent = {
  type: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
};
export type StreamEvent =
  | StreamDeltaEvent
  | StreamDoneEvent
  | StreamErrorEvent
  | StreamToolCallEvent;

// API 请求类型
export type ChatCompletionRequest = {
  modelId: number;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt?: string;
  projectId?: string;
};

// 自定义错误类
export class ModelError extends Error {
  code:
    | "MODEL_NOT_FOUND"
    | "PROTOCOL_UNSUPPORTED"
    | "INVALID_CONFIG"
    | "SDK_ERROR";

  constructor(
    message: string,
    code:
      | "MODEL_NOT_FOUND"
      | "PROTOCOL_UNSUPPORTED"
      | "INVALID_CONFIG"
      | "SDK_ERROR"
  ) {
    super(message);
    this.name = "ModelError";
    this.code = code;
  }
}
