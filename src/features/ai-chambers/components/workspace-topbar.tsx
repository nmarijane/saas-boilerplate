"use client";

import { UserMenu } from "@/features/auth/components/user-menu";

export function WorkspaceTopbar({ orgName }: { orgName: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "0.75rem",
        marginBottom: "1rem",
        borderBottom:
          "1px solid var(--pf-t--global--border--color--default, #d2d2d2)",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{orgName}</span>
      <UserMenu />
    </div>
  );
}
