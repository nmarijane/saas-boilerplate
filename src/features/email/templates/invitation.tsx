import { Button, Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface InvitationEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  previewText?: string;
  heading?: string;
  bodyText?: string;
  buttonText?: string;
  expiryText?: string;
}

export function InvitationEmail({
  inviterName,
  organizationName,
  inviteUrl,
  previewText,
  heading,
  bodyText,
  buttonText = "Accept Invitation",
  expiryText = "This invitation will expire in 7 days.",
}: InvitationEmailProps) {
  return (
    <BaseLayout
      preview={
        previewText ??
        `${inviterName} invited you to join ${organizationName}`
      }
    >
      <Heading style={h1}>
        {heading ?? `Join ${organizationName}`}
      </Heading>
      <Text style={text}>
        {bodyText ??
          `${inviterName} has invited you to join ${organizationName}. Click the button below to accept the invitation.`}
      </Text>
      <Button style={button} href={inviteUrl}>
        {buttonText}
      </Button>
      <Text style={muted}>{expiryText}</Text>
    </BaseLayout>
  );
}

export default InvitationEmail;

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
