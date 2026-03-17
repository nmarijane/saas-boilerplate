import type { Metadata } from "next";
import {
  CreditCardIcon,
  GlobeIcon,
  PaletteIcon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CtaSection } from "@/shared/components/marketing/cta-section";
import { Faq } from "@/shared/components/marketing/faq";
import { FeaturesGrid } from "@/shared/components/marketing/features-grid";
import { Hero } from "@/shared/components/marketing/hero";
import {
  faqPageJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/shared/lib/jsonld";
import { generatePageMetadata } from "@/shared/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });

  return generatePageMetadata(
    {
      title: t("hero.title"),
      description: t("hero.subtitle"),
    },
    locale
  );
}

const faqItems = [
  {
    question: "What is included in the boilerplate?",
    answer:
      "Authentication, billing with Stripe, multi-tenancy, email templates, file upload, admin panel, i18n, dark mode, and more. Everything you need to launch a SaaS product.",
  },
  {
    question: "Do I need any paid services to get started?",
    answer:
      "No. The boilerplate is designed with a zero recurring cost philosophy. All services are self-hosted by default. You can add paid services later when you scale.",
  },
  {
    question: "Can I use this for multiple projects?",
    answer:
      "Yes. The boilerplate is designed to be reusable. You can use it as a starting point for any new SaaS project.",
  },
  {
    question: "What authentication methods are supported?",
    answer:
      "Email/password, magic links, social login (Google, GitHub), and multi-factor authentication (TOTP). All powered by Better Auth.",
  },
  {
    question: "Is the codebase production-ready?",
    answer:
      "Yes. It includes TypeScript strict mode, comprehensive testing (unit, integration, E2E), logging, error handling, and Docker deployment configuration.",
  },
];

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });

  const features = [
    {
      icon: ShieldCheckIcon,
      title: "Authentication",
      description:
        "Self-hosted auth with Better Auth. Email/password, social login, MFA, and organization management.",
    },
    {
      icon: CreditCardIcon,
      title: "Stripe Billing",
      description:
        "Subscription management with Stripe. Plans, checkout, customer portal, and webhooks.",
    },
    {
      icon: UsersIcon,
      title: "Multi-tenancy",
      description:
        "Organizations with role-based access control. Owner, admin, and member roles.",
    },
    {
      icon: GlobeIcon,
      title: "Internationalization",
      description:
        "Built-in i18n with next-intl. Support for multiple languages with SEO-friendly URLs.",
    },
    {
      icon: ZapIcon,
      title: "Developer Experience",
      description:
        "TypeScript strict mode, ESLint, Prettier, Vitest, Playwright, and Storybook.",
    },
    {
      icon: PaletteIcon,
      title: "Dark Mode",
      description:
        "Fully themed with shadcn/ui and CSS variables. Light, dark, and system themes.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            organizationJsonLd("SaaS Boilerplate"),
            webSiteJsonLd("SaaS Boilerplate"),
            faqPageJsonLd(faqItems),
          ]),
        }}
      />

      <Hero
        title={t("hero.title")}
        subtitle={t("hero.subtitle")}
        ctaLabel={t("hero.cta")}
        ctaHref="/sign-up"
      />

      <FeaturesGrid
        title={t("features.title")}
        subtitle={t("features.subtitle")}
        features={features}
      />

      <section className="py-20 sm:py-28">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Trusted by developers worldwide
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-50">
            <span className="text-2xl font-bold">Company A</span>
            <span className="text-2xl font-bold">Company B</span>
            <span className="text-2xl font-bold">Company C</span>
            <span className="text-2xl font-bold">Company D</span>
          </div>
        </div>
      </section>

      <Faq title={t("faq.title")} items={faqItems} />

      <CtaSection
        title="Ready to build your SaaS?"
        description="Get started with the boilerplate and launch your product faster."
        ctaLabel={t("hero.cta")}
        ctaHref="/sign-up"
      />
    </>
  );
}
