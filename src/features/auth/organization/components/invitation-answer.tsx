"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/shared/components/ui/button";
import { toast } from "@/shared/components/ui/sonner";
import { TextLink } from "@/shared/components/ui/text-link";
import { Link, useRouter } from "@/shared/lib/i18n-navigation";
import { reportHandledError } from "@/shared/utils/report-error";
import { acceptInvitation, declineInvitation } from "../actions";
import { answerInvitation } from "../invitation-flows";

interface InvitationAnswerProps {
  invitationId: string;
  workspaceName: string;
  inviterName: string;
  role: "admin" | "member";
}

// The card of the person the invitation was sent to: the workspace and who
// invited them, then Accept, the one main action, and Decline under it. Accept
// joins the workspace and goes to its home (`answerInvitation`); Decline turns
// the card into the one that says so, with the way to the app, and the focus
// goes to its title, which changed under the person. While an answer is on its
// way the other one waits; a refused answer leaves the card as it was, with a
// toast.
export function InvitationAnswer({
  invitationId,
  workspaceName,
  inviterName,
  role,
}: InvitationAnswerProps) {
  const t = useTranslations("invitation");
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [declined, setDeclined] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  // Read at once, not at the next render: two presses before it would both be sent
  const answering = useRef(false);

  useEffect(() => {
    if (declined) {
      heading.current?.focus();
    }
  }, [declined]);

  const answer = async (choice: "accept" | "decline") => {
    if (answering.current) {
      return;
    }

    answering.current = true;
    setPending(choice);
    const outcome = await answerInvitation(
      {
        accept: acceptInvitation,
        decline: declineInvitation,
        goHome: () => {
          router.push("/dashboard");
          router.refresh();
        },
        fail: (refused) => toast.error(t(refused === "accept" ? "acceptFailed" : "declineFailed")),
        report: reportHandledError,
      },
      invitationId,
      choice,
    );

    // The person stays on this page unless they joined: the buttons wake up again
    if (outcome !== "accepted") {
      answering.current = false;
      setPending(null);
    }
    setDeclined(outcome === "declined");
  };

  if (declined) {
    return (
      <AuthCard
        headingRef={heading}
        title={t("declinedTitle")}
        description={t("declinedDescription", { workspace: workspaceName })}
      >
        <p className="text-center">
          <TextLink asChild className="tap-target">
            <Link href="/dashboard">{t("openApp")}</Link>
          </TextLink>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      headingRef={heading}
      title={t("invitedTitle", { workspace: workspaceName })}
      description={t("invitedDescription", { inviter: inviterName, workspace: workspaceName, role })}
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          className="w-full"
          loading={pending === "accept"}
          onClick={() => void answer("accept")}
        >
          {t("accept")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          loading={pending === "decline"}
          onClick={() => void answer("decline")}
        >
          {t("decline")}
        </Button>
      </div>
    </AuthCard>
  );
}
