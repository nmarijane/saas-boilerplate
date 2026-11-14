import { describe, expect, it, vi } from "vitest";
import { formatMinorAmount, mailWorkspaceOwner } from "@/features/billing/mail";

// The mails of the shop, in the language of the page the subscription was opened in. The owner and the
// transport are replaced: what is checked is what is written, and to whom it goes.

const { send, owner } = vi.hoisted(() => ({
  send: vi.fn(),
  owner: { current: { id: "u1", name: "Camille", email: "camille@example.test" } as { id: string; name: string; email: string } | null },
}));
vi.mock("@/features/email/send", () => ({ sendEmail: send }));
vi.mock("@/features/billing/subscription", () => ({ getWorkspaceOwner: async () => owner.current }));

async function sent(mail: Parameters<typeof mailWorkspaceOwner>[1], locale: string | null) {
  send.mockClear();
  await mailWorkspaceOwner("org_1", mail, locale);
  const [call] = send.mock.calls;
  const { renderToStaticMarkup } = await import("react-dom/server");

  return { to: call?.[0].to as string, subject: call?.[0].subject as string, html: call ? renderToStaticMarkup(call[0].template) : "" };
}

describe("amounts in a mail", () => {
  it("are written in the language of the reader, from minor units", () => {
    expect(formatMinorAmount(2900, "usd", "en")).toBe("$29.00");
    expect(formatMinorAmount(2900, "usd", "fr").replaceAll(/\s/g, " ")).toBe("29,00 $US");
    // A currency with no minor unit is not divided
    expect(formatMinorAmount(2900, "jpy", "en")).toBe("¥2,900");
  });
});

describe("the mails of the shop", () => {
  it("tells the owner the payment is in, with the plan and the amount, in French when the subscription was opened in French", async () => {
    const mail = await sent({ kind: "paymentSuccess", planName: "Pro", amount: { minor: 2900, currency: "usd" } }, "fr");

    expect(mail.to).toBe("camille@example.test");
    expect(mail.subject).toBe("Paiement reçu");
    expect(mail.html).toContain("Bonjour Camille,");
    expect(mail.html).toContain("Offre");
    expect(mail.html).toContain("Pro");
    expect(mail.html).toContain("29,00");
  });

  it("falls back to the default language for a language the app does not serve, or none", async () => {
    expect((await sent({ kind: "paymentFailed", planName: "Pro" }, "de")).subject).toBe("Your payment failed");
    expect((await sent({ kind: "paymentFailed", planName: "Pro" }, null)).html).toContain("Hi Camille,");
  });

  it("leads the failed payment to the billing page, in the language of the mail", async () => {
    const mail = await sent({ kind: "paymentFailed", planName: "Pro" }, "fr");

    expect(mail.html).toMatch(/href="[^"]*\/fr\/settings\/billing"/);
    expect(mail.html).toContain("Mettre à jour le moyen de paiement");
  });

  it("says until when the plan is kept after a cancellation, and how to come back", async () => {
    const mail = await sent({ kind: "subscriptionCancelled", planName: "Pro", endsAt: new Date("2026-12-14T00:00:00Z") }, "en");

    expect(mail.subject).toBe("Your subscription is cancelled");
    expect(mail.html).toContain("until December 14, 2026");
    expect(mail.html).toMatch(/href="[^"]*\/en\/choose-plan"/);
  });

  it("warns of the end of a trial with its date", async () => {
    const mail = await sent({ kind: "trialEnding", planName: "Pro", endsAt: new Date("2026-12-02T00:00:00Z") }, "fr");

    expect(mail.subject).toBe("Votre essai gratuit se termine dans 3 jours");
    expect(mail.html).toContain("2 décembre 2026");
  });

  it("sends nothing, and fails nothing, for a workspace with no owner or when the transport is down", async () => {
    owner.current = null;
    expect((await sent({ kind: "paymentFailed", planName: "Pro" }, "en")).to).toBeUndefined();

    owner.current = { id: "u1", name: "Camille", email: "camille@example.test" };
    send.mockRejectedValueOnce(new Error("SMTP down"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(mailWorkspaceOwner("org_1", { kind: "paymentFailed", planName: "Pro" }, "en")).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
