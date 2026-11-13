import { defineConfig } from "drizzle-kit";
// The `.env*` files are read the way Next does, before DATABASE_URL is read below
import "./scripts/load-env";

export default defineConfig({
  schema: "./src/models/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/boilerplate",
  },
});
