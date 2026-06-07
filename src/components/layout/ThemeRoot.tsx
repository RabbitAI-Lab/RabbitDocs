"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";
import { generateColorScript, type ColorScheme } from "@/lib/color-scheme";

/**
 * 根级主题 Provider:仅提供 next-themes 的 light/dark 切换,
 * 供营销站与产品页共用。antd 主题同步在 (app)/layout.tsx 的 ThemeRegistry 中处理。
 *
 * 接受可选的 colorScheme prop，通过内联脚本注入 CSS 变量防止 FOUC。
 */
export default function ThemeRoot({
  children,
  colorScheme,
}: {
  children: ReactNode;
  colorScheme?: ColorScheme | null;
}) {
  const script = colorScheme ? generateColorScript(colorScheme) : null;

  return (
    <>
      {script && (
        <script dangerouslySetInnerHTML={{ __html: script }} />
      )}
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </>
  );
}
