import { SubscriptionCancelledEmail } from "@/features/email/templates/subscription-cancelled";

export default function SubscriptionCancelledPreview() {
  return (
    <SubscriptionCancelledEmail
      name="John Doe"
      planName="Pro"
      endDate="April 17, 2026"
      resubscribeUrl="http://localhost:3000/en/pricing"
    />
  );
}
