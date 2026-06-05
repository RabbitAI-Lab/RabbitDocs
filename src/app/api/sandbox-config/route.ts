import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { sandboxConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/sandbox-config
export async function GET() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const config = db.select().from(sandboxConfig).get();
  return NextResponse.json({
    sandboxUrl: config?.sandboxUrl ?? "openapi.sandbox.rabbitai-lab.com",
    updatedAt: config?.updatedAt ?? null,
  });
}

// PUT /api/sandbox-config
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { sandboxUrl } = body;

  if (typeof sandboxUrl !== "string" || !sandboxUrl.trim()) {
    return NextResponse.json(
      { error: t('api.sandbox.sandboxUrlCannotBeEmpty') },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const existing = db.select().from(sandboxConfig).get();

  if (existing) {
    db.update(sandboxConfig)
      .set({ sandboxUrl: sandboxUrl.trim(), updatedAt: now })
      .where(eq(sandboxConfig.id, existing.id))
      .run();
  } else {
    db.insert(sandboxConfig)
      .values({ sandboxUrl: sandboxUrl.trim(), createdAt: now, updatedAt: now })
      .run();
  }

  return NextResponse.json({ success: true, updatedAt: now });
}
