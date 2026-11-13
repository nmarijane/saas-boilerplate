import { z } from "zod";
import { AVAILABLE_EVENTS } from "./available-events";

/**
 * The events an endpoint asks for, as every action that receives some reads
 * them: the ones the dialog offers (`AVAILABLE_EVENTS`) and nothing else, as a
 * request does not have to come from the dialog. A list is at least one event,
 * and no longer than the events there are, so that a known event repeated
 * without end is not a list the server takes. An event is kept once, in the order
 * it was first given: an endpoint is delivered an event once, however many times
 * it asked for it. It is a module of its own, so that the action that makes an
 * endpoint and the one that would change it read the same schema.
 */
export const eventsSchema = z
  .array(z.enum(AVAILABLE_EVENTS))
  .min(1)
  .max(AVAILABLE_EVENTS.length)
  .transform((events) => [...new Set(events)]);
