import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

// GET /api/plans
export async function GET() {
  const all = db.select().from(plans).orderBy(plans.sortOrder).all();
  return NextResponse.json(all);
}

// POST /api/plans
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { title, description, defaultCurrency, prices, discountType, discountValue, features, enabled, sortOrder } = body;

  if (!title) {
    return NextResponse.json(
      { error: t('api.plans.titleRequired') },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const result = db
    .insert(plans)
    .values({
      title,
      description: description ?? null,
      defaultCurrency: defaultCurrency ?? "CNY",
      prices: typeof prices === "string" ? prices : JSON.stringify(prices ?? []),
      discountType: discountType ?? "none",
      discountValue: discountValue ?? 0,
      features: typeof features === "string" ? features : JSON.stringify(features ?? []),
      enabled: enabled ?? 1,
      sortOrder: sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ id: result.lastInsertRowid, title });
}
