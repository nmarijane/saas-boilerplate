import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const achievementCategoryEnum = pgEnum("achievement_category", [
  "onboarding",
  "social",
  "usage",
  "streak",
]);

export const achievement = pgTable("achievement", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  category: achievementCategoryEnum("category").notNull(),
  threshold: integer("threshold").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userAchievement = pgTable("user_achievement", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  achievementId: text("achievement_id")
    .notNull()
    .references(() => achievement.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  unlockedAt: timestamp("unlocked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_achievement_user_ach_idx").on(t.userId, t.achievementId),
  index("user_achievement_user_id_idx").on(t.userId),
]);

export const userStreak = pgTable("user_streak", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  lastLoginDate: date("last_login_date").notNull(),
  currentStreak: integer("current_streak").notNull().default(1),
}, (t) => [
  uniqueIndex("user_streak_user_id_idx").on(t.userId),
]);
