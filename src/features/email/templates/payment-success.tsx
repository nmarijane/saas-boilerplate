import { Heading, Text } from "@react-email/components";
import { BaseLayout } from "./base-layout";

interface PaymentSuccessEmailProps {
  name: string;
  planName: string;
  amount: string;
  previewText?: string;
  heading?: string;
  bodyText?: string;
  detailsLabel?: string;
  planLabel?: string;
  amountLabel?: string;
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

const detail = {
  color: "#484848",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "4px 0",
  paddingLeft: "12px",
};

export function PaymentSuccessEmail({
  name,
  planName,
  amount,
  previewText = "Payment confirmed",
  heading = "Payment successful",
  bodyText = "Your payment has been processed successfully.",
  detailsLabel = "Payment details:",
  planLabel = "Plan",
  amountLabel = "Amount",
}: PaymentSuccessEmailProps) {
  return (
    <BaseLayout preview={previewText}>
      <Heading style={h1}>{heading}</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>{bodyText}</Text>
      <Text style={text}>{detailsLabel}</Text>
      <Text style={detail}>
        {planLabel}: {planName}
      </Text>
      <Text style={detail}>
        {amountLabel}: {amount}
      </Text>
    </BaseLayout>
  );
}

export default PaymentSuccessEmail;
