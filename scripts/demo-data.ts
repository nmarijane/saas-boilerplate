import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { hashPassword } from "better-auth/crypto";
import { inArray } from "drizzle-orm";
import { CREDIT_PLANS } from "../src/features/ai/config/credits";
import * as schema from "../src/models";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// What the limits of the plans are written in, and what the usage cards count
// (features/upload/queries.ts): a million bytes, not 1024 * 1024.
const MEGABYTE = 1_000_000;

// The password of the dev accounts of the seed.
const PASSWORD = "admin123";

const CAMILLE = "demo-user-camille";
const LEA = "demo-user-lea";
const TOM = "demo-user-tom";
const ACME = "demo-org-acme";
const NORTHWIND = "demo-org-northwind";
const SUBSCRIPTION = "demo-subscription-acme";
const CONVERSATION = "demo-conversation-launch-email";

const projectId = (name: string) => `demo-project-${name.toLowerCase()}`;

// The projects of Acme, the latest changed first: when each changed and when it
// was made (counted back from now), and by whom, after they had joined.
const PROJECTS = [
  {
    name: "Atlas",
    status: "active",
    by: CAMILLE,
    changed: 2 * HOUR,
    made: 34 * DAY,
    about: "One dashboard for the key numbers of every team.",
  },
  {
    name: "Orbit",
    status: "draft",
    by: CAMILLE,
    changed: 6 * HOUR,
    made: 6 * HOUR,
    about:
      "The launch of the new customer portal: emails, pages and a checklist.",
  },
  {
    name: "Relay",
    status: "active",
    by: LEA,
    changed: DAY,
    made: 40 * DAY,
    about: "A shared queue for requests that pass from support to engineering.",
  },
  {
    name: "Beacon",
    status: "active",
    by: LEA,
    changed: 2 * DAY,
    made: 41 * DAY,
    about: "A status page and the notifications that go with it.",
  },
  {
    name: "Harbor",
    status: "draft",
    by: CAMILLE,
    changed: 4 * DAY,
    made: 9 * DAY,
    about: "A place for customers to find and share their documents.",
  },
  {
    name: "Summit",
    status: "active",
    by: LEA,
    changed: 5 * DAY,
    made: 48 * DAY,
    about: "Quarterly goals and how each team is doing against them.",
  },
  {
    name: "Lumen",
    status: "active",
    by: CAMILLE,
    changed: 8 * DAY,
    made: 60 * DAY,
    about: "The refresh of the brand and its design system.",
  },
  {
    name: "Vector",
    status: "draft",
    by: TOM,
    changed: 11 * DAY,
    made: 14 * DAY,
    about: "Billing exports for the finance team.",
  },
  {
    name: "Delta",
    status: "active",
    by: CAMILLE,
    changed: 14 * DAY,
    made: 75 * DAY,
    about: "A move of the old reporting scripts to the new stack.",
  },
  {
    name: "Quartz",
    status: "active",
    by: LEA,
    changed: 17 * DAY,
    made: 68 * DAY,
    about: "Welcome emails and tips that show up in the app.",
  },
  {
    name: "Nimbus",
    status: "draft",
    by: TOM,
    changed: 19 * DAY,
    made: 22 * DAY,
    about: "A review of what hosting costs, and where it can come down.",
  },
  {
    name: "Pulse",
    status: "active",
    by: CAMILLE,
    changed: 21 * DAY,
    made: 90 * DAY,
    about: "A weekly score of how each customer is doing.",
  },
] as const;

// The files of Acme, in megabytes: 3,200 of them, the figure the storage card
// of the home shows.
const UPLOADS = [
  {
    filename: "launch-video.mp4",
    mimetype: "video/mp4",
    megabytes: 1450,
    by: CAMILLE,
    age: 9 * DAY,
  },
  {
    filename: "product-demo.mov",
    mimetype: "video/quicktime",
    megabytes: 820,
    by: LEA,
    age: 16 * DAY,
  },
  {
    filename: "brand-assets.zip",
    mimetype: "application/zip",
    megabytes: 510,
    by: LEA,
    age: 33 * DAY,
  },
  {
    filename: "customer-interviews.mp3",
    mimetype: "audio/mpeg",
    megabytes: 280,
    by: TOM,
    age: 27 * DAY,
  },
  {
    filename: "press-kit.zip",
    mimetype: "application/zip",
    megabytes: 96,
    by: CAMILLE,
    age: 12 * DAY,
  },
  {
    filename: "roadmap.pdf",
    mimetype: "application/pdf",
    megabytes: 24,
    by: CAMILLE,
    age: 5 * DAY,
  },
  {
    filename: "pricing-sheet.xlsx",
    mimetype:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    megabytes: 12,
    by: TOM,
    age: 21 * DAY,
  },
  {
    filename: "team-photo.png",
    mimetype: "image/png",
    megabytes: 8,
    by: LEA,
    age: 40 * DAY,
  },
] as const;

// What Acme used of its credits this month, in lumps: 4,120 in all. `share`
// places each between the first of the month and now.
const CREDIT_USE = [
  { amount: -1640, share: 0.18 },
  { amount: -980, share: 0.42 },
  { amount: -1120, share: 0.7 },
  { amount: -380, share: 0.93 },
] as const;

// Camille's conversation with the assistant, which the AI page opens: the
// page takes the latest one of the workspace.
const MESSAGES = [
  {
    role: "user",
    ago: 52 * MINUTE,
    content:
      "Draft the launch email for Orbit. Keep it short and friendly, and say what's new.",
  },
  {
    role: "assistant",
    ago: 51 * MINUTE,
    content: [
      "Here's a first draft.",
      "**Subject:** Introducing Orbit, every project in one place",
      "Hi there,",
      "Today we're launching Orbit. It brings your plans, files and updates into a single workspace, so your team always knows what's next.",
      "Create your first project in a minute, and invite your team when you're ready.",
      "The Acme team",
    ].join("\n\n"),
  },
  {
    role: "user",
    ago: 14 * MINUTE,
    content: "Nice. Shorten the subject line and mention the free plan.",
  },
  {
    role: "assistant",
    ago: 13 * MINUTE,
    content: [
      "Done.",
      "**Subject:** Meet Orbit",
      "Hi there,",
      "Today we're launching Orbit. It brings your plans, files and updates into a single workspace, so your team always knows what's next.",
      "Orbit is free to start: create your first project in a minute, and invite your team when you're ready.",
      "The Acme team",
    ].join("\n\n"),
  },
] as const;

// The people and the workspaces of the demo: what it takes by name (their
// slugs and addresses), and since when they have been there.
const PEOPLE = [
  {
    id: CAMILLE,
    name: "Camille Laurent",
    email: "camille@example.com",
    since: 120 * DAY,
  },
  { id: LEA, name: "Léa Martin", email: "lea@example.com", since: 100 * DAY },
  { id: TOM, name: "Tom Becker", email: "tom@example.com", since: 42 * DAY },
] as const;

const WORKSPACES = [
  { id: ACME, name: "Acme", slug: "acme", made: 120 * DAY, changed: 25 * DAY },
  {
    id: NORTHWIND,
    name: "Northwind",
    slug: "northwind",
    made: 70 * DAY,
    changed: 70 * DAY,
  },
] as const;

/** What the demo reads and writes with: the database, or a transaction of it. */
type Writer = Pick<Db, "insert" | "select">;

/**
 * The slugs and addresses of the demo that already belong to a row that is not
 * its own (a workspace `acme` made by hand, a person who signed up with one of
 * its addresses). Its own rows do not count: a second run finds them there.
 */
async function takenByOthers(db: Writer): Promise<string[]> {
  const workspaces = await db
    .select({ id: schema.organization.id, slug: schema.organization.slug })
    .from(schema.organization)
    .where(
      inArray(
        schema.organization.slug,
        WORKSPACES.map(({ slug }) => slug),
      ),
    );
  const people = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(
      inArray(
        schema.user.email,
        PEOPLE.map(({ email }) => email),
      ),
    );

  return [
    ...workspaces
      .filter(
        ({ id, slug }) =>
          !WORKSPACES.some((own) => own.id === id && own.slug === slug),
      )
      .map(({ slug }) => slug),
    ...people
      .filter(
        ({ id, email }) =>
          !PEOPLE.some((own) => own.id === id && own.email === email),
      )
      .map(({ email }) => email),
  ];
}

/** Every row of the demo, dated from `now`. */
async function writeDemo(
  db: Writer,
  now: Date,
  password: string,
): Promise<void> {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  // "This month" is the UTC month of `now`, as the shell counts the credits
  // (getCreditsUsedThisMonth). What is dated this month is placed between its
  // first instant and now: counted back from now ("2 days ago"), it would fall
  // in the previous month when now is the first.
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const thisMonth = (share: number) =>
    new Date(
      monthStart.getTime() +
        Math.round((now.getTime() - monthStart.getTime()) * share),
    );

  await db
    .insert(schema.user)
    .values(
      PEOPLE.map(({ id, name, email, since }) => ({
        id,
        name,
        email,
        emailVerified: true,
        onboardingCompleted: true,
        createdAt: ago(since),
        updatedAt: ago(since),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.account)
    .values(
      PEOPLE.map(({ id, since }) => ({
        id: `${id}-account`,
        accountId: id,
        providerId: "credential",
        userId: id,
        password,
        createdAt: ago(since),
        updatedAt: ago(since),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.organization)
    .values(
      WORKSPACES.map(({ id, name, slug, made, changed }) => ({
        id,
        name,
        slug,
        createdAt: ago(made),
        updatedAt: ago(changed),
      })),
    )
    .onConflictDoNothing();
  // Camille's membership of Acme is the oldest of hers: the workspace a person
  // falls back to, when the session names none they still belong to, is their oldest.
  await db
    .insert(schema.organizationMember)
    .values([
      {
        id: "demo-member-camille-acme",
        userId: CAMILLE,
        organizationId: ACME,
        role: "owner",
        createdAt: ago(120 * DAY),
      },
      {
        id: "demo-member-lea-acme",
        userId: LEA,
        organizationId: ACME,
        role: "admin",
        createdAt: ago(100 * DAY),
      },
      {
        id: "demo-member-tom-acme",
        userId: TOM,
        organizationId: ACME,
        role: "member",
        createdAt: ago(42 * DAY),
      },
      {
        id: "demo-member-camille-northwind",
        userId: CAMILLE,
        organizationId: NORTHWIND,
        role: "owner",
        createdAt: ago(70 * DAY),
      },
    ])
    .onConflictDoNothing();

  // Renewed 12 days ago for 30, so it renews in 18. Northwind has none: the free plan.
  await db
    .insert(schema.subscription)
    .values({
      id: SUBSCRIPTION,
      organizationId: ACME,
      status: "active",
      planId: "pro",
      currentPeriodEnd: new Date(now.getTime() + 18 * DAY),
      createdAt: ago(90 * DAY),
      updatedAt: ago(12 * DAY),
    })
    .onConflictDoNothing();

  await db
    .insert(schema.project)
    .values(
      PROJECTS.map(({ name, status, by, changed, made, about }) => ({
        id: projectId(name),
        organizationId: ACME,
        name,
        description: about,
        status,
        createdBy: by,
        createdAt: ago(made),
        updatedAt: ago(changed),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.aiCreditLedger)
    .values([
      {
        id: "demo-credits-allocation",
        organizationId: ACME,
        amount: 5000,
        reason: "plan_allocation",
        referenceId: SUBSCRIPTION,
        createdAt: monthStart,
      },
      // Northwind is on the free plan, with no subscription to point at: it has the credits of that plan for the month,
      // so that the assistant answers in both workspaces of the demo
      {
        id: "demo-credits-allocation-northwind",
        organizationId: NORTHWIND,
        amount: CREDIT_PLANS.free,
        reason: "plan_allocation",
        createdAt: monthStart,
      },
      ...CREDIT_USE.map(({ amount, share }, index) => ({
        id: `demo-credits-use-${index + 1}`,
        organizationId: ACME,
        amount,
        reason: "usage",
        createdAt: thisMonth(share),
      })),
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.aiConversation)
    .values({
      id: CONVERSATION,
      organizationId: ACME,
      userId: CAMILLE,
      title: "Draft the launch email",
      model: "gpt-4o-mini",
      createdAt: ago(MESSAGES[0].ago),
      updatedAt: ago(MESSAGES[3].ago),
    })
    .onConflictDoNothing();
  await db
    .insert(schema.aiMessage)
    .values(
      MESSAGES.map(({ role, content, ago: sent }, index) => ({
        id: `demo-message-${index + 1}`,
        conversationId: CONVERSATION,
        role,
        content,
        createdAt: ago(sent),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(schema.upload)
    .values(
      UPLOADS.map(({ filename, mimetype, megabytes, by, age }, index) => ({
        id: `demo-upload-${index + 1}`,
        userId: by,
        organizationId: ACME,
        filename,
        mimetype,
        size: megabytes * MEGABYTE,
        storageKey: `uploads/demo/${filename}`,
        createdAt: ago(age),
      })),
    )
    .onConflictDoNothing();

  // Events as the app records them: who, which resource, and the name of a
  // project in the details. Nobody does a renewal, so there is no actor.
  await db
    .insert(schema.auditLog)
    .values([
      {
        id: "demo-audit-1",
        orgId: ACME,
        actorId: LEA,
        action: "project.updated",
        resourceType: "project",
        resourceId: projectId("Atlas"),
        metadata: { name: "Atlas" },
        createdAt: ago(2 * HOUR),
      },
      {
        id: "demo-audit-2",
        orgId: ACME,
        actorId: CAMILLE,
        action: "project.created",
        resourceType: "project",
        resourceId: projectId("Orbit"),
        metadata: { name: "Orbit" },
        createdAt: ago(6 * HOUR),
      },
      {
        id: "demo-audit-3",
        orgId: ACME,
        action: "subscription.updated",
        resourceType: "subscription",
        resourceId: ACME,
        metadata: { planId: "pro" },
        createdAt: ago(12 * DAY),
      },
      {
        id: "demo-audit-4",
        orgId: ACME,
        actorId: CAMILLE,
        action: "organization.updated",
        resourceType: "organization",
        resourceId: ACME,
        metadata: { name: "Acme" },
        createdAt: ago(25 * DAY),
      },
      {
        id: "demo-audit-5",
        orgId: ACME,
        actorId: CAMILLE,
        action: "member.invited",
        resourceType: "invitation",
        resourceId: "demo-invitation-tom",
        metadata: { email: "tom@example.com", role: "member" },
        createdAt: ago(42 * DAY + 3 * HOUR),
      },
    ])
    .onConflictDoNothing();

  // Two unread and three read, the latest first. Each is about Acme, whose pages
  // its link opens, and is stored as its type and the values its messages name:
  // the bell says it in the language of the person who reads it.
  await db
    .insert(schema.notification)
    .values([
      {
        id: "demo-notification-1",
        userId: CAMILLE,
        organizationId: ACME,
        type: "project.updated",
        values: { actor: "Léa Martin", name: "Atlas" },
        read: false,
        link: `/projects/${projectId("Atlas")}`,
        createdAt: ago(2 * HOUR),
      },
      {
        id: "demo-notification-2",
        userId: CAMILLE,
        organizationId: ACME,
        type: "ai.credits_low",
        values: { workspace: "Acme", percent: "82" },
        read: false,
        link: "/ai",
        createdAt: ago(5 * HOUR),
      },
      {
        id: "demo-notification-3",
        userId: CAMILLE,
        organizationId: ACME,
        type: "payment.succeeded",
        values: { workspace: "Acme", plan: "Pro" },
        read: true,
        link: "/settings/billing",
        createdAt: ago(12 * DAY),
      },
      {
        id: "demo-notification-4",
        userId: CAMILLE,
        organizationId: ACME,
        type: "member.joined",
        values: { actor: "Tom Becker", workspace: "Acme" },
        read: true,
        link: "/settings/team",
        createdAt: ago(42 * DAY),
      },
      {
        id: "demo-notification-5",
        userId: CAMILLE,
        organizationId: ACME,
        type: "organization.created",
        values: { workspace: "Acme" },
        read: true,
        link: "/projects",
        createdAt: ago(120 * DAY),
      },
    ])
    .onConflictDoNothing();
}

/**
 * The demo workspace: what the README's screenshots show, and what a developer
 * finds after `npm run db:seed`. Three invented people (the password of the
 * seed's dev accounts, addresses on example.com), Acme on the Pro plan with a
 * team, twelve projects, a month of use, an assistant conversation and some
 * activity, and Northwind, a second workspace on the free plan.
 *
 * Every date is relative to `now`, so that "2 hours ago" reads that way
 * whenever it is seeded. It needs the plans of the seed (the subscription
 * points at `pro`). It is idempotent: the ids are fixed, and a row that is
 * already there is left as it is. It is all or nothing: the rows go in one
 * transaction, and when a slug or an address of the demo already belongs to
 * another row it writes none of them, and says so in a line.
 */
export async function seedDemo(db: Db, now = new Date()): Promise<void> {
  const password = await hashPassword(PASSWORD);

  const taken = await db.transaction(async (tx) => {
    const names = await takenByOthers(tx);
    if (names.length === 0) {
      await writeDemo(tx, now, password);
    }

    return names;
  });

  console.log(
    taken.length > 0
      ? `Demo workspace skipped, ${taken.join(" and ")} already taken`
      : "Demo workspace seeded: camille@example.com / admin123",
  );
}
