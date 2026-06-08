import Link from "next/link";
import HeroVisual from "./HeroVisual";

interface HeroProps {
  eyebrow: string;
  title: string;
  highlight: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

/**
 * 首页 Hero:左侧文案 + CTA,右侧终端视觉锚。
 * 响应式:移动端纵向堆叠,桌面端两栏。
 */
export default function Hero({
  eyebrow,
  title,
  highlight,
  subtitle,
  ctaPrimary,
  ctaSecondary,
}: HeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-[var(--marketing-border)]"
    >
      {/* 背景渐变:左侧微弱蓝光 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 py-1 text-xs font-mono text-[var(--marketing-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              {eyebrow}
            </span>
            <h1
              id="hero-title"
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance leading-[1.05]"
            >
              {title}{" "}
              <span className="bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent">
                {highlight}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--marketing-muted)] text-pretty">
              {subtitle}
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link
                href="/register"
                className="group relative inline-flex items-center justify-center gap-2 rounded-md btn-primary-gradient px-5 py-3 text-sm font-medium transition-all duration-200 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-bg)]"
              >
                {ctaPrimary}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-5 py-3 text-sm font-medium text-[var(--marketing-fg)] transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-600 hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {ctaSecondary}
              </Link>
            </div>
          </div>

          <div className="relative">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
