import { slugify } from "@/shared/utils/helpers";

// What `createOrganization` accepts for a slug: lowercase letters, digits and
// hyphens, from 1 to 100 characters.
const SLUG_MAX = 100;
const SUFFIX_LENGTH = 6;
const BASE_36 = 36;
const TRAILING_HYPHENS_RE = /-+$/;

/** Six characters in base 36, from the random source of the platform. */
function randomSuffix(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(SUFFIX_LENGTH)),
    (byte) => (byte % BASE_36).toString(BASE_36),
  ).join("");
}

/**
 * The slug of a workspace, from its name: `studio-nord-k3x9ab`. Nobody picks
 * it, since a workspace has no address of its own yet: the name makes it
 * readable and the suffix keeps two workspaces of one name apart. A name with
 * no Latin letter or digit gives `workspace-k3x9ab`. The name is cut so that
 * the whole slug fits the 100 characters of the server.
 */
export function workspaceSlug(
  name: string,
  random: () => string = randomSuffix,
): string {
  const suffix = random();
  // The cut can leave a hyphen at the end of the name, which would double the one before the suffix.
  const base =
    slugify(name)
      .slice(0, SLUG_MAX - suffix.length - 1)
      .replace(TRAILING_HYPHENS_RE, "") || "workspace";

  return `${base}-${suffix}`;
}
