import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/models";
import { resolvePgliteDataDir } from "../src/shared/lib/pglite-data-dir";
import { seedPlan, seedTarget } from "./seed-target";
// The `.env*` files are read the way Next does. None of the imports above reads the
// environment when it loads (they define, and `seed()` below reads), so this is in time
import "./load-env";

// Next to the scripts, not in the working directory: the seed runs from any folder
const migrationsFolder = resolve(import.meta.dirname, "../migrations");

async function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const db = drizzle(databaseUrl, { schema });
    await migratePg(db, { migrationsFolder });
    return db;
  }

  // As the app opens it: after the lock of the directory, so that a seed run while
  // `npm run dev` holds ./local.db is refused instead of breaking it
  const { openPglite } = await import("../src/shared/lib/pglite-open");
  const db = drizzlePglite(openPglite(resolvePgliteDataDir()), { schema });
  await migratePglite(db, { migrationsFolder });
  return db;
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
  // Said before anything is connected to: a DATABASE_URL that came from a shell or
  // from `.env.local` is where the seed is about to write, and the first thing to read
  const target = seedTarget(
    process.env.DATABASE_URL,
    process.env.DATABASE_URL ? "" : resolvePgliteDataDir(),
  );
  console.log(`Seeding database: ${target.label}`);
  const plan = seedPlan({
    nodeEnv: process.env.NODE_ENV,
    target,
    seedDemo: process.env.SEED_DEMO,
  });
  if (!plan.accounts) {
    console.log(
      plan.reason === "production"
        ? "Production detected — skipping dev accounts (security)"
        : `Skipping the dev, admin and demo accounts: ${target.label} is not a local database, and they have a known password. Set SEED_DEMO=1 to create them there anyway.`,
    );
  } else if (!target.local) {
    console.log(`SEED_DEMO=1: creating the dev, admin and demo accounts on ${target.label}.`);
  }

  const db = await createDb();

  // Seed plans
  for (const p of plans) {
    await db
      .insert(schema.plan)
      .values(p)
      .onConflictDoNothing({ target: schema.plan.id });
  }
  console.log("Plans seeded: Free, Pro, Enterprise");

  // Dev accounts: they have a known password, so only outside production and on a
  // database that is this machine's own (SEED_DEMO=1 says a shared one is meant)
  if (plan.accounts) {
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

    // The demo workspace the README's screenshots are taken from
    const { seedDemo } = await import("./demo-data");
    await seedDemo(db);
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
