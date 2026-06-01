import { NextRequest, NextResponse } from "next/server";
import {
  readProjectMeta,
  addMember,
  removeMember,
  updateMember,
} from "@/lib/fs";

// GET /api/fs/project-members?dirSegments=personal,default,projects,{id}
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
  return NextResponse.json(meta.members || []);
}

// POST /api/fs/project-members - add a member
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, member } = body;
  if (!dirSegments || !member) {
    return NextResponse.json({ error: "dirSegments and member are required" }, { status: 400 });
  }
  try {
    const members = addMember(dirSegments, member);
    return NextResponse.json(members);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// PATCH /api/fs/project-members - update a member
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, memberId, updates } = body;
  if (!dirSegments || !memberId || !updates) {
    return NextResponse.json({ error: "dirSegments, memberId and updates are required" }, { status: 400 });
  }
  try {
    const updated = updateMember(dirSegments, memberId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// DELETE /api/fs/project-members - remove a member
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, memberId } = body;
  if (!dirSegments || !memberId) {
    return NextResponse.json({ error: "dirSegments and memberId are required" }, { status: 400 });
  }
  try {
    removeMember(dirSegments, memberId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
