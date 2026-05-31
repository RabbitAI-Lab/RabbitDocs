import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject, deleteProject, readProjectMeta, writeProjectMeta } from "@/lib/fs";

// GET /api/fs/projects?type=personal&accountId=default
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "personal") as "personal" | "enterprise";
  const accountId = searchParams.get("accountId") || "default";
  const orgId = searchParams.get("orgId") || undefined;

  const projects = listProjects(type, accountId, orgId);
  return NextResponse.json(projects);
}

// POST /api/fs/projects - create project
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", name, orgId } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const meta = createProject(type, accountId, name, orgId);
  return NextResponse.json(meta);
}

// DELETE /api/fs/projects - delete project
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", id, orgId } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  deleteProject(type, accountId, id, orgId);
  return NextResponse.json({ success: true });
}

// PATCH /api/fs/projects - update project (name / sortOrder)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { type = "personal", accountId = "default", id, name, sortOrder, orgId } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const accountSegments = type === "personal"
    ? ["personal", accountId]
    : orgId
      ? ["enterprise", accountId, orgId]
      : ["enterprise", accountId];
  const dirSegments = [...accountSegments, "projects", id];

  const meta = readProjectMeta(dirSegments);
  if (!meta) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (name !== undefined) meta.name = name;
  if (sortOrder !== undefined) meta.sortOrder = sortOrder;
  writeProjectMeta(meta, dirSegments);
  return NextResponse.json(meta);
}

// PUT /api/fs/projects - batch reorder projects
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
    const dirSegments = [...accountSegments, "projects", item.id];
    const meta = readProjectMeta(dirSegments);
    if (meta) {
      meta.sortOrder = item.sortOrder;
      writeProjectMeta(meta, dirSegments);
    }
  }
  return NextResponse.json({ success: true });
}
