"use client";

import { WaitlistStatus } from "./waitlist-status";

interface WaitlistStatusWrapperProps {
  position: number;
  referralCode: string;
  referralCount: number;
  totalEntries: number;
}

export function WaitlistStatusWrapper(props: WaitlistStatusWrapperProps) {
  return <WaitlistStatus {...props} />;
}
