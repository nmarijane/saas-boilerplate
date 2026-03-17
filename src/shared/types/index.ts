export type Locale = "en" | "fr";

export type OrgRole = "owner" | "admin" | "member";

export type FeedbackType = "bug" | "feature" | "other";
export type FeedbackStatus = "new" | "reviewed" | "done";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export type NotificationType = "info" | "warning" | "error" | "success";

export interface ApiErrorResponse {
  error: string;
  code: string;
  status: number;
}
