import { Button, Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface PaymentFailedEmailProps {
  name: string;
  planName: string;
  billingUrl: string;
  previewText?: string;
  heading?: string;
  bodyText?: string;
  buttonText?: string;
}

export function PaymentFailedEmail({
  name,
  planName,
  billingUrl,
  previewText = "Payment failed",
  heading = "Payment failed",
  bodyText,
  buttonText = "Update Payment Method",
}: PaymentFailedEmailProps) {
  return (
    <BaseLayout preview={previewText}>
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        {bodyText ??
          `We were unable to process the payment for your ${planName} plan. Please update your payment method to avoid service interruption.`}
      </Text>
      <Button style={button} href={billingUrl}>
        {buttonText}
      </Button>
    </BaseLayout>
  );
}

export default PaymentFailedEmail;

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
