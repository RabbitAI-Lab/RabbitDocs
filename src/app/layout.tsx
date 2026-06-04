import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import ShareLayoutGuard from "@/components/layout/ShareLayoutGuard";
import FloatingChatProvider from "@/components/chat/FloatingChatProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { getBrandName } from "@/lib/auth/settings";
import ThemeRegistry from "@/components/layout/ThemeRegistry";

const geistSans = localFont({
  src: [
    {
      path: "../../public/fonts/Geist/Geist-Latin-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../public/fonts/Geist/Geist-Latin-Variable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    {
      path: "../../public/fonts/GeistMono/GeistMono-Latin-Variable.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../public/fonts/GeistMono/GeistMono-Latin-Variable-Italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const brandName = getBrandName();
  return {
    title: `${brandName} - 文档管理与发布`,
    description: "基于文件系统的文档管理与发布平台",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const savedWidth = cookieStore.get("sidebar-width")?.value;
  const savedCollapsed = cookieStore.get("sidebar-collapsed")?.value;
  const brandName = getBrandName();

  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex bg-white dark:bg-[var(--background)]">
        <ThemeRegistry>
          <AuthProvider>
            <FloatingChatProvider>
              <ShareLayoutGuard />
              <div data-sidebar>
                <Sidebar initialWidth={savedWidth} initialCollapsed={savedCollapsed} brandName={brandName} />
              </div>
              <main className="flex-1 h-full overflow-y-auto bg-gray-50 dark:bg-[var(--main-bg)]">
                {children}
              </main>
            </FloatingChatProvider>
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
