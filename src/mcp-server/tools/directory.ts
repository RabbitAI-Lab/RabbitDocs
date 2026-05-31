import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createDir, deleteDir } from "@/lib/fs";
import { parsePath } from "../utils";

export function registerDirectoryTools(server: McpServer) {
  server.registerTool(
    "create_directory",
    {
      description: "创建目录（自动创建所有不存在的父目录）",
      inputSchema: z.object({
        path: z.string().describe("目录路径"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      createDir(segments);
      return {
        content: [{ type: "text", text: `Directory created: ${path}` }],
      };
    }
  );

  server.registerTool(
    "delete_directory",
    {
      description: "删除目录及其所有内容（递归删除，不可恢复）",
      inputSchema: z.object({
        path: z.string().describe("目录路径"),
      }),
    },
    async ({ path }) => {
      const segments = parsePath(path);
      deleteDir(segments);
      return {
        content: [{ type: "text", text: `Directory deleted: ${path}` }],
      };
    }
  );
}
