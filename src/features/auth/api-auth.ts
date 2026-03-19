import type { Session } from "@/features/auth/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth";

interface AuthSuccess { authenticated: true; session: Session }
interface AuthFailure { authenticated: false; response: NextResponse }
type AuthResult = AuthSuccess | AuthFailure;

export async function requireApiAuth(): Promise<AuthResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED", status: 401 },
        { status: 401 },
      ),
    };
  }

  return { authenticated: true, session };
}
