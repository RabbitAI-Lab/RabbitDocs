import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sharedChats } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/chats/[chatId]/share — 查询是否已分享
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const share = db
    .select()
    .from(sharedChats)
    .where(eq(sharedChats.chatId, parseInt(chatId)))
    .get();
  if (!share) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ token: share.token, createdAt: share.createdAt });
}

// POST /api/chats/[chatId]/share — 创建分享
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
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
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
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
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  db.delete(sharedChats).where(eq(sharedChats.chatId, parseInt(chatId))).run();
  return NextResponse.json({ success: true });
}
