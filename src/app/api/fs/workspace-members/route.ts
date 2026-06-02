import { NextRequest, NextResponse } from "next/server";
import {
  readWorkspaceMeta,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMember,
} from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";

// GET /api/fs/workspace-members?dirSegments=personal,default,workspace,{id}
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  if (!dirSegmentsStr) {
    return NextResponse.json({ error: "dirSegments is required" }, { status: 400 });
  }
  const dirSegments = dirSegmentsStr.split(",");
  const meta = readWorkspaceMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return NextResponse.json(meta.members || []);
}

// POST /api/fs/workspace-members - add a member
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, member } = body;
  if (!dirSegments || !member) {
    return NextResponse.json({ error: "dirSegments and member are required" }, { status: 400 });
  }
  try {
    const members = addWorkspaceMember(dirSegments, member);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "create",
      detail: `添加了成员 ${member.accountName}`,
    });
    return NextResponse.json(members);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// PATCH /api/fs/workspace-members - update a member
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, memberId, updates } = body;
  if (!dirSegments || !memberId || !updates) {
    return NextResponse.json({ error: "dirSegments, memberId and updates are required" }, { status: 400 });
  }
  try {
    const updated = updateWorkspaceMember(dirSegments, memberId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "update",
      detail: `更新了成员 ${updated.accountName}`,
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

// DELETE /api/fs/workspace-members - remove a member
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { dirSegments, memberId } = body;
  if (!dirSegments || !memberId) {
    return NextResponse.json({ error: "dirSegments and memberId are required" }, { status: 400 });
  }
  try {
    const meta = readWorkspaceMeta(dirSegments);
    const memberName = meta?.members?.find((m) => m.id === memberId)?.accountName || memberId;
    removeWorkspaceMember(dirSegments, memberId);
    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "delete",
      detail: `移除了成员 ${memberName}`,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
