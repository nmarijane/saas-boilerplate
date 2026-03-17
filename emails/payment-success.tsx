import { PaymentSuccessEmail } from "@/features/email/templates/payment-success";

export default function PaymentSuccessPreview() {
  return (
    <PaymentSuccessEmail
      name="John Doe"
      planName="Pro"
      amount="$29/month"
    />
  );
}
