import { describe, expect, it } from "vitest";
import { ModelSelector } from "@/features/ai/components/model-selector";
import { AI_MODELS } from "@/features/ai/config/models";
import { attribute, startTags } from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

/**
 * The picker of the model. Its trigger shows the model that is picked, and says
 * what it is for: a control that has only its value for a name is read as the
 * model, never as the picker.
 */

const draw = (locale: "en" | "fr" = "en") =>
  renderWithIntl(<ModelSelector models={AI_MODELS.slice(0, 2)} value="gpt-4o-mini" onValueChange={() => {}} />, locale);

const triggerOf = (html: string) => startTags(html, "button").find((tag) => attribute(tag, "role") === "combobox") ?? "";

describe("the model selector", () => {
  it("names its trigger for what it is for, in the words of the page", () => {
    expect(attribute(triggerOf(draw()), "aria-label")).toBe("Select model");
    expect(attribute(triggerOf(draw("fr")), "aria-label")).toBe("Sélectionner un modèle");
  });
});
