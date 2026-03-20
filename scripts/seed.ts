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

async function hashPassword(password: string): Promise<string> {
  const { hashPassword: hash } = await import("better-auth/crypto");
  return hash(password);
}

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

  // Dev accounts — ONLY in non-production environments
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    console.log("Production detected — skipping dev accounts (security)");
  } else {
    const passwordHash = await hashPassword("admin123");

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

    await db
      .insert(schema.account)
      .values({
        id: "admin-account-001",
        accountId: adminId,
        providerId: "credential",
        userId: adminId,
        password: passwordHash,
      })
      .onConflictDoNothing({ target: schema.account.id });

    console.log("Admin seeded: admin@example.com / admin123");

    // Seed dev user (non-admin)
    const devId = "dev-seed-001";
    await db
      .insert(schema.user)
      .values({
        id: devId,
        name: "Dev User",
        email: "dev@example.com",
        emailVerified: true,
        isAdmin: false,
        onboardingCompleted: false,
      })
      .onConflictDoNothing({ target: schema.user.id });

    await db
      .insert(schema.account)
      .values({
        id: "dev-account-001",
        accountId: devId,
        providerId: "credential",
        userId: devId,
        password: passwordHash,
      })
      .onConflictDoNothing({ target: schema.account.id });

    console.log("Dev user seeded: dev@example.com / admin123");
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
