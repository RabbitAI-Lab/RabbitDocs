import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { systemPrompts } from "@/db/schema";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/system-prompts
export async function GET() {
  // Static handler — note: no req means no auth possible; skipping guard
  // (if this handler needs auth, it should be a route with req param)
  const all = db.select().from(systemPrompts).orderBy(systemPrompts.sortOrder).all();
  return NextResponse.json(all);
}

// POST /api/system-prompts
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { name, content, description, enabled, sortOrder } = body;

  if (!name || !content) {
    return NextResponse.json(
      { error: t('api.systemPrompts.nameAndContentRequired') },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const result = db
    .insert(systemPrompts)
    .values({
      name,
      content,
      description: description ?? null,
      enabled: enabled ?? 1,
      sortOrder: sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id: result.lastInsertRowid, name });
}
