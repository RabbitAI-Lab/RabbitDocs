import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { generateJsonDump, generateSqlDump } from "@/lib/db-dump";
import { getApiT } from "@/lib/i18n-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";

  if (format !== "json" && format !== "sql") {
    return NextResponse.json(
      { error: t('api.auth.database.invalidFormat') },
      { status: 400 }
    );
  }

  try {
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      const dump = generateJsonDump();
      const filename = `rabbitdocs-dump-${timestamp}.json`;
      return new Response(JSON.stringify(dump, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else {
      const sql = generateSqlDump();
      const filename = `rabbitdocs-dump-${timestamp}.sql`;
      return new Response(sql, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error("[database] dump error:", error);
    return NextResponse.json(
      { error: t('api.auth.database.failedToDump') },
      { status: 500 }
    );
  }
}
