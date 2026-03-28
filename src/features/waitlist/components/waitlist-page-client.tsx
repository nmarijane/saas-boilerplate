"use client";

import { useState } from "react";
import { WaitlistForm } from "./waitlist-form";
import { WaitlistStatus } from "./waitlist-status";

interface WaitlistPageClientProps {
  initialPosition?: number;
  initialReferralCode?: string;
  initialReferralCount?: number;
  totalEntries: number;
}

export function WaitlistPageClient({
  initialPosition,
  initialReferralCode,
  initialReferralCount = 0,
  totalEntries,
}: WaitlistPageClientProps) {
  const [joined, setJoined] = useState(
    initialPosition !== undefined && initialReferralCode !== undefined,
  );
  const [position, setPosition] = useState(initialPosition ?? 0);
  const [referralCode, setReferralCode] = useState(initialReferralCode ?? "");
  const [referralCount] = useState(initialReferralCount);

  function handleSuccess(_email: string, code: string) {
    // Position will be re-calculated by server; use a best-effort estimate
    setPosition(totalEntries + 1);
    setReferralCode(code);
    setJoined(true);
  }

  if (joined && referralCode) {
    return (
      <WaitlistStatus
        position={position}
        referralCode={referralCode}
        referralCount={referralCount}
        totalEntries={totalEntries}
      />
    );
  }

  return <WaitlistForm onSuccess={handleSuccess} />;
}
