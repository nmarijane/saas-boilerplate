// Which addresses an endpoint may have. The rule at creation is the shape of the
// address; what an address leads to is checked when an event is delivered
// (outbound.ts), because a name can lead somewhere else tomorrow.

/** Whether the address is one of this machine, which only development may deliver to. */
function isLocalhost(url: URL): boolean {
  return url.hostname === "localhost";
}

/**
 * An endpoint is an `https:` address with no credentials in it. `http://localhost`
 * is accepted in development only, to receive webhooks from a local tool.
 */
export function isAllowedEndpointUrl(value: string, development = process.env.NODE_ENV === "development"): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.username !== "" || url.password !== "") {
    return false;
  }

  return url.protocol === "https:" || (development && url.protocol === "http:" && isLocalhost(url));
}

export const ENDPOINT_URL_MAX = 2048;
