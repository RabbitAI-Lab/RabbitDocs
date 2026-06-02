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

/**
 * 让 agent 提示用户在项目工作区打开/预览一个 HTML 文件。
 * path 相对于项目根，例如 'docs/index.html'。
 * 如果对应 tab 已打开，会切换到该 tab；未打开则打开新 tab。
 * 前端负责拦截处理。
 */
const previewHtml = tool(
  "preview_html",
  "Open or switch to an HTML file in the project workspace tab. The path is relative to the project root, e.g. 'docs/index.html'. If a tab is already open for this file, switches to it; otherwise opens a new tab with a Monaco editor and iframe preview.",
  {
    path: z
      .string()
      .describe(
        "HTML file path relative to the project root, e.g. 'docs/foo.html'"
      ),
  },
  async ({ path }) => {
    if (!path || typeof path !== "string" || !path.endsWith(".html")) {
      throw new Error("preview_html only accepts .html files");
    }
    return {
      content: [
        { type: "text" as const, text: `Preview requested for ${path}` },
      ],
    };
  }
);

export function createClientToolsMcpServer() {
  return createSdkMcpServer({
    name: "chatwiki_client",
    version: "1.0.0",
    tools: [refreshFileTree, previewHtml],
  });
}
