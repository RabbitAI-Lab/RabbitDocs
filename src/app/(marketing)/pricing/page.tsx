import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import PricingTable, { type PricingPlan } from "@/components/marketing/sections/PricingTable";
import FAQ from "@/components/marketing/sections/FAQ";
import CTASection from "@/components/marketing/sections/CTASection";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

interface PlanPrice {
  currency: string;
  monthlyPrice: string;
  yearlyPrice: string;
}

interface PlanFeature {
  name: string;
  included: boolean;
}

function formatPrice(currency: string, amount: string | number): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol}${amount}`;
}

function getMonthlyPriceForLocale(
  pricesJson: string,
  defaultCurrency: string,
  preferredCurrency: string,
): string {
  let priceList: PlanPrice[] = [];
  try {
    priceList = JSON.parse(pricesJson || "[]");
  } catch {
    /* empty */
  }
  if (priceList.length === 0) return formatPrice(defaultCurrency, "0");

  // 1. preferred currency
  const preferred = priceList.find((p) => p.currency === preferredCurrency);
  if (preferred) return formatPrice(preferredCurrency, preferred.monthlyPrice);

  // 2. plan default currency
  const fallback = priceList.find((p) => p.currency === defaultCurrency);
  if (fallback) return formatPrice(defaultCurrency, fallback.monthlyPrice);

  // 3. first entry
  return formatPrice(priceList[0].currency, priceList[0].monthlyPrice);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.pricing.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function PricingPage() {
  const t = await getTranslations("marketing.pricing");
  const locale = await getLocale();
  const preferredCurrency = locale === "zh" ? "CNY" : "USD";

  // Query enabled plans from DB
  const dbPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.enabled, true))
    .orderBy(plans.sortOrder);

  const highlightIndex = Math.floor(dbPlans.length / 2);

  const pricingPlans: PricingPlan[] = dbPlans.map((plan, index) => {
    let features: string[] = [];
    try {
      features = (JSON.parse(plan.features || "[]") as PlanFeature[])
        .filter((f) => f.included)
        .map((f) => f.name);
    } catch {
      /* empty */
    }
    return {
      name: plan.title,
      price: getMonthlyPriceForLocale(plan.prices, plan.defaultCurrency, preferredCurrency),
      period: t("plans.period"),
      description: plan.description ?? "",
      features,
      cta: t("plans.ctaStart"),
      ctaHref: "/register",
      ...(index === highlightIndex
        ? { highlight: true as const, badge: t("plans.popular") }
        : {}),
    };
  });

  const faqItems = (
    t.raw("faq.items") as Array<{ question: string; answer: string }>
  );

  return (
    <main id="main">
      <Section className="pt-20 sm:pt-28 pb-12">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 py-1 text-xs font-mono text-[var(--marketing-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {t("eyebrow")}
            </span>
            <Heading as="h1" className="mt-6">
              {t("title")}
            </Heading>
            <Text variant="lead" className="mt-5">
              {t("subtitle")}
            </Text>
          </div>
        </Container>
      </Section>

      {pricingPlans.length > 0 && <PricingTable title="" plans={pricingPlans} />}

      {/* 自定义联系 */}
      <Section className="border-t border-[var(--marketing-border)] py-12">
        <Container>
          <div className="rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--marketing-fg)]">
                {t("custom.title")}
              </h3>
              <Text variant="muted" className="mt-1">
                {t("custom.description")}
              </Text>
            </div>
            <a
              href="mailto:mail@xujialiang.net"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-4 py-2 text-sm font-medium text-[var(--marketing-fg)] transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-500 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]"
            >
              {t("custom.cta")} <span aria-hidden="true">→</span>
            </a>
          </div>
        </Container>
      </Section>

      <FAQ title={t("faq.title")} items={faqItems} />

      <CTASection
        title={t("cta.title")}
        subtitle={t("cta.subtitle")}
        ctaPrimary={t("cta.primary")}
        ctaSecondary={t("cta.secondary")}
      />
    </main>
  );
}
