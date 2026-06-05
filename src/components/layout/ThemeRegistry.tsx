"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ConfigProvider, App as AntApp, theme as antdTheme } from "antd";
import { useTheme } from "next-themes";
import { ReactNode, useEffect, useMemo, useState } from "react";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const antLocales: Record<string, any> = { zh: zhCN, en: enUS };

function AntdThemeSync({ children, locale }: { children: ReactNode; locale: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const antdLocale = useMemo(() => antLocales[locale] || zhCN, [locale]);

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm:
          mounted && resolvedTheme === "dark"
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
      }}
    >
      <AntApp className="flex h-full w-full">{children}</AntApp>
    </ConfigProvider>
  );
}

export default function ThemeRegistry({ children, locale }: { children: ReactNode; locale: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AntdThemeSync locale={locale}>{children}</AntdThemeSync>
    </NextThemesProvider>
  );
}
