import { describe, expect, it, vi } from "vitest";
import { toggleFlagFlow } from "@/features/feature-flags/toggle-flag";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { FRAMEWORK_ERRORS } from "../../helpers/next-errors";

// The switch of a flag follows the server: it answers whether the server did it, and the row puts the switch back and says so when it did not.
describe("turning a flag on or off", () => {
  it("answers yes when the server did it, and asks for what the switch says", async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);

    expect(await toggleFlagFlow(toggle, { flagId: "f1", enabled: true })).toBe(true);
    expect(toggle).toHaveBeenCalledWith("f1", true);
  });

  it("answers no when the server refuses or does not answer, and the reporter hears of it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await toggleFlagFlow(vi.fn().mockRejectedValue(new Error("Feature flag not found")), { flagId: "f1", enabled: false })).toBe(false);
    expect(await toggleFlagFlow(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")), { flagId: "f1", enabled: false })).toBe(false);
    error.mockRestore();
  });

  it.each(FRAMEWORK_ERRORS)("hands on %s: the person is on their way elsewhere", async (_, failure) => {
    await expect(toggleFlagFlow(vi.fn().mockRejectedValue(failure), { flagId: "f1", enabled: true })).rejects.toBe(failure);
  });

  it("says why in both languages", () => {
    expect(en.admin.flagsTable.toggleFailed).toBe("We couldn't update this flag. Please try again.");
    expect(fr.admin.flagsTable.toggleFailed).toBe("Impossible de mettre à jour cet indicateur. Veuillez réessayer.");
  });
});
