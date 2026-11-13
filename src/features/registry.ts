import type { FeatureShell } from "@/shared/shell/contract";
import { adminShell } from "@/features/admin/shell";
import { aiShell } from "@/features/ai/shell";
import { apiKeysShell } from "@/features/api-keys/shell";
import { auditShell } from "@/features/audit/shell";
import { organizationShell } from "@/features/auth/organization/shell";
import { billingShell } from "@/features/billing/shell";
import { changelogShell } from "@/features/changelog/shell";
import { dashboardShell } from "@/features/dashboard/shell";
import { featureFlagsShell } from "@/features/feature-flags/shell";
import { feedbackShell } from "@/features/feedback/shell";
import { notificationsShell } from "@/features/notifications/shell";
import { projectsShell } from "@/features/projects/shell";
import { settingsShell } from "@/features/settings/shell";
import { uploadShell } from "@/features/upload/shell";
import { waitlistShell } from "@/features/waitlist/shell";
import { webhooksShell } from "@/features/webhooks/shell";
import "server-only";

/**
 * The features installed, in the order the shell reads them: where two entries
 * share an id the first wins, and the first plan provider is the one asked.
 * Each feature gives one line; removing a feature is deleting its folder and
 * its line here (the boundaries test checks that every shell.ts is listed).
 */
export const FEATURES: readonly FeatureShell[] = [
  dashboardShell,
  projectsShell,
  aiShell,
  uploadShell,
  settingsShell,
  organizationShell,
  billingShell,
  apiKeysShell,
  webhooksShell,
  notificationsShell,
  feedbackShell,
  adminShell,
  auditShell,
  featureFlagsShell,
  changelogShell,
  waitlistShell,
];
