import { db } from "@/db";
import { sandboxConfig } from "@/db/schema";
import SandboxPageClient from "@/components/admin/SandboxPageClient";

export default function SandboxPage() {
  const config = db.select().from(sandboxConfig).get();

  return (
    <SandboxPageClient
      initialConfig={
        config
          ? { sandboxUrl: config.sandboxUrl, updatedAt: config.updatedAt }
          : undefined
      }
    />
  );
}
