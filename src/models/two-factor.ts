import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./user";

// The twoFactor plugin's `twoFactor` model. `secret` and `backupCodes` hold the
// encrypted values the plugin writes; `user.two_factor_enabled` stays on the user.
// The plugin is off (src/features/auth/auth.ts) and the table stays, so that turning it
// on again needs no migration (docs/SETUP.md, "Two-factor authentication").
export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: timestamp("locked_until"),
}, (t) => [
  index("two_factor_secret_idx").on(t.secret),
  index("two_factor_user_id_idx").on(t.userId),
]);
