import { getBrandName, getSetting } from "@/lib/auth/settings";
import GeneralSettingsPageClient from "@/components/admin/GeneralSettingsPageClient";

export default function GeneralSettingsPage() {
  const brandName = getBrandName();
  const siteUrl = getSetting("site_url") ?? "";
  return <GeneralSettingsPageClient initialBrandName={brandName} initialSiteUrl={siteUrl} />;
}
