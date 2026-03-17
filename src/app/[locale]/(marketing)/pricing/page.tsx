import type { Metadata } from "next";
import { PricingTable } from "@/features/billing/components/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for every team size.",
};

export default function PricingPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Choose the plan that fits your needs. Upgrade or downgrade at any
          time.
        </p>
      </div>
      <PricingTable />
    </div>
  );
}
