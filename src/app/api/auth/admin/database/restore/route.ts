import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { restoreFromJson } from "@/lib/db-dump";
import type { DatabaseDump } from "@/lib/db-dump";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

interface RestoreRequest {
  data: DatabaseDump;
  options?: {
    skipTables?: string[];
  };
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const body = (await req.json()) as RestoreRequest;

    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json(
        { error: t('api.auth.database.dataFieldRequired') },
        { status: 400 }
      );
    }

    if (!body.data.version || !body.data.tables) {
      return NextResponse.json(
        { error: t('api.auth.database.invalidDumpFormat') },
        { status: 400 }
      );
    }

    if (body.data.version !== 1) {
      return NextResponse.json(
        { error: t('api.auth.database.unsupportedVersion') },
        { status: 400 }
      );
    }

    const result = restoreFromJson(body.data, body.options);

    if (result.errors.length > 0) {
      console.warn("[database] restore completed with warnings:", result.errors);
    }

    return NextResponse.json({ success: true, stats: result });
  } catch (error) {
    console.error("[database] restore error:", error);
    return NextResponse.json(
      { error: t('api.auth.database.restoreFailed') + ": " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
