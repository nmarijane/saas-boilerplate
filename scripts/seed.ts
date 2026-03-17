import { drizzle } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "../src/models";

async function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return drizzle(databaseUrl, { schema });
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite("./local.db");
  return drizzlePglite(client, { schema });
}

const plans: Array<{
  id: string;
  name: string;
  stripePriceId: string | null;
  features: Record<string, boolean>;
  limits: Record<string, number>;
  price: number;
}> = [
  {
    id: "free",
    name: "Free",
    stripePriceId: null,
    features: { dashboard: true, feedback: true },
    limits: { members: 3, uploads: 10 },
    price: 0,
  },
  {
    id: "pro",
    name: "Pro",
    stripePriceId: null,
    features: { dashboard: true, feedback: true, notifications: true },
    limits: { members: 20, uploads: 100 },
    price: 1900,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    stripePriceId: null,
    features: {
      dashboard: true,
      feedback: true,
      notifications: true,
      priority_support: true,
    },
    limits: { members: -1, uploads: -1 },
    price: 4900,
  },
];

async function seed() {
  console.log("Seeding database...");

  const db = await createDb();

  // Seed plans
  for (const p of plans) {
    await db
      .insert(schema.plan)
      .values(p)
      .onConflictDoNothing({ target: schema.plan.id });
  }
  console.log("Plans seeded: Free, Pro, Enterprise");

  // Seed admin user
  const adminId = "admin-seed-001";
  await db
    .insert(schema.user)
    .values({
      id: adminId,
      name: "Admin",
      email: "admin@example.com",
      emailVerified: true,
      isAdmin: true,
      onboardingCompleted: true,
    })
    .onConflictDoNothing({ target: schema.user.id });

  // Create admin account with password "admin123" (for dev only)
  await db
    .insert(schema.account)
    .values({
      id: "admin-account-001",
      accountId: adminId,
      providerId: "credential",
      userId: adminId,
      password: "$2a$10$placeholder_hash_replace_on_first_login",
    })
    .onConflictDoNothing({ target: schema.account.id });

  console.log("Admin user seeded: admin@example.com");
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
