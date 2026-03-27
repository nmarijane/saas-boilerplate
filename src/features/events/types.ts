export interface EventPayload {
  orgId: string;
  actorId?: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export type EventName =
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.cancelled"
  | "payment.succeeded"
  | "payment.failed"
  | "api_key.created"
  | "api_key.revoked"
  | "webhook.created"
  | "webhook.deleted"
  | "feature_flag.updated"
  | "feedback.created"
  | "upload.created"
  | "ai.conversation_created"
  | "ai.message_sent"
  | "ai.credits_consumed"
  | "waitlist.joined"
  | "waitlist.invited";

export interface AppEvent {
  name: EventName;
  payload: EventPayload;
  timestamp: Date;
}
