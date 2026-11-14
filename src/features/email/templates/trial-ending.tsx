import { Button, Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface TrialEndingEmailProps {
  name: string;
  /** The salutation, in the language of the mail: "Hi {name}," when left out. */
  greeting?: string;
  planName: string;
  endDate: string;
  billingUrl: string;
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

// Sent three days before a free trial ends, so that no one is charged by surprise
export function TrialEndingEmail({
  name,
  greeting,
  planName,
  endDate,
  billingUrl,
  previewText = "Your trial ends soon",
  heading = "Your trial ends soon",
  bodyText,
  buttonText = "Manage your plan",
}: TrialEndingEmailProps) {
  return (
    <BaseLayout preview={previewText}>
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>{greeting ?? `Hi ${name},`}</Text>
      <Text style={text}>
        {bodyText ?? `Your free trial of the ${planName} plan ends on ${endDate}.`}
      </Text>
      <Button style={button} href={billingUrl}>
        {buttonText}
      </Button>
    </BaseLayout>
  );
}

export default TrialEndingEmail;
