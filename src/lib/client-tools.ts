import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

export const CLIENT_TOOL_PREFIX = "mcp__chatwiki_client__";

const refreshFileTree = tool(
  "refresh_file_tree",
  "Refresh the file tree in the user's UI. Call this tool after you create, delete, or rename files or directories so the user immediately sees the updated file tree.",
  {},
  async () => ({
    content: [
      { type: "text" as const, text: "File tree refresh notification sent." },
    ],
  })
);

export function createClientToolsMcpServer() {
  return createSdkMcpServer({
    name: "chatwiki_client",
    version: "1.0.0",
    tools: [refreshFileTree],
  });
}
