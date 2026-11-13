/**
 * React's `cache` keeps an answer for the length of one server request. Outside
 * the server (a test runs the client build of React) it keeps nothing, so a test
 * of "once per request" has nothing to read. This is a `cache` that does: it keeps
 * an answer, by the arguments, until `endRequest()`, which is the next request.
 *
 * A test file puts it in place of React's:
 *
 *     vi.mock("react", async (importOriginal) => ({
 *       ...(await importOriginal<typeof import("react")>()),
 *       cache: (await import("../helpers/request-cache")).requestCache.cache,
 *     }));
 */
const memos: Map<string, unknown>[] = [];

export const requestCache = {
  cache<Args extends unknown[], Result>(read: (...args: Args) => Result): (...args: Args) => Result {
    const answers = new Map<string, unknown>();
    memos.push(answers);

    return (...args) => {
      const key = JSON.stringify(args);
      if (!answers.has(key)) {
        answers.set(key, read(...args));
      }

      return answers.get(key) as Result;
    };
  },

  /** The request is over: the next one reads again. */
  endRequest() {
    for (const answers of memos) {
      answers.clear();
    }
  },
};
