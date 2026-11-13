import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AVAILABLE_EVENTS } from "@/features/webhooks/available-events";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { messageAt } from "../../helpers/copy";

const ROOT = resolve(import.meta.dirname, "../../..");
const WEBHOOKS = join(ROOT, "src/features/webhooks");

describe("the events an endpoint can ask for", () => {
  it("offers each event once", () => {
    expect(new Set(AVAILABLE_EVENTS).size).toBe(AVAILABLE_EVENTS.length);
  });

  // An endpoint can only ask for what the dialog offers: an event the app raises and the list lacks could never be
  // delivered to anyone. The names are read where they are raised, so that a feature taken out, or added, leaves the
  // test true with no edit of its own.
  it("offers every event the app raises", () => {
    const raised = new Set<string>();
    for (const file of readdirSync(join(ROOT, "src"), { recursive: true, encoding: "utf8" })) {
      if (!/\.tsx?$/.test(file) || /\.(?:stories|test)\./.test(file)) {
        continue;
      }
      const source = readFileSync(join(ROOT, "src", file), "utf-8");
      for (const [, name] of source.matchAll(/\bemitEvent\(\s*["']([a-z_]+\.[a-z_]+)["']/g)) {
        raised.add(name ?? "");
      }
    }

    // It sees the calls it is made to see: a reader that found none would pass for ever
    expect(raised.size).toBeGreaterThan(5);
    expect([...raised].filter((name) => !AVAILABLE_EVENTS.includes(name as never))).toEqual([]);
  });

  it("says each of them in words, in both languages: the label is a message, never a word of the component", () => {
    for (const [locale, messages] of [["en", en], ["fr", fr]] as const) {
      const missing = AVAILABLE_EVENTS.filter((name) => !messageAt(messages, `webhooks.event.${name}`)?.trim());

      expect(missing, `${locale}.json lacks the label of events`).toEqual([]);
    }
  });

  it("does not say two events the same way in one language", () => {
    for (const messages of [en, fr]) {
      const labels = AVAILABLE_EVENTS.map((name) => messageAt(messages, `webhooks.event.${name}`));

      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  // A value that a "use client" file exports reaches a Server Component as a reference to the client,
  // never as the list: the list is in a module that is neither, and the dialog reads it from there.
  it("is kept in a plain module, which is neither a client module nor a server one", () => {
    const source = readFileSync(join(WEBHOOKS, "available-events.ts"), "utf-8");

    expect(source).not.toMatch(/^\s*["']use (?:client|server)["']/m);
    expect(source).toContain("export const AVAILABLE_EVENTS");
  });

  it("is declared in that module alone: no client file of the feature declares or exports a list of its own", () => {
    const declaring = readdirSync(WEBHOOKS, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => /\bAVAILABLE_EVENTS\s*(?::[^=]+)?=/.test(readFileSync(join(WEBHOOKS, file), "utf-8")))
      .map((file) => file.split("\\").join("/"));

    expect(declaring).toEqual(["available-events.ts"]);
  });

  it("is read by the dialog from that module", () => {
    const dialog = readFileSync(join(WEBHOOKS, "components/create-webhook-modal.tsx"), "utf-8");

    expect(dialog).toContain('import { AVAILABLE_EVENTS } from "../available-events";');
    expect(dialog).not.toMatch(/export (?:const|function) AVAILABLE_EVENTS/);
  });
});
