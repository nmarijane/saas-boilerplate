import type { FeatureShell } from "@/shared/shell/contract";
import { HardDriveIcon } from "lucide-react";
import { getStorageUsedMb } from "./queries";
import { deleteWorkspaceFiles } from "./service";

// What the uploads add to the shell: what the workspace's files weigh, counted
// against the storage limit of the plan (shown, and enforced by the upload), and the deletion
// of its stored files when the workspace is deleted. It is all the feature
// gives, so it is all this file holds: removing the upload feature is deleting
// its folder and its line in the registry.
export const uploadShell: FeatureShell = {
  id: "upload",
  // After billing: the files cannot be brought back, so they go once nothing refused
  onWorkspaceDelete: {
    order: 50,
    run: async (orgId) => {
      await deleteWorkspaceFiles(orgId);
      return null;
    },
    failureKey: "upload.deleteWorkspaceFailed",
  },
  limits: [{ limitKey: "storage", used: getStorageUsedMb }],
  quotas: [
    {
      id: "storage",
      limitKey: "storage",
      labelKey: "quotas.storage",
      unit: "megabyte",
      icon: HardDriveIcon,
      tone: 4,
      order: 30,
      usage: ({ orgId }) => getStorageUsedMb(orgId),
    },
  ],
};
