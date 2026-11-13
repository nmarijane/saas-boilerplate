import { getRecommendedPlan } from "@/features/billing/plans";
import { Footer } from "@/shared/components/layout/footer";
import { PublicHeader } from "@/shared/components/layout/public-header";

// The public pages: the header, the page, the footer. "Free trial" in the header
// starts the trial of the recommended plan (sign-up with the plan kept); a product
// whose recommended plan has no trial says "Sign up" there.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const recommended = getRecommendedPlan();
  const trialHref = recommended?.trialDays ? `/sign-up?plan=${encodeURIComponent(recommended.id)}&interval=monthly` : null;

  // The body text of the app is 14 px (global.css). The public pages are read,
  // not operated: they read at 16 px, set once here. `font-normal` undoes the
  // semi-bold weight that `text-section` brings.
  return (
    <div className="flex min-h-screen flex-col text-section font-normal">
      <PublicHeader trialHref={trialHref} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
