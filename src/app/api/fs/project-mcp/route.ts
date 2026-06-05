import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { readProjectMcpConfig, writeProjectMcpConfig } from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/fs/project-mcp?dirSegments=...
 *
 * 返回项目级 MCP 配置的完整结构（mcpJson），让前端可以渲染任意条 MCP server。
 * 兼容老字段 enabled/apiKey（基于 zhipu-web-search-sse 计算），便于旧调用方降级。
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  const t = await getApiT();

  if (!dirSegmentsStr) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }

  const dirSegments = dirSegmentsStr.split(",");
  const config = readProjectMcpConfig(dirSegments);

  const mcpServers =
    config && typeof config.mcpServers === "object" && config.mcpServers
      ? (config.mcpServers as Record<string, unknown>)
      : {};
  // disabled 字段：存被禁用的 server（保留配置，但 model-service 不会注入到 Agent SDK）
  const disabled =
    config && typeof config.disabled === "object" && config.disabled
      ? (config.disabled as Record<string, unknown>)
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
    mcpJson: { mcpServers, disabled, _apiKeys: apiKeys },
    // 兼容旧字段
    enabled,
    apiKey,
  });
}

/**
 * PUT /api/fs/project-mcp
 *
 * 两种模式：
 *   1. { dirSegments, mcpJson: { mcpServers, _apiKeys } } - 结构化模式（推荐）
 *   2. { dirSegments, rawJson } - 原始 JSON 模式（高级，会做防御性校验）
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments } = body as { dirSegments?: string[] };

  if (!Array.isArray(dirSegments) || dirSegments.length === 0) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }

  // ----- 模式 1: 结构化模式 -----
  if (body.mcpJson !== undefined) {
    const { mcpJson } = body as {
      mcpJson: {
        mcpServers?: unknown;
        disabled?: unknown;
        _apiKeys?: unknown;
      };
    };

    if (!mcpJson || typeof mcpJson !== "object") {
      return NextResponse.json({ error: t('api.mcp.mcpJsonMustBeObject') }, { status: 400 });
    }
    if (!mcpJson.mcpServers || typeof mcpJson.mcpServers !== "object") {
      return NextResponse.json(
        { error: t('api.mcp.jsonMustBeObject') },
        { status: 400 }
      );
    }

    // disabled 可选；若提供必须是对象
    if (
      mcpJson.disabled !== undefined &&
      (typeof mcpJson.disabled !== "object" || mcpJson.disabled === null)
    ) {
      return NextResponse.json(
        { error: t('api.mcp.jsonMustBeObject') },
        { status: 400 }
      );
    }

    // _apiKeys 可选；若提供必须是对象
    if (
      mcpJson._apiKeys !== undefined &&
      (typeof mcpJson._apiKeys !== "object" || mcpJson._apiKeys === null)
    ) {
      return NextResponse.json(
        { error: t('api.mcp.jsonMustBeObject') },
        { status: 400 }
      );
    }

    const normalized = {
      mcpServers: mcpJson.mcpServers as Record<string, unknown>,
      disabled: (mcpJson.disabled ?? {}) as Record<string, unknown>,
      _apiKeys: (mcpJson._apiKeys ?? {}) as Record<string, string>,
    };

    writeProjectMcpConfig(normalized, dirSegments);

    // 解析操作元数据，打印精确日志
    const _op = body._op as { serverName?: string; action?: string } | undefined;
    if (_op?.serverName && (_op.action === "enable" || _op.action === "disable")) {
      const label = _op.action === "enable" ? "启用" : "禁用";
      logOperation({
        projectId: extractProjectId(dirSegments),
        category: "mcp",
        action: _op.action as "enable" | "disable",
        detail: `${label}了 MCP server: ${_op.serverName}`,
      });
      console.log(`[MCP] ${label} server "${_op.serverName}" in project [${dirSegments.join("/")}]`);
    } else {
      logOperation({
        projectId: extractProjectId(dirSegments),
        category: "mcp",
        action: "update",
        detail: "更新了 MCP 配置",
      });
    }

    // 打印写入后的文件内容
    console.log(`[MCP] .mcp.json after write:\n${JSON.stringify({ mcpServers: normalized.mcpServers }, null, 2)}`);
    if (Object.keys(normalized.disabled || {}).length > 0 || Object.keys(normalized._apiKeys || {}).length > 0) {
      console.log(`[MCP] .mcp-config.json after write:\n${JSON.stringify({ disabled: normalized.disabled, _apiKeys: normalized._apiKeys }, null, 2)}`);
    }

    return NextResponse.json({ ok: true, mcpJson: normalized });
  }

  // ----- 模式 2: 原始 JSON 模式（防御性校验） -----
  if (body.rawJson !== undefined) {
    const raw = body.rawJson;
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: t('api.mcp.mcpJsonMustBeObject') }, { status: 400 });
    }
    if (typeof (raw as Record<string, unknown>).mcpServers !== "object" || (raw as Record<string, unknown>).mcpServers === null) {
      return NextResponse.json(
        { error: t('api.mcp.jsonMustBeObject') },
        { status: 400 }
      );
    }

    writeProjectMcpConfig(raw as object, dirSegments);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "mcp",
      action: "update",
      detail: "更新了 MCP 配置（rawJson）",
    });

    const saved = readProjectMcpConfig(dirSegments) || {};
    return NextResponse.json({
      ok: true,
      mcpJson: {
        mcpServers:
          (saved.mcpServers && typeof saved.mcpServers === "object"
            ? saved.mcpServers
            : {}) as Record<string, unknown>,
        disabled:
          (saved.disabled && typeof saved.disabled === "object"
            ? saved.disabled
            : {}) as Record<string, unknown>,
        _apiKeys:
          (saved._apiKeys && typeof saved._apiKeys === "object"
            ? saved._apiKeys
            : {}) as Record<string, string>,
      },
    });
  }

  return NextResponse.json(
    { error: t('api.mcp.bodyMustContainMcpOrRaw') },
    { status: 400 }
  );
}
