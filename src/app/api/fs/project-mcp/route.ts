import { NextRequest, NextResponse } from "next/server";
import { readProjectMcpConfig, writeProjectMcpConfig } from "@/lib/fs";

export const dynamic = "force-dynamic";

const MCP_SERVER_KEY = "zhipu-web-search-sse";
const MCP_BASE_URL = "https://open.bigmodel.cn/api/mcp-broker/proxy/web-search/mcp?Authorization=";

// GET /api/fs/project-mcp - 获取项目 MCP 配置
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");

  if (!dirSegmentsStr) {
    return NextResponse.json({ error: "缺少 dirSegments 参数" }, { status: 400 });
  }

  const dirSegments = dirSegmentsStr.split(",");
  const config = readProjectMcpConfig(dirSegments);

  const mcpServers = (config?.mcpServers || {}) as Record<string, { url?: string }>;
  const entry = mcpServers[MCP_SERVER_KEY];

  if (entry?.url) {
    const match = entry.url.match(/Authorization=(.+)$/);
    const apiKey = match ? match[1] : null;
    return NextResponse.json({ enabled: true, apiKey });
  }

  // 未启用时，从 _apiKeys 中读取已保存的 key
  const savedKeys = (config?._apiKeys || {}) as Record<string, string>;
  return NextResponse.json({ enabled: false, apiKey: savedKeys[MCP_SERVER_KEY] || null });
}

// PUT /api/fs/project-mcp - 保存项目 MCP 配置
// 两种模式:
//   1. { dirSegments, enabled, apiKey } - 简化模式
//   2. { dirSegments, rawJson } - 原始 JSON 模式
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { dirSegments } = body as { dirSegments: string[] };

  if (!dirSegments) {
    return NextResponse.json({ error: "缺少 dirSegments 参数" }, { status: 400 });
  }

  // Raw JSON mode
  if (body.rawJson !== undefined) {
    writeProjectMcpConfig(body.rawJson, dirSegments);
    const saved = readProjectMcpConfig(dirSegments);
    const mcpServers = (saved?.mcpServers || {}) as Record<string, { url?: string }>;
    const entry = mcpServers[MCP_SERVER_KEY];
    const match = entry?.url?.match(/Authorization=(.+)$/);
    return NextResponse.json({
      enabled: !!entry,
      apiKey: match ? match[1] : null,
    });
  }

  // Simplified mode
  const { enabled, apiKey } = body as { enabled: boolean; apiKey?: string };
  const existing = readProjectMcpConfig(dirSegments) || {};
  const mcpServers = (existing.mcpServers || {}) as Record<string, unknown>;
  const apiKeys = (existing._apiKeys || {}) as Record<string, string>;

  if (enabled) {
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: "启用时需要提供 API Key" }, { status: 400 });
    }
    mcpServers[MCP_SERVER_KEY] = { url: `${MCP_BASE_URL}${apiKey.trim()}` };
    apiKeys[MCP_SERVER_KEY] = apiKey.trim();
    writeProjectMcpConfig({ mcpServers, _apiKeys: apiKeys }, dirSegments);
    return NextResponse.json({ enabled: true, apiKey: apiKey.trim() });
  }

  // 禁用：从 mcpServers 中移除，但 _apiKeys 保留
  delete mcpServers[MCP_SERVER_KEY];
  if (apiKey?.trim()) {
    apiKeys[MCP_SERVER_KEY] = apiKey.trim();
  }
  writeProjectMcpConfig({ mcpServers, _apiKeys: apiKeys }, dirSegments);
  return NextResponse.json({ enabled: false, apiKey: apiKeys[MCP_SERVER_KEY] || null });
}
