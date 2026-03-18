import { Button, Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface WelcomeEmailProps {
  name: string;
  dashboardUrl: string;
  previewText?: string;
  heading?: string;
  bodyText?: string;
  buttonText?: string;
}

const h1 = {
  color: "#1d1c1d",
  fontSize: "24px",
  fontWeight: "700" as const,
  margin: "30px 0",
  padding: "0",
};

const text = {
  color: "#484848",
  fontSize: "16px",
  lineHeight: "24px",
};

const button = {
  backgroundColor: "#000000",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
  margin: "24px 0",
};

export function WelcomeEmail({
  name,
  dashboardUrl,
  previewText = "Welcome to our platform!",
  heading = "Welcome aboard!",
  bodyText = "We're excited to have you. Your account has been created and you're ready to get started.",
  buttonText = "Go to Dashboard",
}: WelcomeEmailProps) {
  return (
    <BaseLayout preview={previewText}>
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>{bodyText}</Text>
      <Button style={button} href={dashboardUrl}>
        {buttonText}
      </Button>
    </BaseLayout>
  );
}

export default WelcomeEmail;
