import { count, desc, eq, lt } from "drizzle-orm";
import { waitlistEntry } from "@/models/waitlist";
import { db } from "@/shared/lib/DB";
import { calculatePosition } from "./lib/referral";

export async function getWaitlistEntry(email: string) {
  const entry = await db
    .select()
    .from(waitlistEntry)
    .where(eq(waitlistEntry.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!entry) return null;

  const [rankRow] = await db
    .select({ rank: count() })
    .from(waitlistEntry)
    .where(lt(waitlistEntry.createdAt, entry.createdAt));

  const rank = Number(rankRow?.rank ?? 0) + 1;
  const position = calculatePosition(rank, entry.referralCount);

  return { ...entry, position };
}

export async function getWaitlistEntryByCode(code: string) {
  return db
    .select()
    .from(waitlistEntry)
    .where(eq(waitlistEntry.referralCode, code))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getWaitlistEntryById(id: string) {
  const entry = await db
    .select()
    .from(waitlistEntry)
    .where(eq(waitlistEntry.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!entry) return null;

  const [rankRow] = await db
    .select({ rank: count() })
    .from(waitlistEntry)
    .where(lt(waitlistEntry.createdAt, entry.createdAt));

  const rank = Number(rankRow?.rank ?? 0) + 1;
  const position = calculatePosition(rank, entry.referralCount);

  return { ...entry, position };
}

export async function getWaitlistStats() {
  const [totalRow] = await db.select({ total: count() }).from(waitlistEntry);
  const [invitedRow] = await db
    .select({ invited: count() })
    .from(waitlistEntry)
    .where(eq(waitlistEntry.status, "invited"));

  return {
    total: Number(totalRow?.total ?? 0),
    invited: Number(invitedRow?.invited ?? 0),
  };
}

export async function getTopReferrers(limit = 10) {
  return db
    .select()
    .from(waitlistEntry)
    .orderBy(desc(waitlistEntry.referralCount))
    .limit(limit);
}

export async function getAllWaitlistEntries(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [countRow] = await db.select({ total: count() }).from(waitlistEntry);

  const entries = await db
    .select()
    .from(waitlistEntry)
    .orderBy(desc(waitlistEntry.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    entries,
    total: Number(countRow?.total ?? 0),
    page,
    pageSize,
    totalPages: Math.ceil(Number(countRow?.total ?? 0) / pageSize),
  };
}
