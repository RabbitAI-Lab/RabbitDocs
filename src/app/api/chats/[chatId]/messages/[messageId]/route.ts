import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

// DELETE /api/chats/[chatId]/messages/[messageId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ chatId: string; messageId: string }> }
) {
  const { messageId } = await params;

  db.delete(chatMessages)
    .where(eq(chatMessages.id, parseInt(messageId)))
    .run();

  return NextResponse.json({ success: true });
}
