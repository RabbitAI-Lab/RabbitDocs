import { db } from "@/db";
import { modelConfigs } from "@/db/schema";
import ModelsPageClient from "@/components/admin/ModelsPageClient";

export default function ModelsPage() {
  const models = db.select().from(modelConfigs).all();

  return <ModelsPageClient initialModels={models} />;
}
