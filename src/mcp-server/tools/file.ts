import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  readDocument,
  writeDocument,
  deleteDocument,
  renameDocument,
  listDocuments,
  listTree,
} from "@/lib/fs";
import { parsePath } from "../utils";

export function registerFileTools(server: McpServer) {
  server.registerTool(
    "read_file",
    {
      description:
        "读取文件内容（Markdown 文档）。路径格式如：personal/default/projects/{projectId}/docs/doc-name",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "文件路径，如 personal/default/projects/{projectId}/docs/doc-name"
          ),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
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
        "创建或写入文件（Markdown 文档）。如果文件已存在则覆盖，父目录不存在则自动创建。",
      inputSchema: z.object({
        path: z.string().describe("文件路径"),
        content: z.string().describe("文件内容（Markdown）"),
      }),
    },
    async ({ path, content }) => {
      const segments = parsePath(path);
      writeDocument(content, ...segments);
      return {
        content: [{ type: "text", text: `File written: ${path}` }],
      };
    }
  );

  server.registerTool(
    "delete_file",
    {
      description: "删除文件",
      inputSchema: z.object({
        path: z.string().describe("文件路径"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      deleteDocument(...segments);
      return {
        content: [{ type: "text", text: `File deleted: ${path}` }],
      };
    }
  );

  server.registerTool(
    "rename_file",
    {
      description: "重命名文件（修改文件标题）",
      inputSchema: z.object({
        path: z.string().describe("文件当前路径"),
        newTitle: z.string().describe("新的文件标题（不含扩展名）"),
      }),
    },
    async ({ path, newTitle }) => {
      const segments = parsePath(path);
      renameDocument(newTitle, ...segments);
      return {
        content: [{ type: "text", text: `File renamed to: ${newTitle}` }],
      };
    }
  );

  server.registerTool(
    "list_files",
    {
      description: "列出目录下的所有 .md 文件",
      inputSchema: z.object({
        path: z.string().describe("目录路径"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
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
        "获取目录树结构，递归列出所有子目录和 .md 文件。路径格式如：personal/default/projects/{projectId}/docs",
      inputSchema: z.object({
        path: z
          .string()
          .describe("目录路径，如 personal/default/projects/{projectId}/docs"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      const tree = listTree(segments);
      return {
        content: [{ type: "text", text: JSON.stringify(tree, null, 2) }],
      };
    }
  );
}
