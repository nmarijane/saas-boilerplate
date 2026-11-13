import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Every migration SQL file, in order, as one script: the statements are separated by Drizzle's breakpoint
const migrationsDir = resolve(import.meta.dirname, "../migrations");

export const migrationSQL = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(resolve(migrationsDir, f), "utf-8"))
  .join("\n--> statement-breakpoint\n");

export const migrationStatements = migrationSQL
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);
