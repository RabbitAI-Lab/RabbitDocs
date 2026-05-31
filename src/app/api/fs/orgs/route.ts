import { NextRequest, NextResponse } from "next/server";
import { listOrgs } from "@/lib/fs";

// GET /api/fs/orgs?enterpriseId=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const enterpriseId = searchParams.get("enterpriseId") || "";

  if (!enterpriseId) {
    return NextResponse.json({ error: "enterpriseId is required" }, { status: 400 });
  }

  const orgs = listOrgs(enterpriseId);
  return NextResponse.json(orgs);
}

// POST /api/fs/orgs - placeholder for future
export async function POST() {
  return NextResponse.json({ error: "Not implemented yet" }, { status: 501 });
}

// DELETE /api/fs/orgs - placeholder for future
export async function DELETE() {
  return NextResponse.json({ error: "Not implemented yet" }, { status: 501 });
}
