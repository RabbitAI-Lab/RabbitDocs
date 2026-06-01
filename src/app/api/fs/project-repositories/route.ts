import { NextRequest, NextResponse } from "next/server";
import {
  readProjectMeta,
  addRepository,
  removeRepository,
  updateRepository,
} from "@/lib/fs";

// GET /api/fs/project-repositories?dirSegments=personal,default,projects,{id}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  if (!dirSegmentsStr) {
    return NextResponse.json({ error: "dirSegments is required" }, { status: 400 });
  }
  const dirSegments = dirSegmentsStr.split(",");
  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(meta.repositories || []);
}

// POST /api/fs/project-repositories - add a repository
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repository } = body;
  if (!dirSegments || !repository) {
    return NextResponse.json({ error: "dirSegments and repository are required" }, { status: 400 });
  }
  try {
    const repositories = addRepository(dirSegments, repository);
    return NextResponse.json(repositories);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// PATCH /api/fs/project-repositories - update a repository
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repoId, updates } = body;
  if (!dirSegments || !repoId || !updates) {
    return NextResponse.json({ error: "dirSegments, repoId and updates are required" }, { status: 400 });
  }
  try {
    const updated = updateRepository(dirSegments, repoId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Repository not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// DELETE /api/fs/project-repositories - remove a repository
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, repoId } = body;
  if (!dirSegments || !repoId) {
    return NextResponse.json({ error: "dirSegments and repoId are required" }, { status: 400 });
  }
  try {
    removeRepository(dirSegments, repoId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
