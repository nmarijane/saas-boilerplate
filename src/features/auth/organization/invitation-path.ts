/**
 * The page of an invitation, under a language (`/fr/accept-invitation/<id>`):
 * every path of the app carries its locale, and the e-mail is opened in a
 * browser that may have no memory of it. The page needs no session, so it is
 * not one of the prefixes the proxy protects.
 */
export function invitationPath(invitationId: string, locale: string): string {
  return `/${locale}/accept-invitation/${encodeURIComponent(invitationId)}`;
}
