import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  readProjectMeta,
  writeProjectMeta,
  addMember,
  removeMember,
  updateMember,
} from "@/lib/fs";
import { logOperation, extractProjectId } from "@/lib/operation-log";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ProjectMember } from "@/lib/fs";
import { getApiT } from "@/lib/i18n-api";

// GET /api/fs/project-members?dirSegments=personal/{userId}/projects/{id}
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const dirSegmentsStr = searchParams.get("dirSegments");
  const t = await getApiT();
  if (!dirSegmentsStr) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  const dirSegments = dirSegmentsStr.split("/");
  const meta = readProjectMeta(dirSegments);
  if (!meta) {
    return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
  }
  return NextResponse.json(meta.members || []);
}

// POST /api/fs/project-members - add a member (owner only)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, member } = body;
  if (!dirSegments || !member) {
    return NextResponse.json({ error: t('api.members.dirSegmentsAndMemberRequired') }, { status: 400 });
  }
  try {
    // Owner 校验：只有 owner 才能添加成员
    const meta = readProjectMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
    }
    if (auth.id !== meta.ownerId) {
      return NextResponse.json({ error: t('api.members.onlyOwnerCanAdd') }, { status: 403 });
    }

    // 根据 accountName 查询用户表自动关联 userId
    if (!member.userId && member.accountName) {
      const userRow = db.select().from(users).where(eq(users.email, member.accountName)).get()
        ?? db.select().from(users).where(eq(users.name, member.accountName)).get();
      if (userRow) {
        member.userId = userRow.id;
      } else {
        return NextResponse.json(
          { error: t('api.members.userNotFoundByName') },
          { status: 404 }
        );
      }
    }
    const members = addMember(dirSegments, member);
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

// PATCH /api/fs/project-members - update a member (owner only)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, memberId, updates } = body;
  if (!dirSegments || !memberId || !updates) {
    return NextResponse.json({ error: t('api.missingRequiredParams') }, { status: 400 });
  }
  try {
    // Owner 校验
    const meta = readProjectMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
    }
    if (auth.id !== meta.ownerId) {
      return NextResponse.json({ error: t('api.members.onlyOwnerCanUpdate') }, { status: 403 });
    }

    const updated = updateMember(dirSegments, memberId, updates);
    if (!updated) {
      return NextResponse.json({ error: t('api.memberNotFound') }, { status: 404 });
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

// DELETE /api/fs/project-members - remove a member (owner only)
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, memberId } = body;
  if (!dirSegments || !memberId) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  try {
    const meta = readProjectMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
    }
    // Owner 校验：只有 owner 才能移除成员
    if (auth.id !== meta.ownerId) {
      return NextResponse.json({ error: t('api.members.onlyOwnerCanRemove') }, { status: 403 });
    }
    const memberName = meta.members?.find((m) => m.id === memberId)?.accountName || memberId;
    removeMember(dirSegments, memberId);
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

// PUT /api/fs/project-members - transfer ownership (owner only)
// Body: { dirSegments, memberId } — memberId is the member to become new owner
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req); if (auth instanceof NextResponse) return auth;
  const t = await getApiT();
  const body = await req.json();
  const { dirSegments, memberId } = body;
  if (!dirSegments || !memberId) {
    return NextResponse.json({ error: t('api.dirSegmentsRequired') }, { status: 400 });
  }
  try {
    const meta = readProjectMeta(dirSegments);
    if (!meta) {
      return NextResponse.json({ error: t('api.projectNotFound') }, { status: 404 });
    }
    // Owner 校验
    if (auth.id !== meta.ownerId) {
      return NextResponse.json({ error: t('api.members.onlyOwnerCanUpdate') }, { status: 403 });
    }

    // 找到目标成员
    const targetMember = meta.members?.find((m) => m.id === memberId);
    if (!targetMember) {
      return NextResponse.json({ error: t('api.memberNotFound') }, { status: 404 });
    }
    if (!targetMember.userId) {
      return NextResponse.json({ error: t('api.members.cannotTransferToUnlinkedUser') }, { status: 400 });
    }

    const oldOwnerId = meta.ownerId;
    const newOwnerId = targetMember.userId;

    // 查询旧 Owner 的显示名称
    let oldOwnerName = oldOwnerId;
    const oldOwnerRow = db.select().from(users).where(eq(users.id, oldOwnerId)).get();
    if (oldOwnerRow) {
      oldOwnerName = oldOwnerRow.email || oldOwnerRow.name || oldOwnerId;
    }

    // 1. 从 members 中移除新 Owner
    meta.members = (meta.members || []).filter((m) => m.id !== memberId);

    // 2. 将旧 Owner 加入 members（如果还不在的话）
    const alreadyInMembers = meta.members.some((m) => m.userId === oldOwnerId);
    if (!alreadyInMembers) {
      const oldOwnerMember: ProjectMember = {
        id: `owner-${oldOwnerId}`,
        accountName: oldOwnerName,
        userId: oldOwnerId,
        addedAt: new Date().toISOString(),
      };
      meta.members.push(oldOwnerMember);
    }

    // 3. 更新 ownerId
    meta.ownerId = newOwnerId;

    // 4. 写回 .project.json
    writeProjectMeta(meta, dirSegments);

    logOperation({
      projectId: extractProjectId(dirSegments),
      category: "member",
      action: "update",
      detail: `转让 Owner 给 ${targetMember.accountName}`,
    });

    return NextResponse.json({ members: meta.members, ownerId: meta.ownerId });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
