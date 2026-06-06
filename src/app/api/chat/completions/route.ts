import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { streamModelResponse } from "@/lib/model-service";
import type { ChatCompletionRequest } from "@/lib/types";
import { ModelError } from "@/lib/types";
import path from "node:path";
import { getDataRoot, readProjectMeta } from "@/lib/fs";
import { db } from "@/db";
import { systemPrompts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// POST /api/chat/completions — SSE streaming endpoint
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body: Partial<ChatCompletionRequest & { workspaceId?: string; chatId?: number }> = await req.json();
  const { modelId, messages, projectId } = body;
  const workspaceId = (body as Record<string, unknown>).workspaceId as string | undefined;
  const chatId = (body as Record<string, unknown>).chatId as number | undefined;
  const _systemPrompt = body.systemPrompt; // reserved for future per-request override
  void _systemPrompt;

  if (!modelId || !messages || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: t('api.chat.modelAndMessagesRequired') }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Construct cwd from DATA_ROOT and projectId
  // 首先查找当前用户目录，再尝试通过所有项目元数据找到项目实际位置（支持成员访问）
  let cwd: string | undefined;
  if (projectId) {
    // 优先从当前用户的目录查找
    const ownPath = ["personal", auth.id, "projects", projectId];
    const ownMeta = readProjectMeta(ownPath);
    if (ownMeta) {
      cwd = path.join(getDataRoot(), ...ownPath);
    } else {
      // 回退到 default（兼容迁移前数据）
      cwd = path.join(getDataRoot(), "personal", "default", "projects", projectId);
    }
  }

  // Inject cwd info into the system message
  if (cwd) {
    const cwdSection = `\n\n---\n\n## 运行环境\n\n- 工作目录(cwd): ${cwd}\n- 所有文件操作都应限制在此目录内。`;
    if (messages[0]?.role === "system") {
      messages[0] = { ...messages[0], content: messages[0].content + cwdSection };
    } else {
      messages.unshift({
        role: "system",
        content: `## 运行环境\n\n- 工作目录(cwd): ${cwd}\n- 所有文件操作都应限制在此目录内。`,
      });
    }
  }

  // Inject global system prompts
  const activePrompts = db.select().from(systemPrompts)
    .where(eq(systemPrompts.enabled, 1))
    .orderBy(systemPrompts.sortOrder)
    .all();

  console.log("[SystemPrompts] active prompts count:", activePrompts.length,
    activePrompts.map(p => ({ id: p.id, name: p.name, enabled: p.enabled })));

  if (activePrompts.length > 0) {
    const globalSection = activePrompts.map(p => p.content).join("\n\n---\n\n");
    if (messages[0]?.role === "system") {
      messages[0] = { ...messages[0], content: globalSection + "\n\n" + messages[0].content };
    } else {
      messages.unshift({
        role: "system",
        content: globalSection,
      });
    }
    console.log("[SystemPrompts] injected into messages[0], content length:", messages[0]?.content?.length);
  } else {
    console.log("[SystemPrompts] NO active prompts found in DB");
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const generator = streamModelResponse(modelId, messages, {
          cwd,
          projectId,
          userId: auth.id,
          workspaceId,
          chatId,
        });

        for await (const event of generator) {
          const eventType = event.type === "text_delta" ? "delta" : event.type;
          const data = JSON.stringify(event);
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${data}\n\n`)
          );
        }

        controller.close();
      } catch (err) {
        if (err instanceof ModelError) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: "error",
                error: err.message,
                code: err.code,
              })}\n\n`
            )
          );
        } else {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({
                type: "error",
                error: t('api.internalError') + ": " + (err instanceof Error ? err.message : String(err)),
              })}\n\n`
            )
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
