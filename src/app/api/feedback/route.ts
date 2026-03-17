import { NextResponse } from "next/server";
import { submitFeedback, updateFeedbackStatus } from "@/features/feedback/actions";
import { getFeedbacks } from "@/features/feedback/queries";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, orgId, type, message, screenshotId } = body;

    if (!userId || !type || !message) {
      return NextResponse.json(
        { error: "userId, type, and message are required", code: "MISSING_FIELDS", status: 400 },
        { status: 400 },
      );
    }

    const result = await submitFeedback({
      userId,
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
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const orgId = searchParams.get("orgId") ?? undefined;

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
