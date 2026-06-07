import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  readDocument,
  writeDocument,
  deleteDocument,
  renameDocument,
  listDocuments,
  listTree,
  readHtmlDocument,
  writeHtmlDocument,
  deleteHtmlDocument,
} from "@/lib/fs";
import { db } from "@/db";
import { documentActivities, sharedHtmlFiles, users } from "@/db/schema";
import { parsePath } from "../utils";
import { getMcpUserId } from "../context";

/**
 * 校验路径是否在 docs 目录下。
 * 期望格式：projects/{projectId}/docs/...
 * 返回错误信息，如果合法则返回 null。
 */
function requireDocsPath(segments: string[]): string | null {
  if (segments.length < 3) {
    return `Path must be under the docs directory (format: projects/{projectId}/docs/...). Got: ${segments.join("/")}`;
  }
  if (segments[0] !== "projects" || segments[2] !== "docs") {
    return `File operations are only allowed under the docs directory. Expected format: projects/{projectId}/docs/... Got: ${segments.join("/")}`;
  }
  return null;
}

/**
 * 校验路径最后一段以 .html 结尾。
 */
function requireHtmlExtension(segments: string[]): string | null {
  const last = segments[segments.length - 1];
  if (!last || !last.endsWith(".html")) {
    return `HTML file path must end with .html. Got: "${last}"`;
  }
  return null;
}

/**
 * 从 docs 路径段中解析 projectId 与 htmlPath（相对项目根目录，含 .html）。
 * 期望：segments = ["projects", "{projectId}", "docs", ...]
 */
function parseHtmlMeta(segments: string[]): { projectId: string; htmlPath: string; title: string } | null {
  if (segments.length < 4 || segments[0] !== "projects" || segments[2] !== "docs") return null;
  const projectId = segments[1];
  const docSegments = segments.slice(3);
  const htmlPath = docSegments.join("/");
  const title = (docSegments[docSegments.length - 1] || "").replace(/\.html$/, "");
  return { projectId, htmlPath, title };
}

/**
 * 记录 HTML 文档活动（create/update/delete）。
 */
function recordHtmlActivity(
  projectId: string,
  htmlPath: string,
  title: string,
  action: "create" | "update" | "delete"
): void {
  const userId = getMcpUserId();
  db.insert(documentActivities)
    .values({
      projectId,
      documentPath: htmlPath,
      documentTitle: title,
      action,
      userId,
      createdAt: new Date().toISOString(),
    })
    .run();
}

/**
 * 删除与某个 HTML 文件关联的分享记录（级联清理）。
 */
function deleteSharedHtmlFiles(projectId: string, htmlPath: string): void {
  db.delete(sharedHtmlFiles)
    .where(
      and(
        eq(sharedHtmlFiles.projectId, projectId),
        eq(sharedHtmlFiles.htmlPath, htmlPath)
      )
    )
    .run();
}

export function registerFileTools(server: McpServer) {
  server.registerTool(
    "read_file",
    {
      description:
        "读取文件内容（Markdown 文档）。路径格式如：projects/{projectId}/docs/doc-name。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "文件路径，如 projects/{projectId}/docs/doc-name。"
          ),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      const invalid = requireDocsPath(segments);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      const content = readDocument(...segments);
      if (content === null) {
        return {
          content: [{ type: "text", text: "File not found" }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: content }] };
    }
  );

  server.registerTool(
    "write_file",
    {
      description:
        "创建或写入文件（Markdown 文档）。如果文件已存在则覆盖，父目录不存在则自动创建。路径格式如：projects/{projectId}/docs/doc-name。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "文件路径，如 projects/{projectId}/docs/doc-name。"
          ),
        content: z.string().describe("文件内容（Markdown）"),
      }),
    },
    async ({ path, content }) => {
      const segments = parsePath(path);
      const invalid = requireDocsPath(segments);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      writeDocument(content, ...segments);
      return {
        content: [{ type: "text", text: `File written: ${path}` }],
      };
    }
  );

  server.registerTool(
    "delete_file",
    {
      description:
        "删除文件。路径格式如：projects/{projectId}/docs/doc-name。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "文件路径，如 projects/{projectId}/docs/doc-name。"
          ),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      const invalid = requireDocsPath(segments);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      deleteDocument(...segments);
      return {
        content: [{ type: "text", text: `File deleted: ${path}` }],
      };
    }
  );

  server.registerTool(
    "rename_file",
    {
      description:
        "重命名文件（修改文件标题）。路径格式如：projects/{projectId}/docs/doc-name。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "文件当前路径，如 projects/{projectId}/docs/doc-name。"
          ),
        newTitle: z.string().describe("新的文件标题（不含扩展名）"),
      }),
    },
    async ({ path, newTitle }) => {
      const segments = parsePath(path);
      const invalid = requireDocsPath(segments);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      renameDocument(newTitle, ...segments);
      return {
        content: [{ type: "text", text: `File renamed to: ${newTitle}` }],
      };
    }
  );

  server.registerTool(
    "list_files",
    {
      description:
        "列出目录下的所有 .md 文件。路径格式如：projects/{projectId}/docs。",
      inputSchema: z.object({
        path: z
          .string()
          .describe("目录路径，如 projects/{projectId}/docs。"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      const invalid = requireDocsPath(segments);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      const files = listDocuments(...segments);
      return {
        content: [
          { type: "text", text: JSON.stringify(files, null, 2) },
        ],
      };
    }
  );

  server.registerTool(
    "read_tree",
    {
      description:
        "获取目录树结构，递归列出所有子目录和 .md 文件。路径格式如：projects/{projectId}/docs。",
      inputSchema: z.object({
        path: z
          .string()
          .describe("目录路径，如 projects/{projectId}/docs。"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      const invalid = requireDocsPath(segments);
      if (invalid) {
        return { content: [{ type: "text", text: invalid }], isError: true };
      }
      const tree = listTree(segments, [".md", ".html"])
      return {
        content: [{ type: "text", text: JSON.stringify(tree, null, 2) }],
      };
    }
  );

  // ──────────── HTML tools (.html files under docs/) ────────────

  server.registerTool(
    "create_html",
    {
      description:
        "在 docs 目录下创建 .html 文件。路径必须以 .html 结尾，如 projects/{projectId}/docs/index.html。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "HTML 文件路径（必须以 .html 结尾），如 projects/{projectId}/docs/index.html。"
          ),
        content: z.string().describe("HTML 文件内容（完整 HTML 源码）"),
      }),
    },
    async ({ path, content }) => {
      const segments = parsePath(path);
      const invalidPath = requireDocsPath(segments);
      if (invalidPath) {
        return { content: [{ type: "text", text: invalidPath }], isError: true };
      }
      const invalidExt = requireHtmlExtension(segments);
      if (invalidExt) {
        return { content: [{ type: "text", text: invalidExt }], isError: true };
      }
      const meta = parseHtmlMeta(segments);
      writeHtmlDocument(content, ...segments);
      if (meta) {
        recordHtmlActivity(meta.projectId, meta.htmlPath, meta.title, "create");
      }
      return {
        content: [{ type: "text", text: `HTML file created: ${path}` }],
      };
    }
  );

  server.registerTool(
    "update_html",
    {
      description:
        "更新 docs 目录下的 .html 文件。路径必须以 .html 结尾。文件不存在将报错。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "HTML 文件路径（必须以 .html 结尾），如 projects/{projectId}/docs/index.html。"
          ),
        content: z.string().describe("新的 HTML 文件内容（完整 HTML 源码）"),
      }),
    },
    async ({ path, content }) => {
      const segments = parsePath(path);
      const invalidPath = requireDocsPath(segments);
      if (invalidPath) {
        return { content: [{ type: "text", text: invalidPath }], isError: true };
      }
      const invalidExt = requireHtmlExtension(segments);
      if (invalidExt) {
        return { content: [{ type: "text", text: invalidExt }], isError: true };
      }
      const existing = readHtmlDocument(...segments);
      if (existing === null) {
        return {
          content: [{ type: "text", text: `HTML file not found: ${path}` }],
          isError: true,
        };
      }
      const meta = parseHtmlMeta(segments);
      writeHtmlDocument(content, ...segments);
      if (meta) {
        recordHtmlActivity(meta.projectId, meta.htmlPath, meta.title, "update");
      }
      return {
        content: [{ type: "text", text: `HTML file updated: ${path}` }],
      };
    }
  );

  server.registerTool(
    "delete_html",
    {
      description:
        "删除 docs 目录下的 .html 文件。同时会清理该文件关联的所有分享链接。",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "HTML 文件路径（必须以 .html 结尾），如 projects/{projectId}/docs/index.html。"
          ),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      const invalidPath = requireDocsPath(segments);
      if (invalidPath) {
        return { content: [{ type: "text", text: invalidPath }], isError: true };
      }
      const invalidExt = requireHtmlExtension(segments);
      if (invalidExt) {
        return { content: [{ type: "text", text: invalidExt }], isError: true };
      }
      const meta = parseHtmlMeta(segments);
      deleteHtmlDocument(...segments);
      if (meta) {
        // 级联清理分享记录
        deleteSharedHtmlFiles(meta.projectId, meta.htmlPath);
        recordHtmlActivity(meta.projectId, meta.htmlPath, meta.title, "delete");
      }
      return {
        content: [{ type: "text", text: `HTML file deleted: ${path}` }],
      };
    }
  );

  // ──────────── Recent documents ────────────

  server.registerTool(
    "list_recent_documents",
    {
      description:
        "获取最近更新的文档列表，按操作时间倒序排列。可选按项目筛选，支持分页。",
      inputSchema: z.object({
        projectId: z.string().optional().describe("按项目 ID 筛选"),
        limit: z.number().optional().describe("返回条数，默认 10"),
        offset: z.number().optional().describe("偏移量，默认 0"),
      }),
    },
    async ({ projectId, limit = 10, offset = 0 }) => {
      const rows = db
        .select({
          id: documentActivities.id,
          projectId: documentActivities.projectId,
          documentPath: documentActivities.documentPath,
          documentTitle: documentActivities.documentTitle,
          action: documentActivities.action,
          userId: documentActivities.userId,
          userName: users.name,
          createdAt: documentActivities.createdAt,
        })
        .from(documentActivities)
        .leftJoin(users, eq(documentActivities.userId, users.id))
        .where(projectId ? eq(documentActivities.projectId, projectId) : undefined)
        .orderBy(desc(documentActivities.createdAt))
        .limit(limit)
        .offset(offset)
        .all();
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }
  );
}
