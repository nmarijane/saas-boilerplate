import { Button, Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface VerifyEmailProps {
  name: string;
  verificationUrl: string;
  previewText?: string;
  heading?: string;
  bodyText?: string;
  buttonText?: string;
  expiryText?: string;
}

export function VerifyEmail({
  name,
  verificationUrl,
  previewText = "Verify your email address",
  heading = "Verify your email",
  bodyText = "Please click the button below to verify your email address.",
  buttonText = "Verify Email",
  expiryText = "This link will expire in 24 hours.",
}: VerifyEmailProps) {
  return (
    <BaseLayout preview={previewText}>
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>{bodyText}</Text>
      <Button style={button} href={verificationUrl}>
        {buttonText}
      </Button>
      <Text style={muted}>{expiryText}</Text>
    </BaseLayout>
  );
}

export default VerifyEmail;

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

const muted = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "20px",
};
