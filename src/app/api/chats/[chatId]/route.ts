import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessChat } from "@/lib/auth/chat-access";
import { getApiT } from "@/lib/i18n-api";

// GET /api/chats/[chatId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { chatId } = await params;
  const c = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  const t = await getApiT();
  if (!c) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (!canAccessChat(auth, c)) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });
  return NextResponse.json(c);
}

// PATCH /api/chats/[chatId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { chatId } = await params;

  // 校验访问权限（所有者或项目/工作空间成员可编辑）
  const existing = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  const t = await getApiT();
  if (!existing) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (!canAccessChat(auth, existing)) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });

  const body = await req.json();
  const { title, modelId, templateId, projectId, workspaceId, userModelId } = body;

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedBy: auth.id,
  };
  if (title !== undefined) updates.title = title;
  if (modelId !== undefined) updates.modelId = modelId;
  if (templateId !== undefined) updates.templateId = templateId;
  if (projectId !== undefined) updates.projectId = projectId;
  if (workspaceId !== undefined) updates.workspaceId = workspaceId;
  if (userModelId !== undefined) updates.userModelId = userModelId;

  db.update(chats).set(updates).where(eq(chats.id, parseInt(chatId))).run();

  return NextResponse.json({ success: true });
}

// DELETE /api/chats/[chatId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { chatId } = await params;

  // 校验访问权限（仅所有者或 admin 可删除）
  const existing = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  const t = await getApiT();
  if (!existing) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (existing.userId && existing.userId !== auth.id && !auth.isAdmin) {
    return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });
  }

  db.delete(chats).where(eq(chats.id, parseInt(chatId))).run();
  return NextResponse.json({ success: true });
}
