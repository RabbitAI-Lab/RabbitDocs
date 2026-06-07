"use client";

import { useAuth } from "@/components/auth/useAuth";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import Logo from "@/components/marketing/Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "@/components/layout/ThemeToggle";

/**
 * 营销站顶部导航:响应式(移动端汉堡菜单)
 * 注:链接目标全部走相对路径(无 URL prefix)
 */
export default function MarketingNav() {
  const t = useTranslations("marketing.nav");
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const isLoggedIn = !!user;

  const links = [
    { href: "/features", label: t("features") },
    { href: "/pricing", label: t("pricing") },
    { href: "/use-cases", label: t("useCases") },
    { href: "/about", label: t("about") },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--marketing-border)] bg-[var(--marketing-bg)]/80 backdrop-blur-md">
      <nav
        aria-label={t("ariaLabel")}
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/home"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <Logo className="h-6 w-6" />
          <span>{t("brand")}</span>
        </Link>

        <ul className="hidden md:flex items-center gap-7 text-sm text-[var(--marketing-muted)]">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="hover:text-[var(--marketing-fg)] transition-colors duration-200"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher />
          <Link
            href={isLoggedIn ? "/docs" : "/login"}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--color-primary-hover)] hover:shadow-md hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-bg)]"
          >
            {isLoggedIn ? t("openApp") : t("loginNow")}
            {isLoggedIn && <span aria-hidden="true">→</span>}
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          aria-expanded={open}
          className="md:hidden p-2 -mr-2 text-[var(--marketing-muted)]"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-[var(--marketing-border)] bg-[var(--marketing-bg)]">
          <ul className="px-4 py-3 space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-sm text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="pt-2 flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </li>
            <li>
              <Link
                href={isLoggedIn ? "/docs" : "/login"}
                onClick={() => setOpen(false)}
                className="block w-full text-center rounded-md bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-white"
              >
                {isLoggedIn ? t("openApp") : t("loginNow")}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
