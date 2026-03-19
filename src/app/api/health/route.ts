import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/shared/lib/DB";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  let healthy = true;

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
    healthy = false;
  }

  // Check Inngest configuration
  checks.inngest =
    process.env.INNGEST_EVENT_KEY || process.env.NODE_ENV === "development"
      ? "ok"
      : "error";
  if (checks.inngest === "error") healthy = false;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
