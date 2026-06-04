import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { restoreFromJson } from "@/lib/db-dump";
import type { DatabaseDump } from "@/lib/db-dump";

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

  try {
    const body = (await req.json()) as RestoreRequest;

    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json(
        { error: "Invalid request: 'data' field is required" },
        { status: 400 }
      );
    }

    if (!body.data.version || !body.data.tables) {
      return NextResponse.json(
        { error: "Invalid dump format: missing 'version' or 'tables' field" },
        { status: 400 }
      );
    }

    if (body.data.version !== 1) {
      return NextResponse.json(
        { error: `Unsupported dump version: ${body.data.version}` },
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
      { error: "Restore failed: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
