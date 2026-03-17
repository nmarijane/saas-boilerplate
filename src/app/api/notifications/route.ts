import { NextResponse } from "next/server";
import { markAllRead, markAsRead } from "@/features/notifications/actions";
import { getNotifications, getUnreadCount } from "@/features/notifications/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required", code: "MISSING_USER_ID", status: 400 },
        { status: 400 },
      );
    }

    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await getUnreadCount(userId);
      return NextResponse.json({ count });
    }

    const limit = Number(searchParams.get("limit")) || 20;
    const offset = Number(searchParams.get("offset")) || 0;

    const notifications = await getNotifications(userId, { limit, offset });
    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch notifications", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { action, notifId, userId } = body;

    if (action === "markRead" && notifId) {
      await markAsRead(notifId);
      return NextResponse.json({ success: true });
    }

    if (action === "markAllRead" && userId) {
      await markAllRead(userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action", code: "INVALID_ACTION", status: 400 },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to update notification", code: "UPDATE_ERROR", status: 500 },
      { status: 500 },
    );
  }
}
