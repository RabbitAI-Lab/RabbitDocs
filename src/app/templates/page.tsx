import { db } from "@/db";
import { templates } from "@/db/schema";
import TemplatesPageClient from "@/components/templates/TemplatesPageClient";

export default function TemplatesPage() {
  const templatesList = db.select().from(templates).all();

  return <TemplatesPageClient initialTemplates={templatesList} />;
}
