import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import Sidebar from "@/components/layout/Sidebar";
import FloatingChatProvider from "@/components/chat/FloatingChatProvider";
import ThemeRegistry from "@/components/layout/ThemeRegistry";
import { getBrandName, getSetting } from "@/lib/auth/settings";
import { parseColorScheme } from "@/lib/color-scheme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const brandName = getBrandName();
  return {
    title: `${t("title")} · ${brandName}`,
    description: t("description"),
  };
}

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedWidth = cookieStore.get("sidebar-width")?.value;
  const savedCollapsed = cookieStore.get("sidebar-collapsed")?.value;
  const brandName = getBrandName();
  const locale = await getLocale();
  const msgs = await getMessages();

  // Read color scheme for antd theme sync
  const colorSchemeRaw = getSetting("color_scheme");
  const colorScheme = colorSchemeRaw ? parseColorScheme(colorSchemeRaw) : null;

  return (
    <NextIntlClientProvider locale={locale} messages={msgs}>
      <ThemeRegistry locale={locale} colorScheme={colorScheme}>
        <FloatingChatProvider>
          <div className="flex h-full">
            <div data-sidebar>
              <Sidebar
                initialWidth={savedWidth}
                initialCollapsed={savedCollapsed}
                brandName={brandName}
              />
            </div>
            <main className="flex-1 h-full overflow-y-auto bg-gray-50 dark:bg-[var(--main-bg)]">
              {children}
            </main>
          </div>
        </FloatingChatProvider>
      </ThemeRegistry>
    </NextIntlClientProvider>
  );
}
