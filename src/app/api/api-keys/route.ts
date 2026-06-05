import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listApiKeys, createApiKey } from "@/lib/auth/api-key";
import { z } from "zod";
import { getApiT } from "@/lib/i18n-api";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const keys = listApiKeys(authResult.id);
  return NextResponse.json({
    keys: keys.map((k) => ({
      ...k,
      isSystem: k.isSystem === 1,
    })),
  });
}

const createSchema = z.object({
  name: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    const name = parsed.success ? parsed.data.name : undefined;

    const result = createApiKey(authResult.id, name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : t('api.apiKeys.failedToCreate');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
