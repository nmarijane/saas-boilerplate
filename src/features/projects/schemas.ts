import { z } from "zod";

// Nothing from the server here: forms import the statuses and the limits, and
// the actions parse their input with the schemas.

export const PROJECT_STATUSES = ["draft", "active"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_NAME_MAX = 80;
export const PROJECT_DESCRIPTION_MAX = 280;

const projectName = z.string().trim().min(1).max(PROJECT_NAME_MAX);
const projectDescription = z.string().trim().max(PROJECT_DESCRIPTION_MAX);

export const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  name: projectName,
  description: projectDescription.optional(),
});

// A field that is not sent keeps its value; a description sent as null is cleared.
export const updateProjectSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  name: projectName.optional(),
  description: projectDescription.nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export const deleteProjectSchema = z.object({
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
});
