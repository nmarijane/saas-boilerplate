import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/features/feature-flags/helpers";

/**
 * This route is intentionally public (no authentication required).
 * Feature flags are non-sensitive configuration that clients need to check
 * before rendering UI, including for unauthenticated visitors.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const enabled = await isFeatureEnabled(key);
  return NextResponse.json({ key, enabled });
}
