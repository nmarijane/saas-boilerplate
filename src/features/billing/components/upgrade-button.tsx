"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { createCheckoutSession } from "../helpers";

interface UpgradeButtonProps {
  orgId: string;
  priceId: string;
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}

export function UpgradeButton({
  orgId,
  priceId,
  label = "Upgrade",
  variant = "default",
  size = "default",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!priceId) return;
    setLoading(true);
    try {
      const session = await createCheckoutSession(orgId, priceId);
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
      disabled={loading || !priceId}
    >
      {loading ? "Redirecting..." : label}
    </Button>
  );
}
