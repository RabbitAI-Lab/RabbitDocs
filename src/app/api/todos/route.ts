import { NextResponse } from "next/server";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/auth/with-auth";
import { getApiT } from "@/lib/i18n-api";

// GET /api/todos
export const GET = withAuth(async (_req, user) => {
  const all = db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
    .orderBy(desc(todos.createdAt))
    .all();
  return NextResponse.json(all);
});

// POST /api/todos
export const POST = withAuth(async (req, user) => {
  const t = await getApiT();
  const body = await req.json();
  const { title, description } = body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: t('api.todos.titleRequired') }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: t('api.todos.titleMaxLength') }, { status: 400 });
  }
  if (description && typeof description === "string" && description.length > 100) {
    return NextResponse.json({ error: t('api.todos.titleMaxLength') }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = db.insert(todos).values({
    userId: user.id,
    title: title.trim(),
    description: (description || "").trim(),
    completed: 0,
    createdAt: now,
    updatedAt: now,
  }).run();

  const newTodo = db.select().from(todos).where(eq(todos.id, Number(result.lastInsertRowid))).get();
  return NextResponse.json(newTodo);
});

// PUT /api/todos
export const PUT = withAuth(async (req, user) => {
  const t = await getApiT();
  const body = await req.json();
  const { id, title, description, completed } = body;

  if (!id) {
    return NextResponse.json({ error: t('api.idRequired') }, { status: 400 });
  }

  const existing = db.select().from(todos).where(eq(todos.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: t('api.todos.todoNotFound') }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: t('api.todos.titleRequired') }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: t('api.todos.titleMaxLength') }, { status: 400 });
    }
    updates.title = title.trim();
  }
  if (description !== undefined) {
    if (description.length > 100) {
      return NextResponse.json({ error: t('api.todos.titleMaxLength') }, { status: 400 });
    }
    updates.description = description.trim();
  }
  if (completed !== undefined) {
    updates.completed = completed ? 1 : 0;
  }

  db.update(todos).set(updates).where(eq(todos.id, id)).run();
  const updated = db.select().from(todos).where(eq(todos.id, id)).get();
  return NextResponse.json(updated);
});

// DELETE /api/todos
export const DELETE = withAuth(async (req, user) => {
  const t = await getApiT();
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: t('api.idRequired') }, { status: 400 });
  }

  const existing = db.select().from(todos).where(eq(todos.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: t('api.todos.todoNotFound') }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: t('api.forbidden') }, { status: 403 });
  }

  db.delete(todos).where(eq(todos.id, id)).run();
  return NextResponse.json({ success: true });
});
