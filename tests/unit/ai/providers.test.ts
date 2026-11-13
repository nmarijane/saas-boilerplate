import { afterEach, describe, expect, it, vi } from "vitest";
import { getAvailableModels } from "@/features/ai/config/models";
import { getAvailableProviders, PROVIDER_ENV_KEYS } from "@/features/ai/config/providers";

/**
 * The page of the assistant, when no provider is on, names the variables to set
 * (`PROVIDER_ENV_KEYS`). The list is written once, next to the code that reads
 * the variables: a provider added to `getAvailableProviders` without its key in
 * the list would leave the page naming too few.
 */

/** No provider is on: every variable that switches one on is empty. */
function withNothingSet() {
  for (const key of [...PROVIDER_ENV_KEYS, "OLLAMA_BASE_URL"]) {
    vi.stubEnv(key, "");
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the variables that switch a provider on", () => {
  it("has no provider on when none of them is set", () => {
    withNothingSet();

    expect(getAvailableProviders()).toEqual([]);
  });

  it.each(PROVIDER_ENV_KEYS)("%s switches a provider on, alone", (key) => {
    withNothingSet();
    vi.stubEnv(key, "a-key");

    expect(getAvailableProviders()).toHaveLength(1);
  });

  // The README, the setup guide and the page of the assistant say that an Ollama address alone
  // does not turn the assistant on: a model added for it makes them out of date
  it("leaves Ollama a provider with no model of the list, so that its address alone does not turn the assistant on", () => {
    withNothingSet();
    vi.stubEnv("OLLAMA_BASE_URL", "http://localhost:11434/v1");

    expect(getAvailableProviders()).toEqual(["ollama"]);
    expect(getAvailableModels(getAvailableProviders())).toEqual([]);
  });

  it("are one provider each, and the page names every one that has models", () => {
    withNothingSet();
    for (const key of PROVIDER_ENV_KEYS) {
      vi.stubEnv(key, "a-key");
    }

    expect(getAvailableProviders()).toEqual(["openai", "anthropic", "google", "groq"]);
    expect(PROVIDER_ENV_KEYS).toHaveLength(4);
  });
});
