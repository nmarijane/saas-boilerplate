import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/models";

const migrationsFolder = "./migrations";

async function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const db = drizzle(databaseUrl, { schema });
    await migratePg(db, { migrationsFolder });
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite("./local.db");
  const db = drizzlePglite(client, { schema });
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
    limits: { members: 1, projects: 3, storage: 100, aiCredits: 100 },
    price: 0,
  },
  {
    id: "pro",
    name: "Pro",
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    features: { dashboard: true, feedback: true, notifications: true },
    limits: { members: 10, projects: 50, storage: 10_000, aiCredits: 5000 },
    price: 2900,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ?? null,
    features: {
      dashboard: true,
      feedback: true,
      notifications: true,
      priority_support: true,
    },
    limits: { members: -1, projects: -1, storage: -1, aiCredits: -1 },
    price: 9900,
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
      .onConflictDoUpdate({
        target: schema.plan.id,
        set: {
          name: p.name,
          stripePriceId: p.stripePriceId,
          features: p.features,
          limits: p.limits,
          price: p.price,
        },
      });
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
        isPlatformAdmin: true,
        onboardingCompleted: true,
      })
      .onConflictDoUpdate({
        target: schema.user.id,
        set: {
          isAdmin: true,
          isPlatformAdmin: true,
          onboardingCompleted: true,
          emailVerified: true,
        },
      });

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

    // Seed a default organization for the admin/dev users to use locally.
    const devOrgId = "dev-org-001";
    await db
      .insert(schema.organization)
      .values({
        id: devOrgId,
        name: "AI Chambers Dev Workspace",
        slug: "ai-chambers-dev",
      })
      .onConflictDoNothing({ target: schema.organization.id });

    await db
      .insert(schema.organizationMember)
      .values({
        id: "dev-org-member-admin",
        userId: adminId,
        organizationId: devOrgId,
        role: "owner",
      })
      .onConflictDoNothing({ target: schema.organizationMember.id });

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

    await db
      .insert(schema.organizationMember)
      .values({
        id: "dev-org-member-dev",
        userId: devId,
        organizationId: devOrgId,
        role: "member",
      })
      .onConflictDoNothing({ target: schema.organizationMember.id });

    console.log("Dev user seeded: dev@example.com / admin123");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
