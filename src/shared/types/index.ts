export type Locale = "en" | "fr";

export type OrgRole = "owner" | "admin" | "member";
export const ORG_ROLES = ["owner", "admin", "member"] as const;
export const ROLE_HIERARCHY: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

export type FeedbackType = "bug" | "feature" | "other";
export type FeedbackStatus = "new" | "reviewed" | "done";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export type NotificationType = "info" | "warning" | "error" | "success";

export interface ApiErrorResponse {
  error: string;
  code: string;
  status: number;
}
