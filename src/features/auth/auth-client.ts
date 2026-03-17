"use client";

import { organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
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
  resetPassword,
} = authClient;

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function forgetPassword(data: { email: string; redirectTo?: string }) {
  const res = await fetch(`${baseURL}/api/auth/forget-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
