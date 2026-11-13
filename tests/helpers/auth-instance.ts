import type { Mock } from "vitest";
import { auth } from "@/features/auth/auth";

// What a test needs to act as people of the real Better Auth instance, over the
// migrated test database: an account made, verified and signed in, and the
// cookie a browser would send back. The test mocks the mail transport itself
// (its `sendMail` is handed in), so that the real templates are rendered and the
// links they hold can be followed; it stubs BETTER_AUTH_URL before auth.ts loads.

export const PASSWORD = "correct-horse-battery";

/** The links of the last e-mail sent to `email`, with their entities put back. */
export function linksSentTo(sendMail: Mock, email: string): string[] {
  const message = sendMail.mock.calls
    .map(([mail]) => mail as { to: string; html: string })
    .findLast((mail) => mail.to === email);

  return [...(message?.html.matchAll(/href="([^"]+)"/g) ?? [])].map(([, href]) => href.replaceAll("&amp;", "&"));
}

/** The cookies a browser would send back after the given response. */
export function cookieFrom(response: Headers): string {
  return response
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
}

/** A person who signed up, followed the link of the verification e-mail and signed in: their id and the headers of their browser. */
export async function registerUser(sendMail: Mock, email: string, name = "Test Person") {
  const { user } = await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  const verify = linksSentTo(sendMail, email).find((href) => href.includes("verify-email"));
  if (!verify) throw new Error(`No verification link was e-mailed to ${email}`);
  await auth.api.verifyEmail({ query: { token: new URL(verify).searchParams.get("token") ?? "" } });
  const { headers } = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true });

  return { id: user.id, email, headers: new Headers({ cookie: cookieFrom(headers) }) };
}
