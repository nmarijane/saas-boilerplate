import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AVAILABLE_EVENTS } from "@/features/webhooks/available-events";
import { eventsSchema } from "@/features/webhooks/events-schema";

const FEATURE = join(__dirname, "../../../src/features/webhooks");

describe("the events an endpoint asks for", () => {
  it("are the events the dialog offers, and nothing else", () => {
    expect(eventsSchema.safeParse(["payment.succeeded"]).success).toBe(true);
    expect(eventsSchema.safeParse(["payment.refunded"]).success).toBe(false);
    expect(eventsSchema.safeParse(["subscription.*"]).success).toBe(false);
    expect(eventsSchema.safeParse(["**"]).success).toBe(false);
    expect(eventsSchema.safeParse("payment.succeeded").success).toBe(false);
  });

  it("are at least one", () => {
    expect(eventsSchema.safeParse([]).success).toBe(false);
  });

  it("are no more than the events there are: one more is refused, whatever it is", () => {
    expect(eventsSchema.safeParse(AVAILABLE_EVENTS).success).toBe(true);
    expect(eventsSchema.safeParse([...AVAILABLE_EVENTS, AVAILABLE_EVENTS[0]]).success).toBe(false);
    expect(eventsSchema.safeParse(Array.from({ length: AVAILABLE_EVENTS.length + 1 }, () => "payment.succeeded")).success).toBe(false);
  });

  it("are kept once, in the order each was first given", () => {
    expect(eventsSchema.parse(["project.created", "payment.succeeded", "project.created", "member.invited", "payment.succeeded"])).toEqual([
      "project.created",
      "payment.succeeded",
      "member.invited",
    ]);
    expect(eventsSchema.parse(Array.from({ length: AVAILABLE_EVENTS.length }, () => "payment.succeeded"))).toEqual(["payment.succeeded"]);
    expect(eventsSchema.parse(AVAILABLE_EVENTS)).toEqual(AVAILABLE_EVENTS);
  });

  // The action that makes an endpoint and the one that would change it read the same schema: a list of events that one
  // takes and the other refuses is a bug that no one notices. The list of events is read by this schema, in a schema of
  // an action, nowhere else.
  it("are read by one schema, which every action that receives some imports", () => {
    const files = readdirSync(FEATURE).filter((file) => /\.tsx?$/.test(file) && file !== "events-schema.ts");

    for (const file of files) {
      const source = readFileSync(join(FEATURE, file), "utf8");

      expect(source, `${file} writes its own schema of the events`).not.toMatch(/z\.enum\(\s*AVAILABLE_EVENTS|z\.array\(\s*z\.(?:string|enum)/);
    }

    expect(readFileSync(join(FEATURE, "actions.ts"), "utf8")).toMatch(/events:\s*eventsSchema/);
  });
});
