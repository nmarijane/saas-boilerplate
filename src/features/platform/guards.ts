import { redirect } from "next/navigation";
import { requireAuth } from "@/features/auth/guards";

export async function requirePlatformAdmin() {
  const session = await requireAuth();
  if (!(session.user as Record<string, unknown>).isPlatformAdmin) {
    redirect("/dashboard");
  }
  return session;
}
