import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import "server-only";

// Internal operations, called by the event bus, webhooks and jobs.
// Never a server action: the caller is trusted to pass the right userId.

interface CreateNotificationInput {
  title: string;
  body: string;
  type?: string;
  link?: string;
}

export async function createNotification(
  userId: string,
  input: CreateNotificationInput,
) {
  const id = generateId();

  await db.insert(notification).values({
    id,
    userId,
    title: input.title,
    body: input.body,
    type: input.type ?? "info",
    link: input.link ?? null,
  });

  return { id };
}
