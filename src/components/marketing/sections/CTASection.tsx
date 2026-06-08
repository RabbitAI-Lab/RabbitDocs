import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Button } from "@/components/marketing/primitives/Button";

interface CTASectionProps {
  title: string;
  subtitle?: string;
  ctaPrimary: string;
  ctaSecondary?: string;
  primaryHref?: string;
  secondaryHref?: string;
}

/**
 * 行动召唤:深色卡片 + 主次按钮
 */
export default function CTASection({
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
  primaryHref = "/register",
  secondaryHref = "/docs",
}: CTASectionProps) {
  return (
    <Section>
      <Container>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--marketing-border)] bg-zinc-950 p-10 sm:p-16 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-0"
          >
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          </div>
          <div className="relative z-10">
            <Heading as="h2" className="text-white">
              {title}
            </Heading>
            {subtitle && (
              <Text variant="lead" className="mt-4 max-w-2xl mx-auto text-zinc-400">
                {subtitle}
              </Text>
            )}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                href={primaryHref}
                size="lg"
                className="btn-cta-light"
              >
                {ctaPrimary}
                <span aria-hidden="true">→</span>
              </Button>
              {ctaSecondary && (
                <Button
                  href={secondaryHref}
                  variant="secondary"
                  size="lg"
                  className="border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                >
                  {ctaSecondary}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
