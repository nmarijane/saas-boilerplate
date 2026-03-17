import { Button, Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface SubscriptionCancelledEmailProps {
  name: string;
  planName: string;
  endDate: string;
  resubscribeUrl: string;
  previewText?: string;
  heading?: string;
  bodyText?: string;
  accessText?: string;
  buttonText?: string;
}

export function SubscriptionCancelledEmail({
  name,
  planName,
  endDate,
  resubscribeUrl,
  previewText = "Subscription cancelled",
  heading = "Subscription cancelled",
  bodyText,
  accessText,
  buttonText = "Resubscribe",
}: SubscriptionCancelledEmailProps) {
  return (
    <BaseLayout preview={previewText}>
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        {bodyText ??
          `Your ${planName} subscription has been cancelled.`}
      </Text>
      <Text style={text}>
        {accessText ??
          `You will continue to have access until ${endDate}.`}
      </Text>
      <Button style={button} href={resubscribeUrl}>
        {buttonText}
      </Button>
    </BaseLayout>
  );
}

export default SubscriptionCancelledEmail;

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
