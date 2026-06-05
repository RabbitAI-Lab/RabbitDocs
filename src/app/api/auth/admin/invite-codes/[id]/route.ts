import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { getApiT } from "@/lib/i18n-api";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const { id } = await params;
    const target = db.select().from(inviteCodes).where(eq(inviteCodes.id, id)).get();
    if (!target) {
      return NextResponse.json({ error: t('api.auth.inviteCodes.notFound') }, { status: 404 });
    }
    if (target.usedById) {
      return NextResponse.json(
        { error: t('api.auth.inviteCodes.cannotDeleteUsed') },
        { status: 400 }
      );
    }

    db.delete(inviteCodes).where(eq(inviteCodes.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth] Admin delete invite code error:", error);
    return NextResponse.json({ error: t('api.internalError') }, { status: 500 });
  }
}
