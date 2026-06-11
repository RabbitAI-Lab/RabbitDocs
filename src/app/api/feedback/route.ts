import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAdmin } from "@/lib/auth/session";
import { db } from "@/db";
import { feedbacks, users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getApiT } from "@/lib/i18n-api";
import { getTransporter, getFromAddress } from "@/lib/auth/mail";
import { getSetting } from "@/lib/auth/settings";

const feedbackSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  contact: z.string().max(200).optional(),
  type: z.enum(["bug", "improvement", "other"]),
});

/**
 * POST /api/feedback — 提交反馈（需登录）
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;
  const t = await getApiT();

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    await db.insert(feedbacks).values({
      userId: user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      contact: parsed.data.contact || null,
      type: parsed.data.type,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // 异步发送邮件通知管理员（不阻塞响应）
    sendFeedbackNotification({
      title: parsed.data.title,
      content: parsed.data.content,
      contact: parsed.data.contact,
      type: parsed.data.type,
      userName: user.name || user.email,
      userEmail: user.email,
    }).catch((err) => {
      console.error("[feedback] Failed to send notification email:", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[feedback] POST error:", error);
    return NextResponse.json(
      { error: t("api.internalError") },
      { status: 500 },
    );
  }
}

/**
 * GET /api/feedback — 查询反馈列表（需 admin）
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;
  const t = await getApiT();

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const status = searchParams.get("status") || undefined;

    const conditions = [];
    if (status) {
      conditions.push(
        eq(feedbacks.status, status as "pending" | "reviewed" | "resolved"),
      );
    }

    const offset = (page - 1) * pageSize;

    const items = await db
      .select({
        id: feedbacks.id,
        userId: feedbacks.userId,
        title: feedbacks.title,
        content: feedbacks.content,
        contact: feedbacks.contact,
        type: feedbacks.type,
        status: feedbacks.status,
        createdAt: feedbacks.createdAt,
        updatedAt: feedbacks.updatedAt,
        userEmail: users.email,
        userName: users.name,
      })
      .from(feedbacks)
      .leftJoin(users, eq(feedbacks.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(feedbacks.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(feedbacks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      items,
      total: countResult?.count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[feedback] GET error:", error);
    return NextResponse.json(
      { error: t("api.internalError") },
      { status: 500 },
    );
  }
}

/**
 * 异步发送反馈通知邮件给管理员
 */
async function sendFeedbackNotification(data: {
  title: string;
  content: string;
  contact?: string;
  type: string;
  userName: string;
  userEmail: string;
}) {
  const transporter = await getTransporter();
  if (!transporter) return;

  const adminEmail =
    (await getSetting("admin_email")) ||
    (await getSetting("smtp_from_email")) ||
    (await getSetting("smtp_user"));
  if (!adminEmail) return;

  const typeLabel =
    data.type === "bug"
      ? "Bug Report"
      : data.type === "improvement"
        ? "Improvement"
        : "Other";

  const subject = `[Feedback] ${data.title}`;
  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <h2 style="color:#333;margin-bottom:16px">New Feedback Received</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#888;width:100px">Type:</td><td style="padding:8px 0">${typeLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#888">From:</td><td style="padding:8px 0">${data.userName} (${data.userEmail})</td></tr>
        ${data.contact ? `<tr><td style="padding:8px 0;color:#888">Contact:</td><td style="padding:8px 0">${data.contact}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#888">Title:</td><td style="padding:8px 0">${data.title}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px">
        <p style="margin:0;white-space:pre-wrap">${data.content}</p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: await getFromAddress(),
    to: adminEmail,
    subject,
    html,
  });
}
