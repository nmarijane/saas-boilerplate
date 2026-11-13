"use server";

import { APIError } from "better-auth/api";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { auth } from "@/features/auth/auth";
import { enforceActionRateLimit, getClientIp } from "@/shared/lib/rate-limit/action";
import { RESET_TOKEN_COOKIE, resetTokenPath } from "./reset-token";

/** What the form reads of the answer: an `error` when the password was not set, as the auth client gives one. */
interface ResetAnswer {
  error: { code?: string; message?: string; status?: number } | null;
}

const resetSchema = z.object({ newPassword: z.string().min(1).max(128) });

// Public by nature: whoever lost their password is not signed in. What stands in for a
// session is the token of the link, which is not an argument: it waits in an HttpOnly
// cookie that the proxy set when the link was followed, and is read here, on the server.
export async function resetPasswordWithLinkToken(input: { newPassword: string }): Promise<ResetAnswer> {
  const cookieStore = await cookies();
  // The cookie lives on the path of the reset page of the language: it is taken away on that path
  const path = resetTokenPath(await getLocale());
  const forget = () => cookieStore.set(RESET_TOKEN_COOKIE, "", { path, maxAge: 0, httpOnly: true });

  try {
    await enforceActionRateLimit(`reset-password:${await getClientIp()}`, 10, 60);
  } catch (error) {
    unstable_rethrow(error);

    return { error: { status: 429 } };
  }

  const { newPassword } = resetSchema.parse(input);
  const token = cookieStore.get(RESET_TOKEN_COOKIE)?.value;
  if (!token) {
    return { error: { code: "INVALID_TOKEN", status: 400 } };
  }

  try {
    await auth.api.resetPassword({ body: { newPassword, token } });
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof APIError)) {
      throw error;
    }

    const code = error.body?.code;
    // A token that is no good is no good the next time either: it goes. A password that is refused (too short) can be retried
    if (code === "INVALID_TOKEN") {
      forget();
    }

    return { error: { code, message: error.body?.message, status: error.statusCode } };
  }

  forget();

  return { error: null };
}
