import { NextResponse } from "next/server";
import { requireApiAuth } from "@/features/auth/api-auth";
import { markAllRead, markAsRead } from "@/features/notifications/actions";
import { listWindowOf } from "@/features/notifications/list-window";
import { getNotifications, getUnreadCount } from "@/features/notifications/queries";

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const userId = auth.session.user.id;
    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await getUnreadCount(userId);
      return NextResponse.json({ count });
    }

    // The window is the client's word: clamped (list-window.ts)
    const window = listWindowOf(searchParams.get("limit"), searchParams.get("offset"));

    const notifications = await getNotifications(userId, window);
    return NextResponse.json({ notifications });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch notifications", code: "FETCH_ERROR", status: 500 },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, notifId } = body;

    if (action === "markRead" && notifId) {
      await markAsRead(notifId);
      return NextResponse.json({ success: true });
    }

    if (action === "markAllRead") {
      await markAllRead();
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
