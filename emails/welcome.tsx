import { WelcomeEmail } from "@/features/email/templates/welcome";

export default function WelcomePreview() {
  return (
    <WelcomeEmail
      name="John Doe"
      dashboardUrl="http://localhost:3088/en/dashboard"
    />
  );
}
