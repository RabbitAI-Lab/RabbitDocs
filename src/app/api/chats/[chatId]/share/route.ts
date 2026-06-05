import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedChats, chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canAccessChat } from "@/lib/auth/chat-access";
import { getApiT } from "@/lib/i18n-api";

/** 校验 chat 访问权限 */
async function verifyChatAccess(req: NextRequest, chatId: string): Promise<{ ok: true } | NextResponse> {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const chat = db.select().from(chats).where(eq(chats.id, parseInt(chatId))).get();
  const t = await getApiT();
  if (!chat) return NextResponse.json({ error: t('api.notFound') }, { status: 404 });
  if (!canAccessChat(auth, chat)) return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });
  return { ok: true };
}

// GET /api/chats/[chatId]/share — 查询是否已分享
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const verify = await verifyChatAccess(req, chatId);
  if (verify instanceof NextResponse) return verify;
  const share = db
    .select()
    .from(sharedChats)
    .where(eq(sharedChats.chatId, parseInt(chatId)))
    .get();

  if (!share) {
    return NextResponse.json({ shared: false, token: null, createdAt: null });
  }
  return NextResponse.json({ shared: true, token: share.token, createdAt: share.createdAt });
}

// POST /api/chats/[chatId]/share — 创建分享
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const verify = await verifyChatAccess(req, chatId);
  if (verify instanceof NextResponse) return verify;
  const chatIdNum = parseInt(chatId);

  // 已存在则直接返回
  const existing = db
    .select()
    .from(sharedChats)
    .where(eq(sharedChats.chatId, chatIdNum))
    .get();
  if (existing) {
    return NextResponse.json({ token: existing.token, createdAt: existing.createdAt });
  }

  const token = randomUUID();
  const now = new Date().toISOString();
  db.insert(sharedChats).values({ chatId: chatIdNum, token, createdAt: now }).run();

  return NextResponse.json({ token, createdAt: now });
}

// PATCH /api/chats/[chatId]/share — 重新生成 token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const verify = await verifyChatAccess(req, chatId);
  if (verify instanceof NextResponse) return verify;
  const chatIdNum = parseInt(chatId);

  // 删除旧记录
  db.delete(sharedChats).where(eq(sharedChats.chatId, chatIdNum)).run();

  // 生成新 token
  const token = randomUUID();
  const now = new Date().toISOString();
  db.insert(sharedChats).values({ chatId: chatIdNum, token, createdAt: now }).run();

  return NextResponse.json({ token, createdAt: now });
}

// DELETE /api/chats/[chatId]/share — 取消分享
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const verify = await verifyChatAccess(req, chatId);
  if (verify instanceof NextResponse) return verify;
  db.delete(sharedChats).where(eq(sharedChats.chatId, parseInt(chatId))).run();
  return NextResponse.json({ success: true });
}
