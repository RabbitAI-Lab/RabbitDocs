import { db } from "@/db";
import { storageConfig } from "@/db/schema";
import StoragePageClient from "@/components/admin/StoragePageClient";

export default function StoragePage() {
  const config = db.select().from(storageConfig).get();

  return (
    <StoragePageClient
      initialConfig={
        config
          ? { storagePath: config.storagePath, updatedAt: config.updatedAt }
          : undefined
      }
    />
  );
}
