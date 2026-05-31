import { db } from "@/db";
import { mcpConfig } from "@/db/schema";
import McpPageClient from "@/components/admin/McpPageClient";

export default function McpPage() {
  const config = db.select().from(mcpConfig).get();

  return (
    <McpPageClient
      initialConfig={
        config
          ? {
              configJson: config.configJson,
              updatedAt: config.updatedAt,
            }
          : undefined
      }
    />
  );
}
