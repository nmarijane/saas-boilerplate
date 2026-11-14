import type { ReactElement } from "react";
import { createTranslator, hasLocale } from "next-intl";
import { unstable_rethrow } from "next/navigation";
import { sendEmail } from "@/features/email/send";
import {
  PaymentFailedEmail,
  PaymentSuccessEmail,
  SubscriptionCancelledEmail,
  TrialEndingEmail,
} from "@/features/email/templates";
import enMessages from "@/locales/en.json";
import frMessages from "@/locales/fr.json";
import { DEV_APP_URL } from "@/shared/config/app";
import { env } from "@/shared/lib/env";
import { routing } from "@/shared/lib/i18n-routing";
import { getWorkspaceOwner } from "./subscription";
import "server-only";

// The mails of the shop: payment confirmed, payment failed, subscription
// cancelled and trial ending. They are written
// in the language of the page the buyer subscribed from (kept on the
// subscription), from the same message files as the pages.

const MESSAGES = { en: enMessages, fr: frMessages } as const;

function translatorFor(locale: string | null | undefined) {
  const language = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;

  return { language, t: createTranslator({ locale: language, messages: MESSAGES[language], namespace: "billing.emails" }) };
}

function pageUrl(language: string, path: string): string {
  return `${(env.NEXT_PUBLIC_APP_URL || DEV_APP_URL).replace(/\/$/, "")}/${language}${path}`;
}

/** An amount in minor units (cents) as the language of the reader writes it: "$29.00", "29,00 $US". */
export function formatMinorAmount(minor: number, currency: string, language: string): string {
  const format = new Intl.NumberFormat(language, { style: "currency", currency: currency.toUpperCase() });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;

  return format.format(minor / 10 ** digits);
}

function formatDate(date: Date, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(date);
}

type Mail =
  | { kind: "paymentSuccess"; planName: string; amount: { minor: number; currency: string } }
  | { kind: "paymentFailed"; planName: string }
  | { kind: "subscriptionCancelled"; planName: string; endsAt: Date | null }
  | { kind: "trialEnding"; planName: string; endsAt: Date };

function build(mail: Mail, name: string, locale: string | null | undefined): { subject: string; template: ReactElement } {
  const { t, language } = translatorFor(locale);
  const greeting = t("greeting", { name });
  const billingUrl = pageUrl(language, "/settings/billing");

  switch (mail.kind) {
    case "paymentSuccess":
      return {
        subject: t("paymentSuccess.subject"),
        template: PaymentSuccessEmail({
          name,
          greeting,
          planName: mail.planName,
          amount: formatMinorAmount(mail.amount.minor, mail.amount.currency, language),
          previewText: t("paymentSuccess.subject"),
          heading: t("paymentSuccess.heading"),
          bodyText: t("paymentSuccess.body"),
          detailsLabel: t("paymentSuccess.details"),
          planLabel: t("paymentSuccess.plan"),
          amountLabel: t("paymentSuccess.amount"),
        }),
      };
    case "paymentFailed":
      return {
        subject: t("paymentFailed.subject"),
        template: PaymentFailedEmail({
          name,
          greeting,
          planName: mail.planName,
          billingUrl,
          previewText: t("paymentFailed.subject"),
          heading: t("paymentFailed.heading"),
          bodyText: t("paymentFailed.body", { plan: mail.planName }),
          buttonText: t("paymentFailed.button"),
        }),
      };
    case "subscriptionCancelled":
      return {
        subject: t("subscriptionCancelled.subject"),
        template: SubscriptionCancelledEmail({
          name,
          greeting,
          planName: mail.planName,
          endDate: mail.endsAt ? formatDate(mail.endsAt, language) : "",
          resubscribeUrl: pageUrl(language, "/choose-plan"),
          previewText: t("subscriptionCancelled.subject"),
          heading: t("subscriptionCancelled.heading"),
          bodyText: t("subscriptionCancelled.body", { plan: mail.planName }),
          accessText: mail.endsAt ? t("subscriptionCancelled.access", { date: formatDate(mail.endsAt, language) }) : t("subscriptionCancelled.noAccess"),
          buttonText: t("subscriptionCancelled.button"),
        }),
      };
    case "trialEnding":
      return {
        subject: t("trialEnding.subject"),
        template: TrialEndingEmail({
          name,
          greeting,
          planName: mail.planName,
          endDate: formatDate(mail.endsAt, language),
          billingUrl,
          previewText: t("trialEnding.subject"),
          heading: t("trialEnding.heading"),
          bodyText: t("trialEnding.body", { plan: mail.planName, date: formatDate(mail.endsAt, language) }),
          buttonText: t("trialEnding.button"),
        }),
      };
  }
}

/**
 * Mails the owner of a workspace about its subscription. A mail that cannot be
 * sent is logged and does not fail the webhook: the subscription is already
 * written, and Stripe would only send the event again, to write it again.
 */
export async function mailWorkspaceOwner(orgId: string, mail: Mail, locale: string | null | undefined): Promise<void> {
  try {
    const owner = await getWorkspaceOwner(orgId);
    if (!owner) {
      return;
    }

    await sendEmail({ to: owner.email, ...build(mail, owner.name, locale) });
  } catch (error) {
    unstable_rethrow(error);
    console.error("A billing e-mail could not be sent", error);
  }
}
