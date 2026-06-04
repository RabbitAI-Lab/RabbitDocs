"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ConfigProvider, App as AntApp, theme as antdTheme } from "antd";
import { useTheme } from "next-themes";
import { ReactNode, useEffect, useState } from "react";

function AntdThemeSync({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ConfigProvider
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

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AntdThemeSync>{children}</AntdThemeSync>
    </NextThemesProvider>
  );
}
