import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth/settings";

/**
 * GET /api/public/color-scheme
 * Public (no auth required) endpoint that returns the current color scheme.
 * Cached for 60s at CDN/browser level.
 */
export async function GET() {
  const raw = getSetting("color_scheme");
  if (!raw) {
    return NextResponse.json(null, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }
  try {
    const scheme = JSON.parse(raw);
    return NextResponse.json(scheme, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(null, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }
}
