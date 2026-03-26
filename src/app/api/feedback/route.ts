import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getUserOrganizations } from "@/features/auth/organization/queries";
import { submitFeedback, updateFeedbackStatus } from "@/features/feedback/actions";
import { getFeedbacks } from "@/features/feedback/queries";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { type, message, orgId, screenshotId } = body;

    if (!type || !message) {
      return NextResponse.json(
        { error: "type and message are required", code: "MISSING_FIELDS", status: 400 },
        { status: 400 },
      );
    }

    const result = await submitFeedback({
      userId: auth.session.user.id,
      orgId,
      type,
      message,
      screenshotId,
    });

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to submit feedback", code: "SUBMIT_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const orgId = searchParams.get("orgId") ?? undefined;

    // Verify user has access to the requested org
    if (orgId) {
      const userOrgs = await getUserOrganizations(auth.session.user.id);
      if (!userOrgs.some((o) => o.id === orgId)) {
        return NextResponse.json(
          { error: "Forbidden", code: "FORBIDDEN", status: 403 },
          { status: 403 },
        );
      }
    }

    const feedbacks = await getFeedbacks({ status, orgId });
    return NextResponse.json({ feedbacks });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch feedbacks", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  if (!(auth.session.user as Record<string, unknown>).isAdmin) {
    return NextResponse.json(
      { error: "Forbidden", code: "FORBIDDEN", status: 403 },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { feedbackId, status } = body;

    if (!feedbackId || !status) {
      return NextResponse.json(
        { error: "feedbackId and status are required", code: "MISSING_FIELDS", status: 400 },
        { status: 400 },
      );
    }

    if (!["new", "reviewed", "done"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", code: "INVALID_STATUS", status: 400 },
        { status: 400 },
      );
    }

    await updateFeedbackStatus(feedbackId, status);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update feedback", code: "UPDATE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
