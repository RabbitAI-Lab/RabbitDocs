import { getBrandName, getSetting } from "@/lib/auth/settings";
import GeneralSettingsPageClient from "@/components/admin/GeneralSettingsPageClient";

export default function GeneralSettingsPage() {
  const brandName = getBrandName();
  const siteUrl = getSetting("site_url") ?? "";
  const adminEmail = getSetting("admin_email") ?? "";
  return <GeneralSettingsPageClient initialBrandName={brandName} initialSiteUrl={siteUrl} initialAdminEmail={adminEmail} />;
}
