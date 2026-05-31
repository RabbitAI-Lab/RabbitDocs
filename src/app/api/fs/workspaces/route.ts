import { NextRequest, NextResponse } from "next/server";
import { listWorkspaces, createWorkspace, deleteWorkspace, readWorkspaceMeta, writeWorkspaceMeta } from "@/lib/fs";

// GET /api/fs/workspaces?type=personal&accountId=default
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "personal") as "personal" | "enterprise";
  const accountId = searchParams.get("accountId") || "default";
  const orgId = searchParams.get("orgId") || undefined;

  const workspaces = listWorkspaces(type, accountId, orgId);
  return NextResponse.json(workspaces);
}

// POST /api/fs/workspaces - create workspace
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", name, orgId } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const meta = createWorkspace(type, accountId, name, orgId);
  return NextResponse.json(meta);
}

// DELETE /api/fs/workspaces - delete workspace
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", id, orgId } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  deleteWorkspace(type, accountId, id, orgId);
  return NextResponse.json({ success: true });
}

// PATCH /api/fs/workspaces - update workspace (rename / sortOrder)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", id, name, sortOrder, orgId } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const accountSegments = type === "personal"
    ? ["personal", accountId]
    : orgId
      ? ["enterprise", accountId, orgId]
      : ["enterprise", accountId];
  const dirSegments = [...accountSegments, "workspace", id];

  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (name !== undefined) meta.name = name;
  if (sortOrder !== undefined) meta.sortOrder = sortOrder;
  writeWorkspaceMeta(meta, dirSegments);
  return NextResponse.json(meta);
}

// PUT /api/fs/workspaces - batch reorder workspaces
// Body: { type, accountId, orgId?, orders: [{ id, sortOrder }] }
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", orders, orgId } = body;
  if (!Array.isArray(orders)) return NextResponse.json({ error: "orders array is required" }, { status: 400 });

  const accountSegments = type === "personal"
    ? ["personal", accountId]
    : orgId
      ? ["enterprise", accountId, orgId]
      : ["enterprise", accountId];

  for (const item of orders) {
    const dirSegments = [...accountSegments, "workspace", item.id];
    const meta = readWorkspaceMeta(dirSegments);
    if (meta) {
      meta.sortOrder = item.sortOrder;
      writeWorkspaceMeta(meta, dirSegments);
    }
  }
  return NextResponse.json({ success: true });
}
