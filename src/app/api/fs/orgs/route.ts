import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listOrgs } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/orgs?enterpriseId=1
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const { searchParams } = new URL(req.url);
  const enterpriseId = searchParams.get("enterpriseId") || "";

  if (!enterpriseId) {
    return NextResponse.json({ error: t('api.enterpriseIdRequired') }, { status: 400 });
  }

  const orgs = listOrgs(enterpriseId);
  return NextResponse.json(orgs);
}

// POST /api/fs/orgs - placeholder for future
export async function POST() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const t = await getApiT();
  return NextResponse.json({ error: t('api.notImplemented') }, { status: 501 });
}

// DELETE /api/fs/orgs - placeholder for future
export async function DELETE() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const t = await getApiT();
  return NextResponse.json({ error: t('api.notImplemented') }, { status: 501 });
}
