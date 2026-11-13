import { isAppPath, isWebAddress } from "@/shared/components/shell/nav-row";

/** The two ways of going somewhere: the router of the app, and the browser's own navigation. */
interface LinkNavigation {
  push: (href: string) => void;
  assign: (href: string) => void;
}

/**
 * Follows the link of a notification, and says whether it did. A page of the
 * app goes through the router, which adds the language and keeps the app
 * loaded; a web address leaves the app. Anything else is not followed: the link
 * is data that a job or a webhook wrote, and a `javascript:` or a `data:`
 * address handed to the browser's navigation would run in this page. The rule
 * for a page of the app is the shell's (`isAppPath`).
 */
export function followNotificationLink(
  link: string | null,
  navigation: LinkNavigation,
): boolean {
  if (link === null) {
    return false;
  }

  if (isAppPath(link)) {
    navigation.push(link);
    return true;
  }

  if (isWebAddress(link)) {
    navigation.assign(link);
    return true;
  }

  return false;
}

/** What following a notification of another workspace needs besides the navigation: the switch of workspace. */
interface WorkspaceNavigation extends LinkNavigation {
  /**
   * Makes a workspace the active one, then goes to a page of it
   * (`useSwitchWorkspace`). It answers whether it did, and says so itself when
   * it could not.
   */
  switchTo: (organizationId: string, href: string) => Promise<boolean>;
}

/**
 * Follows a notification, and says whether it did. A notification belongs to
 * the person, and its link to a workspace, which the pages read from the
 * session: a page of another workspace than the active one is opened in its
 * workspace, which is made the active one first. One of the active workspace,
 * or of the account (no workspace), or a web address, is just followed. A
 * workspace that cannot be opened (the person left it) leaves them where they
 * are: the switch says so.
 */
export async function followNotification(
  item: { link: string | null; organizationId?: string | null },
  activeWorkspaceId: string | null,
  navigation: WorkspaceNavigation,
): Promise<boolean> {
  const workspaceId = item.organizationId;
  if (item.link === null || !isAppPath(item.link) || !workspaceId || workspaceId === activeWorkspaceId) {
    return followNotificationLink(item.link, navigation);
  }

  return navigation.switchTo(workspaceId, item.link);
}
