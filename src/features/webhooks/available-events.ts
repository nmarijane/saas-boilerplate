import type { EventName } from "@/features/events/types";

/**
 * The events an endpoint can ask for, in the order they are offered. Each is the
 * name the server delivers it by, and says itself in words in the message files,
 * under `webhooks.event` (`webhooks.event.member.invited`). It is a plain module
 * on purpose, not a line of the dialog's file: a list is a value, and a value that
 * a `"use client"` file exports reaches a Server Component as a reference to the
 * client, never as the list. Taking a feature out of the app (the projects, whose
 * three events end the list) is one edit here.
 */
export const AVAILABLE_EVENTS: EventName[] = [
  "member.invited",
  "member.removed",
  "member.role_changed",
  "organization.created",
  "organization.updated",
  "organization.deleted",
  "subscription.created",
  "subscription.updated",
  "subscription.cancelled",
  "payment.succeeded",
  "payment.failed",
  "api_key.created",
  "api_key.revoked",
  "webhook.created",
  "webhook.deleted",
  "feature_flag.updated",
  "feedback.created",
  "upload.created",
  "project.created",
  "project.updated",
  "project.deleted",
];
