import { notification } from "@/models/notification";
import { db } from "@/shared/lib/DB";
import { generateId } from "@/shared/utils/helpers";
import "server-only";

// Internal operations, called by the event bus, webhooks and jobs.
// Never a server action: the caller is trusted to pass the right userId.

interface CreateNotificationInput {
  /** Its words, as they are shown: for a type that has no message (`notifications.events.<type>`). */
  title: string;
  body: string;
  type?: string;
  link?: string;
  /** The workspace it is about, whose pages its link opens: following it opens that workspace first. */
  organizationId?: string;
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
    organizationId: input.organizationId ?? null,
  });

  return { id };
}
