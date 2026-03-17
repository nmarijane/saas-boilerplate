import { ResetPassword } from "@/features/email/templates/reset-password";

export default function ResetPasswordPreview() {
  return (
    <ResetPassword
      name="John Doe"
      resetUrl="http://localhost:3000/en/reset-password?token=abc123"
    />
  );
}
