import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/templates
export async function GET() {
  const all = db.select().from(templates).all();
  return NextResponse.json(all);
}

// POST /api/templates
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, content, icon, agentPrompt } = body;

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = db.insert(templates).values({
    name,
    description: description || null,
    content: content || "",
    icon: icon || null,
    agentPrompt: agentPrompt || "",
    createdAt: now,
    updatedAt: now,
  }).run();

  const newTemplate = db.select().from(templates).where(eq(templates.id, Number(result.lastInsertRowid))).get();
  return NextResponse.json(newTemplate);
}
