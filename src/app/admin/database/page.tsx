import { getDatabaseInfo } from "@/lib/db-dump";
import DatabasePageClient from "@/components/admin/DatabasePageClient";

export default function DatabasePage() {
  const info = getDatabaseInfo();
  return <DatabasePageClient initialInfo={info} />;
}
