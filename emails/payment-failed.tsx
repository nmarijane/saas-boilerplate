import { PaymentFailedEmail } from "@/features/email/templates/payment-failed";

export default function PaymentFailedPreview() {
  return (
    <PaymentFailedEmail
      name="John Doe"
      planName="Pro"
      billingUrl="http://localhost:3000/en/settings/billing"
    />
  );
}
