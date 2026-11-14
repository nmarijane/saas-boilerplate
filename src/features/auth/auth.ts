import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { and, count, eq } from "drizzle-orm";
import { sendEmail } from "@/features/email/send";
import { sendAfterResponse } from "@/features/email/send-after-response";
import { ResetPassword } from "@/features/email/templates/reset-password";
import { VerifyEmail } from "@/features/email/templates/verify-email";
import { buildWelcomeMail } from "@/features/email/welcome";
import { organizationMember } from "@/models/organization";
import { MAX_OWNED_WORKSPACES } from "@/shared/config/app";
import { CLIENT_IP_HEADER } from "@/shared/lib/client-ip";
import { db } from "@/shared/lib/DB";
import { isAvatarUrl } from "@/shared/utils/avatar-url";
import { verificationLink } from "./verification";

// The verification e-mail says that its link lasts 24 hours (templates/verify-email.tsx)
const VERIFICATION_LINK_SECONDS = 60 * 60 * 24;
// The invitation e-mail says that it lasts 7 days (templates/invitation.tsx)
const INVITATION_SECONDS = 60 * 60 * 24 * 7;

/** The welcome mail, after the answer: a mail that fails is logged, and the person is not told. */
function sendWelcome(person: { name: string; email: string }): Promise<void> {
  return sendAfterResponse(async () => {
    const { subject, template } = await buildWelcomeMail(person.name);
    await sendEmail({ to: person.email, subject, template });
  });
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // A new password ends every session of the person: a password is reset when someone
    // else may have it, and a session they opened with it is renewed each time it is used
    revokeSessionsOnPasswordReset: true,
    // The mail goes out after the answer (sendAfterResponse): the answer takes the same time for an address
    // that has an account and one that has none
    sendResetPassword: ({ user, url }) =>
      sendAfterResponse(() =>
        sendEmail({
          to: user.email,
          subject: "Reset your password",
          template: ResetPassword({
            name: user.name,
            resetUrl: url,
          }),
        }),
      ),
  },
  emailVerification: {
    sendOnSignUp: true,
    // The address is confirmed: the welcome goes out now, not at sign-up, so that an address nobody confirmed gets one mail only
    afterEmailVerification: (user) => sendWelcome(user),
    // A person who signs in with the right password before they verified the address is
    // sent a new link, and told so: the link of sign-up expires, and without it that link
    // would be the only way in. The sign-in form sends it (`signInFlow`), not the server:
    // the link of the server cannot say where it comes back to (a sign-in does not say
    // where the person came from), and the form can, as the link of sign-up does. The form
    // asks only after the refusal that the right password alone earns: nothing is mailed to
    // whoever merely knows the address.
    sendOnSignIn: false,
    expiresIn: VERIFICATION_LINK_SECONDS,
    // After the answer, as the reset mail is: `/send-verification-email` holds its answer to a floor of
    // 500 ms to hide whether a mail was sent, and a mail that is awaited would lift the answer above it
    sendVerificationEmail: ({ user, url }) =>
      sendAfterResponse(() =>
        sendEmail({
          to: user.email,
          subject: "Verify your email",
          template: VerifyEmail({
            name: user.name,
            // Lands on the verify page, which says that it worked (verification.ts)
            verificationUrl: verificationLink(url),
          }),
        }),
      ),
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
  },
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        defaultValue: false,
        // requireAdmin trusts it: sign-up and update-user must never take it from the request.
        input: false,
      },
      onboardingCompleted: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },
  // A failed provider sign-in lands on the sign-in page of the app, with `?error=`, which says it in the words of
  // the page: Better Auth's own error page is unstyled under the closed policy of /api (next.config.ts)
  onAPIError: { errorURL: "/sign-in" },
  advanced: {
    // The limit by address of Better Auth reads the address from this header only, and
    // the route of Better Auth (api/auth/[...all]/route.ts) writes it: the address that
    // TRUST_PROXY allows, or none. The `X-Forwarded-For` of a client is nobody's word.
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
  databaseHooks: {
    user: {
      // A picture is an https address (isAvatarUrl): the browser of everyone who sees the person
      // fetches it. What a provider sends at a social sign-in that is not one is left out and the
      // person signs in without a picture; what the person sends is refused, and says so.
      create: {
        before: async (person) => ({
          data: { ...person, image: typeof person.image === "string" && isAvatarUrl(person.image) ? person.image : null },
        }),
        // A provider confirms the address itself (Google): such an account is welcomed as it is created
        after: async (person) => {
          if (person.emailVerified) {
            await sendWelcome(person);
          }
        },
      },
      update: {
        before: async (changes) => {
          if (typeof changes.image === "string" && changes.image !== "" && !isAvatarUrl(changes.image)) {
            throw new APIError("BAD_REQUEST", { message: "The picture must be an https address" });
          }
        },
      },
    },
  },
  // Organization writes go through organization/actions.ts (validation, requireRole, assertNotOwner);
  // over HTTP the browser only switches and reads the active organization.
  disabledPaths: [
    "/organization/create",
    "/organization/update",
    "/organization/delete",
    "/organization/invite-member",
    "/organization/cancel-invitation",
    "/organization/remove-member",
    "/organization/update-member-role",
    "/organization/accept-invitation",
    "/organization/reject-invitation",
    "/organization/leave",
  ],
  plugins: [
    // The plugin's `member` model lives in the existing organization_member table.
    organization({
      schema: { member: { modelName: "organizationMember" } },
      invitationExpiresIn: INVITATION_SECONDS,
      // A person owns a limited number of workspaces (MAX_OWNED_WORKSPACES); the ones they joined don't count
      organizationLimit: async (person) => {
        const [owned] = await db
          .select({ total: count() })
          .from(organizationMember)
          .where(and(eq(organizationMember.userId, person.id), eq(organizationMember.role, "owner")));

        return (owned?.total ?? 0) >= MAX_OWNED_WORKSPACES;
      },
    }),
    // Two-factor is off: the `twoFactor()` plugin has no page to ask for the code at sign-in
    // yet (docs/SETUP.md, "Two-factor authentication"). Its table and `two_factor_enabled` stay.
  ],
});

export type Session = typeof auth.$Infer.Session;
