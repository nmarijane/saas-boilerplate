"use client";

import { organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// No base URL: the client calls the origin of the page it runs in, which is
// where the session cookie lives. A URL written here (or read from the
// environment at build time) is the wrong origin on any other port, and on a
// preview deployment.
export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    twoFactorClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
} = authClient;
