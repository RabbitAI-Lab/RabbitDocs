import clsx from "clsx";
import { Check } from "lucide-react";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Button } from "@/components/marketing/primitives/Button";
import { Badge } from "@/components/marketing/primitives/Badge";

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  badge?: string;
}

interface PricingTableProps {
  title: string;
  subtitle?: string;
  plans: PricingPlan[];
}

/**
 * 三栏套餐表(中间标 "Most popular" 蓝徽)
 */
export default function PricingTable({
  title,
  subtitle,
  plans,
}: PricingTableProps) {
  return (
    <Section>
      <Container>
        <div className="text-center max-w-2xl mx-auto">
          <Heading as="h2">{title}</Heading>
          {subtitle && (
            <Text variant="muted" className="mt-3">
              {subtitle}
            </Text>
          )}
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={clsx(
                "relative flex flex-col rounded-2xl border p-6 transition-all duration-300",
                plan.highlight
                  ? "border-zinc-300 dark:border-zinc-600 bg-[var(--marketing-card)] shadow-[0_8px_30px_rgba(0,0,0,0.08)] -translate-y-2"
                  : "border-[var(--marketing-border)] bg-[var(--marketing-card)]"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="accent">{plan.badge}</Badge>
                </div>
              )}
              <div>
                <h3 className="text-base font-semibold text-[var(--marketing-fg)]">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--marketing-muted)]">
                  {plan.description}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-mono font-semibold text-[var(--marketing-fg)]">
                    {plan.price}
                  </span>
                  <span className="text-sm text-[var(--marketing-muted)]">
                    {plan.period}
                  </span>
                </div>
              </div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-[var(--marketing-fg)]"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button
                  href={plan.ctaHref}
                  variant={plan.highlight ? "primary" : "secondary"}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
