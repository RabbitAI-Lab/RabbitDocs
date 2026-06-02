import { NextRequest, NextResponse } from "next/server";
import { readWorkspaceMcpConfig, writeWorkspaceMcpConfig } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/fs/workspace-mcp?dirSegments=...
 *
 * 返回工作区级 MCP 配置的完整结构（mcpJson），让前端可以渲染任意条 MCP server。
 * 兼容老字段 enabled/apiKey（基于 zhipu-web-search-sse 计算），便于旧调用方降级。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");

  if (!dirSegmentsStr) {
    return NextResponse.json({ error: "缺少 dirSegments 参数" }, { status: 400 });
  }

  const dirSegments = dirSegmentsStr.split(",");
  const config = readWorkspaceMcpConfig(dirSegments);

  const mcpServers =
    config && typeof config.mcpServers === "object" && config.mcpServers
      ? (config.mcpServers as Record<string, unknown>)
      : {};
  const apiKeys =
    config && typeof config._apiKeys === "object" && config._apiKeys
      ? (config._apiKeys as Record<string, string>)
      : {};

  // 兼容：基于 zhipu-web-search-sse 推断旧字段
  const zhipuEntry = mcpServers["zhipu-web-search-sse"] as
    | { url?: string }
    | undefined;
  const match = zhipuEntry?.url?.match(/Authorization=(.+)$/);
  const enabled = !!zhipuEntry;
  const apiKey = match ? match[1] : apiKeys["zhipu-web-search-sse"] || null;

  return NextResponse.json({
    mcpJson: { mcpServers, _apiKeys: apiKeys },
    // 兼容旧字段
    enabled,
    apiKey,
  });
}

/**
 * PUT /api/fs/workspace-mcp
 *
 * 两种模式：
 *   1. { dirSegments, mcpJson: { mcpServers, _apiKeys } } - 结构化模式（推荐）
 *   2. { dirSegments, rawJson } - 原始 JSON 模式（高级，会做防御性校验）
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { dirSegments } = body as { dirSegments?: string[] };

  if (!Array.isArray(dirSegments) || dirSegments.length === 0) {
    return NextResponse.json({ error: "缺少 dirSegments 参数" }, { status: 400 });
  }

  // ----- 模式 1: 结构化模式 -----
  if (body.mcpJson !== undefined) {
    const { mcpJson } = body as { mcpJson: { mcpServers?: unknown; _apiKeys?: unknown } };

    if (!mcpJson || typeof mcpJson !== "object") {
      return NextResponse.json({ error: "mcpJson 必须是对象" }, { status: 400 });
    }
    if (!mcpJson.mcpServers || typeof mcpJson.mcpServers !== "object") {
      return NextResponse.json(
        { error: "mcpJson.mcpServers 必须是对象" },
        { status: 400 }
      );
    }

    // _apiKeys 可选；若提供必须是对象
    if (mcpJson._apiKeys !== undefined && (typeof mcpJson._apiKeys !== "object" || mcpJson._apiKeys === null)) {
      return NextResponse.json(
        { error: "mcpJson._apiKeys 必须是对象" },
        { status: 400 }
      );
    }

    const normalized = {
      mcpServers: mcpJson.mcpServers as Record<string, unknown>,
      _apiKeys: (mcpJson._apiKeys ?? {}) as Record<string, string>,
    };

    writeWorkspaceMcpConfig(normalized, dirSegments);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "mcp",
      action: "update",
      detail: "更新了 MCP 配置",
    });
    return NextResponse.json({ ok: true, mcpJson: normalized });
  }

  // ----- 模式 2: 原始 JSON 模式（防御性校验） -----
  if (body.rawJson !== undefined) {
    const raw = body.rawJson;
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: "rawJson 必须是对象" }, { status: 400 });
    }
    if (typeof (raw as Record<string, unknown>).mcpServers !== "object" || (raw as Record<string, unknown>).mcpServers === null) {
      return NextResponse.json(
        { error: "rawJson.mcpServers 必须是对象" },
        { status: 400 }
      );
    }

    writeWorkspaceMcpConfig(raw as object, dirSegments);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "mcp",
      action: "update",
      detail: "更新了 MCP 配置（rawJson）",
    });

    const saved = readWorkspaceMcpConfig(dirSegments) || {};
    return NextResponse.json({
      ok: true,
      mcpJson: {
        mcpServers:
          (saved.mcpServers && typeof saved.mcpServers === "object"
            ? saved.mcpServers
            : {}) as Record<string, unknown>,
        _apiKeys:
          (saved._apiKeys && typeof saved._apiKeys === "object"
            ? saved._apiKeys
            : {}) as Record<string, string>,
      },
    });
  }

  return NextResponse.json(
    { error: "请求体必须包含 mcpJson 或 rawJson" },
    { status: 400 }
  );
}
