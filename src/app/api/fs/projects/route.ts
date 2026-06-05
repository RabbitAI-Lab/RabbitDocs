import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listProjects, createProject, deleteProject, readProjectMeta, writeProjectMeta } from "@/lib/fs";
import { db } from "@/db";
import { entityMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/projects?type=personal&accountId={userId}
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "personal") as "personal" | "enterprise";
  const accountId = searchParams.get("accountId") || auth.id;
  const orgId = searchParams.get("orgId") || undefined;

  const projects = listProjects(type, accountId, orgId);
  const ownedIds = new Set(projects.map((p) => p.id));

  // 查询用户作为成员的项目（DB索引），不依赖 symlink
  if (type === "personal") {
    try {
      const memberRows = db
        .select({
          entityId: entityMembers.entityId,
          ownerId: entityMembers.ownerId,
        })
        .from(entityMembers)
        .where(
          and(
            eq(entityMembers.userId, accountId),
            eq(entityMembers.entityType, "project")
          )
        )
        .all();

      for (const row of memberRows) {
        if (ownedIds.has(row.entityId)) continue;
        const meta = readProjectMeta(["personal", row.ownerId, "projects", row.entityId]);
        if (meta) {
          projects.push(meta);
          ownedIds.add(row.entityId);
        }
      }
    } catch (e) {
      console.warn("[projects] Failed to load member projects from DB:", e);
    }
  }

  return NextResponse.json(projects);
}

// POST /api/fs/projects - create project
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { type = "personal", accountId = auth.id, name, orgId } = body;
  if (!name) return NextResponse.json({ error: t('api.nameRequired') }, { status: 400 });

  const meta = createProject(type, accountId, name, orgId);
  return NextResponse.json(meta);
}

// DELETE /api/fs/projects - delete project
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { type = "personal", accountId = auth.id, id, orgId } = body;
  if (!id) return NextResponse.json({ error: t('api.idRequired') }, { status: 400 });

  deleteProject(type, accountId, id, orgId);
  return NextResponse.json({ success: true });
}

// PATCH /api/fs/projects - update project (name / sortOrder)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { type = "personal", accountId = auth.id, id, name, sortOrder, orgId } = body;
  if (!id) return NextResponse.json({ error: t('api.idRequired') }, { status: 400 });

  const accountSegments = type === "personal"
    ? ["personal", accountId]
    : orgId
      ? ["enterprise", accountId, orgId]
      : ["enterprise", accountId];
  const dirSegments = [...accountSegments, "projects", id];

  const meta = readProjectMeta(dirSegments);
  if (!meta) return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });

  if (name !== undefined) meta.name = name;
  if (sortOrder !== undefined) meta.sortOrder = sortOrder;
  writeProjectMeta(meta, dirSegments);
  return NextResponse.json(meta);
}

// PUT /api/fs/projects - batch reorder projects
// Body: { type, accountId, orgId?, orders: [{ id, sortOrder }] }
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { type = "personal", accountId = auth.id, orders, orgId } = body;
  if (!Array.isArray(orders)) return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });

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
