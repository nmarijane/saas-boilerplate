import { VerifyEmail } from "@/features/email/templates/verify-email";

export default function VerifyEmailPreview() {
  return (
    <VerifyEmail
      name="John Doe"
      verificationUrl="http://localhost:3088/en/verify-email?token=abc123"
    />
  );
}
