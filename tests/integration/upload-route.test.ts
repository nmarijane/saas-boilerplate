import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/upload/route";
import { requireApiAuth } from "@/features/auth/api-auth";
import { getActiveOrgId } from "@/features/auth/organization/active-org";
import { failureMessage, UploadFailed } from "@/features/upload/upload-failure";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { upload } from "@/models/upload";
import { intl } from "../helpers/admin-pages";
import { seedOrg, seedUser } from "../helpers/seed";
import { fakeSession } from "../helpers/session";
import { testDb } from "../setup";

/**
 * What the route that takes a file answers when it refuses one, and what the page
 * makes of that answer. The route answers a 400 in the shape of its other errors
 * (`{ error, code, status, values }`), and the hook that calls it tells the person
 * in the language of the page: the body that is read here is the route's own.
 */

vi.mock("@/features/auth/api-auth", () => ({ requireApiAuth: vi.fn() }));
vi.mock("@/features/auth/organization/active-org", () => ({ getActiveOrgId: vi.fn() }));
// The English sentence of the answer is built from the message files, by the translator of the server
vi.mock("next-intl/server", async () => (await import("../helpers/admin-pages")).intlServerMock());

const put = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/upload/storage/adapter", () => ({
  getStorageAdapter: vi.fn().mockResolvedValue({ put: (...args: unknown[]) => put(...args), get: vi.fn(), delete: vi.fn() }),
}));

const USER = "ur-user-1";
const ORG = "ur-org-1";

function send(file?: File) {
  const formData = new FormData();
  if (file) {
    formData.set("file", file);
  }

  return POST(new Request("http://localhost:3088/api/upload", { method: "POST", body: formData }));
}

const TOO_LARGE = () => new File([new Uint8Array(10_000_001)], "big.png", { type: "image/png" });
const WRONG_TYPE = () => new File(["MZ"], "setup.exe", { type: "application/x-msdownload" });

/** The translator the page reads its messages with, in a language. */
function translatorOf(locale: "en" | "fr") {
  const t = createTranslator({ locale, messages: locale === "en" ? en : fr, onError: (error) => { throw error; } });
  return (key: string, values?: Record<string, string | number>) => t(key as never, values as never) as string;
}

describe("the upload route, when it refuses a file", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    intl.locale = "en";
    vi.mocked(requireApiAuth).mockResolvedValue({ authenticated: true, session: fakeSession(USER) } as never);
    vi.mocked(getActiveOrgId).mockResolvedValue(ORG);
    await testDb.delete(upload);
    await seedUser(USER);
    await seedOrg(ORG);
  });

  it("answers a file that is too large with a 400 in the shape of its other errors", async () => {
    const response = await send(TOO_LARGE());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "This file is too large. The maximum size is 10 MB.",
      code: "FILE_TOO_LARGE",
      status: 400,
      values: { max: 10 },
    });
  });

  it("answers a type it does not take with a 400 that names the type", async () => {
    const response = await send(WRONG_TYPE());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Files of type application/x-msdownload are not accepted.",
      code: "FILE_TYPE_NOT_ALLOWED",
      status: 400,
      values: { type: "application/x-msdownload" },
    });
  });

  it("writes its sentence in English whatever the language of the request: it is for the clients of the API", async () => {
    intl.locale = "fr";

    const body = await (await send(TOO_LARGE())).json();

    expect(body.error).toBe("This file is too large. The maximum size is 10 MB.");
  });

  it("answers a request with no file in the same shape, with a code of its own", async () => {
    const response = await send();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing required fields", code: "MISSING_FIELDS", status: 400 });
  });

  it("stores nothing for a file it refuses", async () => {
    await send(TOO_LARGE());
    await send(WRONG_TYPE());

    expect(put).not.toHaveBeenCalled();
    expect(await testDb.select().from(upload)).toHaveLength(0);
  });

  it("takes a file that is within the limit", async () => {
    const response = await send(new File(["a screenshot"], "shot.png", { type: "image/png" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ filename: "shot.png" });
  });
});

// The page reads the body of the route as it is: the 400 that the route answers is fed to the function that tells the
// person, in each language, and says the message of the locales with the figure or the type of the refused file
describe("what the page tells of the 400 that the route answers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    intl.locale = "en";
    vi.mocked(requireApiAuth).mockResolvedValue({ authenticated: true, session: fakeSession(USER) } as never);
    vi.mocked(getActiveOrgId).mockResolvedValue(ORG);
  });

  it.each([
    ["en", "This file is too large. The maximum size is 10 MB."],
    ["fr", "Ce fichier est trop volumineux. La taille maximale est de 10 Mo."],
  ] as const)("tells a file that is too large in the language of the page (%s)", async (locale, sentence) => {
    const response = await send(TOO_LARGE());

    expect(failureMessage(new UploadFailed(response.status, await response.json()), translatorOf(locale))).toBe(sentence);
  });

  it.each([
    ["en", "Files of type application/x-msdownload are not accepted."],
    ["fr", "Les fichiers de type application/x-msdownload ne sont pas acceptés."],
  ] as const)("tells a type that is not taken in the language of the page (%s)", async (locale, sentence) => {
    const response = await send(WRONG_TYPE());

    expect(failureMessage(new UploadFailed(response.status, await response.json()), translatorOf(locale))).toBe(sentence);
  });

  it.each([
    ["en", "We couldn't upload the file. Please try again."],
    ["fr", "Impossible de téléverser le fichier. Veuillez réessayer."],
  ] as const)("tells any other answer as the generic failure, in the language of the page (%s)", async (locale, sentence) => {
    vi.mocked(getActiveOrgId).mockResolvedValueOnce(null);
    const noOrg = await send(TOO_LARGE());
    const noFile = await send();

    expect((await noOrg.clone().json()).code).toBe("NO_ORG");
    expect((await noFile.clone().json()).code).toBe("MISSING_FIELDS");
    expect(failureMessage(new UploadFailed(noOrg.status, await noOrg.json()), translatorOf(locale))).toBe(sentence);
    expect(failureMessage(new UploadFailed(noFile.status, await noFile.json()), translatorOf(locale))).toBe(sentence);
    expect(failureMessage(new UploadFailed(500, { error: "Upload failed", code: "UPLOAD_ERROR", status: 500 }), translatorOf(locale))).toBe(sentence);
    expect(failureMessage(new UploadFailed(0, null), translatorOf(locale))).toBe(sentence);
  });
});
