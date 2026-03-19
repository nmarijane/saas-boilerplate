import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/features/feature-flags/helpers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const enabled = await isFeatureEnabled(key);
  return NextResponse.json({ key, enabled });
}
