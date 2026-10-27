"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { createCheckoutSession } from "../helpers";

interface UpgradeButtonProps {
  orgId: string;
  planId: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function UpgradeButton({
  orgId,
  planId,
  label = "Upgrade",
  variant = "default",
  size = "default",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!planId) return;
    setLoading(true);
    try {
      const session = await createCheckoutSession(orgId, planId, "monthly");
      if (session.url) {
        window.location.href = session.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading || !planId}
    >
      {loading ? "Redirecting..." : label}
    </Button>
  );
}
