import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import ThemeRoot from "@/components/layout/ThemeRoot";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { getBrandName, getSetting } from "@/lib/auth/settings";
import { parseColorScheme } from "@/lib/color-scheme";

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
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://docs.rabbitai-lab.com"
    ),
    title: {
      default: brandName,
      template: `%s · ${brandName}`,
    },
    description:
      "AI-native document workspace. The whole project becomes Claude context, with the files you already have as the source of truth.",
    applicationName: brandName,
    keywords: [
      "AI documents",
      "Claude Agent",
      "MCP",
      "Markdown",
      "Filesystem",
      "Documentation",
    ],
    authors: [{ name: "RabbitAI Lab" }],
    openGraph: {
      type: "website",
      siteName: brandName,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const msgs = await getMessages();

  // Read color scheme for FOUC-free injection via ThemeRoot
  const colorSchemeRaw = getSetting("color_scheme");
  const colorScheme = colorSchemeRaw ? parseColorScheme(colorSchemeRaw) : null;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <NextIntlClientProvider locale={locale} messages={msgs}>
          <ThemeRoot colorScheme={colorScheme}>
            <AuthProvider>{children}</AuthProvider>
          </ThemeRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
