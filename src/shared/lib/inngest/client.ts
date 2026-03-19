/**
 * Inngest client placeholder.
 * Properly implemented in Task 7 (Inngest setup + background jobs).
 */

interface InngestSendPayload {
  name: string;
  data: Record<string, unknown>;
}

interface InngestClient {
  send: (payload: InngestSendPayload) => Promise<void>;
}

export const inngest: InngestClient = {
  async send(_payload) {
    throw new Error(
      "Inngest client is not configured. Set up Inngest in Task 7.",
    );
  },
};
