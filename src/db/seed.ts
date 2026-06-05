import { db } from "./index";
import { accounts, templates, systemPrompts } from "./schema";
import { migrateMetaToDb } from "@/lib/fs/migrate-meta-to-db";
import { backfillEntityMembers } from "@/lib/fs/backfill-members";

export async function seed() {
  console.log("[seed] Seeding database...");

  // 插入默认账号
  const existingAccount = db.select().from(accounts).get();
  if (!existingAccount) {
    db.insert(accounts).values({
      name: "Default",
      type: "personal",
      createdAt: new Date().toISOString(),
    }).run();
    console.log("[seed] Default account created.");
  } else {
    console.log("[seed] Default account already exists.");
  }

  // 插入预制模板
  const existingTemplates = db.select().from(templates).all();
  if (existingTemplates.length === 0) {
    const templateData = [
      {
        name: "Meeting Minutes",
        description: "Standard meeting notes template",
        icon: "📋",
        content: `# Meeting Minutes

## Meeting Info
- **Date**:
- **Attendees**:
- **Facilitator**:

## Agenda
1. 
2. 
3. 

## Discussion

### Topic 1
- 

### Topic 2
- 

## Decisions
- 

## Action Items
- [ ] Todo item
`,
        agentPrompt: "You are a professional meeting notes assistant. Based on the meeting discussion content provided by the user, organize it into well-structured meeting minutes. Include: meeting info, agenda, discussion points, decisions, and action items. Use concise and formal language. Output in Markdown format.",
      },
      {
        name: "Project Proposal",
        description: "Project proposal document template",
        icon: "📄",
        content: `# Project Proposal

## Overview
-

## Background & Goals
-

## Scope & Deliverables
-

## Timeline
-

## Resource Requirements
-

## Risk Assessment
-
`,
        agentPrompt: "You are a project management consultant. Help users write complete project proposal documents. Ensure the document includes overview, background & goals, scope & deliverables, timeline, resource requirements, and risk assessment sections. Provide professional advice. Output in Markdown format.",
      },
      {
        name: "Product Requirements",
        description: "Product Requirements Document (PRD) template",
        icon: "📝",
        content: `# Product Requirements Document

## Overview
-

## User Stories
-

## Functional Requirements
-

## Non-Functional Requirements
-

## Acceptance Criteria
-

## Prototypes / Designs
-
`,
        agentPrompt: "You are a product manager assistant. Help users write Product Requirements Documents (PRD). Ensure the document includes overview, user stories, functional requirements, non-functional requirements, and acceptance criteria. Think with a user-value-oriented mindset. Output in Markdown format.",
      },
      {
        name: "Technical Design",
        description: "Technical design document template",
        icon: "⚙️",
        content: `# Technical Design

## Background
-

## Architecture Design
-

## Technology Stack
-

## API Design
-

## Database Design
-

## Deployment Plan
-
`,
        agentPrompt: "You are a senior architect. Help users write technical design documents. Ensure the document includes background analysis, architecture design, technology stack rationale, API design, database design, and deployment plan. Focus on scalability and maintainability. Output in Markdown format.",
      },
      {
        name: "Blog Post",
        description: "Blog post template",
        icon: "✍️",
        content: `# Blog Title

## Introduction
-

## Main Content
-

## Summary
-
`,
        agentPrompt: "You are a content creation assistant. Help users write high-quality blog posts. Focus on headline appeal, content depth, readability, and SEO optimization. Use clear paragraph structure and appropriate Markdown formatting.",
      },
      {
        name: "Release Notes",
        description: "Version release notes template",
        icon: "🚀",
        content: `# Release Notes

## Version
-

## Release Date
-

## New Features
-

## Bug Fixes
-

## Known Issues
-

## Upgrade Guide
-
`,
        agentPrompt: "You are a technical documentation assistant. Help users generate standardized release notes. Ensure the document includes version number, release date, new features, bug fixes, known issues, and upgrade guide sections. Output in Markdown format.",
      },
    ];

    for (const t of templateData) {
      const now = new Date().toISOString();
      db.insert(templates).values({ ...t, isSystem: 1, createdAt: now, updatedAt: now }).run();
    }
    console.log(`[seed] ${templateData.length} templates created.`);
  } else {
    console.log(`[seed] ${existingTemplates.length} templates already exist.`);
  }

  // 插入内置系统提示词
  const existingSystemPrompts = db.select().from(systemPrompts).all();
  if (existingSystemPrompts.length === 0) {
    const now = new Date().toISOString();
    db.insert(systemPrompts).values({
      name: "Wiki",
      content: `For Wiki CRUD operations, use the RabbitDocs MCP.
Before using the RabbitDocs MCP, check if it is already installed.
MCP configuration:
{
  "rabbitdocs": {
    "type": "http",
    "url": "http://127.0.0.1:4001/mcp"
  }
}`,
      description: null,
      enabled: 1,
      sortOrder: 0,
      isSystem: 1,
      createdAt: now,
      updatedAt: now,
    }).run();
    console.log("[seed] Built-in Wiki system prompt created.");
  } else {
    console.log(`[seed] ${existingSystemPrompts.length} system prompts already exist.`);
  }

  // 迁移元数据到 DB（在 backfill 之前，因为 migrateMetaToDb 已包含 member 回填）
  migrateMetaToDb();

  // 回填成员索引（兜底：如果 migrateMetaToDb 未覆盖的场景）
  backfillEntityMembers();

  console.log("[seed] Done.");
}
