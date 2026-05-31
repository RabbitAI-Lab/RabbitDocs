import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";

export function registerTemplateTools(server: McpServer) {
  server.registerTool(
    "list_templates",
    {
      description: "获取所有模版列表（返回 id、name、description、icon 等基本信息）",
      inputSchema: z.object({}),
    },
    async () => {
      const all = db.select().from(templates).all();
      return {
        content: [{ type: "text", text: JSON.stringify(all, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_template",
    {
      description:
        "获取模版详情（包含完整的 Markdown 内容和 Agent Prompt）。id 为模版的数字 ID。",
      inputSchema: z.object({
        id: z.number().describe("模版 ID"),
      }),
    },
    async ({ id }) => {
      const t = db
        .select()
        .from(templates)
        .where(eq(templates.id, id))
        .get();
      if (!t) {
        return {
          content: [{ type: "text", text: "Template not found" }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(t, null, 2) }],
      };
    }
  );
}
