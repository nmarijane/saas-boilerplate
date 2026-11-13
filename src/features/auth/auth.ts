import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, twoFactor } from "better-auth/plugins";
import { sendEmail } from "@/features/email/send";
import { ResetPassword } from "@/features/email/templates/reset-password";
import { VerifyEmail } from "@/features/email/templates/verify-email";
import { db } from "@/shared/lib/DB";
import { verificationLink } from "./verification";

// The verification e-mail says that its link lasts 24 hours (templates/verify-email.tsx)
const VERIFICATION_LINK_SECONDS = 60 * 60 * 24;
// The invitation e-mail says that it lasts 7 days (templates/invitation.tsx)
const INVITATION_SECONDS = 60 * 60 * 24 * 7;

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
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        template: ResetPassword({
          name: user.name,
          resetUrl: url,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // A person who signs in with the right password before they verified the address is
    // sent a new link, and told so: the link of sign-up expires, and without it that link
    // would be the only way in. The sign-in form sends it (`signInFlow`), not the server:
    // the link of the server cannot say where it comes back to (a sign-in does not say
    // where the person came from), and the form can, as the link of sign-up does. The form
    // asks only after the refusal that the right password alone earns: nothing is mailed to
    // whoever merely knows the address.
    sendOnSignIn: false,
    expiresIn: VERIFICATION_LINK_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email",
        template: VerifyEmail({
          name: user.name,
          // Lands on the verify page, which says that it worked (verification.ts)
          verificationUrl: verificationLink(url),
        }),
      });
    },
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
    }),
    twoFactor(),
  ],
});

export type Session = typeof auth.$Infer.Session;
