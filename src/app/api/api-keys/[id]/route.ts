import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { deleteApiKey } from "@/lib/auth/api-key";
import { getApiT } from "@/lib/i18n-api";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  const { id } = await params;
  const deleted = deleteApiKey(id, authResult.id);

  if (!deleted) {
    return NextResponse.json(
      { error: t('api.apiKeys.cannotDeleteSystemKey') },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
