/**
 * ACP session/update → ChatWiki StreamEvent 事件映射
 *
 * 将 ACP 协议的 SessionUpdate 通知转换为 ChatWiki 前端可理解的 StreamEvent。
 */
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { StreamEvent } from "./types";

// client tools 名称前缀（用于从 ACP tool_call.title 中识别前端信号工具）
const CLIENT_TOOL_NAMES = new Set(["refresh_file_tree", "preview_html"]);

/**
 * 将 ACP SessionUpdate 映射为零或多个 ChatWiki StreamEvent。
 */
export function mapAcpUpdateToStreamEvents(update: SessionUpdate): StreamEvent[] {
  const events: StreamEvent[] = [];
  const updateType = update.sessionUpdate;

  switch (updateType) {
    case "agent_message_chunk": {
      // ContentChunk → text_delta
      const content = update.content;
      if (content.type === "text" && typeof content.text === "string") {
        events.push({ type: "text_delta", text: content.text });
      }
      break;
    }

    case "agent_thought_chunk": {
      // ContentChunk → thinking_start + thinking_delta
      const content = update.content;
      if (content.type === "text" && typeof content.text === "string") {
        // 注意：ACP 没有 thinking_start 事件，我们总是 yield thinking_start + thinking_delta
        // 实际使用中由 acp-client 在首次 thought_chunk 时单独发送 thinking_start
        events.push({ type: "thinking_delta", text: content.text });
      }
      break;
    }

    case "tool_call": {
      // ToolCall → tool_call (仅前端信号工具)
      const title = update.title;
      // 从 title 中提取工具名（claude-agent-acp 将工具名映射为 title）
      // 格式可能是 "refresh_file_tree" 或 "mcp__rabbitdocs_client__refresh_file_tree"
      const toolName = extractToolName(title);
      if (CLIENT_TOOL_NAMES.has(toolName)) {
        events.push({
          type: "tool_call",
          toolName,
          args: (update.rawInput as Record<string, unknown>) ?? {},
        });
      }
      // 非 client tool 的 tool_call 只记录日志，不映射到前端
      console.log("[ACP] tool_call:", title, "toolName:", toolName);
      break;
    }

    case "tool_call_update":
    case "plan":
    case "plan_update":
    case "plan_removed":
    case "available_commands_update":
    case "current_mode_update":
    case "config_option_update":
    case "session_info_update":
    case "usage_update":
    case "user_message_chunk": {
      // 这些更新类型不需要映射到前端，仅记录日志
      console.log("[ACP] session update:", updateType);
      break;
    }

    default: {
      console.log("[ACP] unknown session update:", updateType);
      break;
    }
  }

  return events;
}

/**
 * 从 ACP tool_call 的 title 中提取工具名。
 *
 * claude-agent-acp 传递的 title 格式可能是：
 * - "refresh_file_tree" (直接工具名)
 * - "MCP tool: refresh_file_tree" (带前缀)
 * - "mcp__rabbitdocs_client__refresh_file_tree" (完整 MCP 名称)
 */
function extractToolName(title: string): string {
  // 去掉 MCP 前缀
  const mcpPrefix = "mcp__rabbitdocs_client__";
  if (title.startsWith(mcpPrefix)) {
    return title.slice(mcpPrefix.length);
  }
  // 去掉 "MCP tool: " 前缀
  const mcpToolPrefix = "MCP tool: ";
  if (title.startsWith(mcpToolPrefix)) {
    return title.slice(mcpToolPrefix.length);
  }
  return title;
}
