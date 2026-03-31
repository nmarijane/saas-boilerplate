import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { emitEvent } from "@/features/events/emitter";
import { upsertPresence } from "@/features/presence/actions";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const page = typeof body.page === "string" ? body.page : "/dashboard";
    const orgId = await getActiveOrgId();

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization", code: "NO_ORG", status: 400 },
        { status: 400 },
      );
    }

    const { previousStatus, currentStatus } = await upsertPresence(
      auth.session.user.id,
      orgId,
      page,
    );

    if (previousStatus !== null && previousStatus !== currentStatus) {
      await emitEvent("presence.changed", {
        orgId,
        actorId: auth.session.user.id,
        resourceType: "presence",
        resourceId: auth.session.user.id,
        metadata: { status: currentStatus, previousStatus },
      });
    }

    return NextResponse.json({ status: currentStatus });
  } catch {
    return NextResponse.json(
      { error: "Failed to update presence", code: "PRESENCE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
