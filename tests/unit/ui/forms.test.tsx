import type { ComponentProps } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ZapIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Field } from "@/shared/components/ui/field";
import { Input, inputVariants } from "@/shared/components/ui/input";
import { OptionCards } from "@/shared/components/ui/option-cards";
import { PasswordInput } from "@/shared/components/ui/password-input";
import {
  nextSegment,
  SegmentedControl,
} from "@/shared/components/ui/segmented-control";
import {
  Select,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea, textareaVariants } from "@/shared/components/ui/textarea";
import {
  contrastRatio,
  parseBlock,
  parseThemeBlocks,
} from "../../helpers/color";
import { renderWithIntl } from "../../helpers/intl";

const uiDir = resolve(import.meta.dirname, "../../../src/shared/components/ui");
const stylesDir = resolve(import.meta.dirname, "../../../src/styles");

const { light, dark: darkOverrides } = parseThemeBlocks(
  readFileSync(resolve(stylesDir, "theme.css"), "utf-8"),
);
const inline = parseBlock(
  readFileSync(resolve(stylesDir, "global.css"), "utf-8"),
  "@theme inline",
);

function tokens(classes: string): string[] {
  return classes.split(" ").filter(Boolean);
}

/** The start tags of an element, in document order. */
function startTags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "g")) ?? [];
}

/** The start tag of the element that has this id. */
function startTagOf(html: string, id: string): string {
  return new RegExp(`<[a-z][^>]*\\sid="${id}"[^>]*>`).exec(html)?.[0] ?? "";
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

function classesOf(tag: string): string[] {
  return tokens(attribute(tag, "class") ?? "");
}

const noop = () => undefined;

/** A control that sets its own aria attributes before it spreads the props it is given. */
function SelfDescribed(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      aria-required="true"
      aria-invalid="true"
      aria-describedby="own-note"
      {...props}
    />
  );
}

/** A Select that is required: Radix puts `aria-required` on its trigger, which takes the props. */
function RequiredRoleSelect(props: React.ComponentProps<typeof SelectTrigger>) {
  return (
    <Select required>
      <SelectTrigger {...props}>
        <SelectValue />
      </SelectTrigger>
    </Select>
  );
}

describe("field", () => {
  const emailField = (
    <Field
      label="Email"
      htmlFor="email"
      hint="We never share it"
      error="Enter a valid email address"
    >
      <Input type="email" />
    </Field>
  );

  it("links the label, the hint and the error to the control", () => {
    const html = renderWithIntl(emailField);
    const input = startTags(html, "input")[0] ?? "";
    const label = startTags(html, "label")[0] ?? "";

    expect(attribute(label, "for")).toBe("email");
    expect(attribute(input, "id")).toBe("email");
    expect(attribute(input, "aria-describedby")).toBe("email-hint email-error");
    expect(attribute(input, "aria-invalid")).toBe("true");
  });

  it("announces the error", () => {
    const html = renderWithIntl(emailField);
    const error = startTagOf(html, "email-error");

    expect(error).toMatch(/^<p /);
    expect(attribute(error, "role")).toBe("alert");
    expect(html).toContain("Enter a valid email address");
  });

  it("shows the hint without announcing it", () => {
    const html = renderWithIntl(emailField);
    const hint = startTagOf(html, "email-hint");

    expect(hint).toMatch(/^<p /);
    expect(attribute(hint, "role")).toBeUndefined();
    expect(html).toContain("We never share it");
  });

  it("writes the error in the danger text color, never in the destructive one", () => {
    const html = renderWithIntl(emailField);
    const error = classesOf(startTagOf(html, "email-error"));

    expect(error).toContain("text-danger-text");
    expect(error).not.toContain("text-destructive");
    expect(classesOf(startTagOf(html, "email-hint"))).toContain(
      "text-ink-muted",
    );
  });

  it("describes the control by the hint alone, and flags nothing, when there is no error", () => {
    const html = renderWithIntl(
      <Field label="Email" htmlFor="email" hint="We never share it">
        <Input />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "aria-describedby")).toBe("email-hint");
    expect(attribute(input, "aria-invalid")).toBeUndefined();
    expect(html).not.toContain("role=");
  });

  it("describes the control by the error alone when there is no hint", () => {
    const html = renderWithIntl(
      <Field label="Email" htmlFor="email" error="Required">
        <Input />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "aria-describedby")).toBe("email-error");
    expect(attribute(input, "aria-invalid")).toBe("true");
    expect(html).not.toContain("email-hint");
  });

  it("leaves the control alone when there is neither a hint nor an error", () => {
    const html = renderWithIntl(
      <Field label="Email" htmlFor="email">
        <Input />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "id")).toBe("email");
    expect(attribute(input, "aria-describedby")).toBeUndefined();
    expect(attribute(input, "aria-invalid")).toBeUndefined();
    expect(attribute(input, "aria-required")).toBeUndefined();
  });

  it("keeps the description and the invalid flag the control already had", () => {
    const html = renderWithIntl(
      <Field label="Email" htmlFor="email" hint="We never share it">
        <Input aria-describedby="note" aria-invalid />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "aria-describedby")).toBe("note email-hint");
    expect(attribute(input, "aria-invalid")).toBe("true");
  });

  it("marks a required field with a hidden asterisk, and tells assistive technology on the control", () => {
    const html = renderWithIntl(
      <Field label="Email" htmlFor="email" required>
        <Input />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(html).toMatch(/<span[^>]* aria-hidden="true"[^>]*>\*<\/span>/);
    expect(attribute(input, "aria-required")).toBe("true");
  });

  it("shows no asterisk on an optional field", () => {
    const html = renderWithIntl(
      <Field label="Email" htmlFor="email">
        <Input />
      </Field>,
    );

    expect(html).not.toMatch(/>\*</);
  });

  it("sits the label above the control, and the hint and the error after it", () => {
    const html = renderWithIntl(emailField);

    expect(html.indexOf("<label")).toBeLessThan(html.indexOf("<input"));
    expect(html.indexOf("<input")).toBeLessThan(
      html.indexOf('id="email-hint"'),
    );
    expect(html.indexOf('id="email-hint"')).toBeLessThan(
      html.indexOf('id="email-error"'),
    );
  });

  it("wires a textarea the same way", () => {
    const html = renderWithIntl(
      <Field label="Bio" htmlFor="bio" error="Too long">
        <Textarea />
      </Field>,
    );
    const textarea = startTags(html, "textarea")[0] ?? "";

    expect(attribute(textarea, "id")).toBe("bio");
    expect(attribute(textarea, "aria-describedby")).toBe("bio-error");
    expect(attribute(textarea, "aria-invalid")).toBe("true");
  });

  it("leaves alone what the control sets for itself, when the field has nothing to say about it", () => {
    const html = renderWithIntl(
      <Field label="Name" htmlFor="name">
        <SelfDescribed />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "id")).toBe("name");
    expect(attribute(input, "aria-required")).toBe("true");
    expect(attribute(input, "aria-invalid")).toBe("true");
    expect(attribute(input, "aria-describedby")).toBe("own-note");
  });

  it("keeps the aria-required of a required Select inside a field that is not required", () => {
    const html = renderWithIntl(
      <Field label="Role" htmlFor="role">
        <RequiredRoleSelect />
      </Field>,
    );
    const trigger =
      startTags(html, "button").find((tag) =>
        tag.includes('role="combobox"'),
      ) ?? "";

    expect(attribute(trigger, "id")).toBe("role");
    expect(attribute(trigger, "aria-required")).toBe("true");
  });

  it("still adds its own on top of a description the control is given: the hint, the error and the required mark", () => {
    const html = renderWithIntl(
      <Field
        label="Name"
        htmlFor="name"
        hint="Shown on your card"
        error="Required"
        required
      >
        <SelfDescribed aria-describedby="own-note" />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "aria-describedby")).toBe(
      "own-note name-hint name-error",
    );
    expect(attribute(input, "aria-invalid")).toBe("true");
    expect(attribute(input, "aria-required")).toBe("true");
  });

  it.each([
    ["a string", "plain text"],
    ["false", false],
  ] as const)("renders %s as its child without throwing", (_name, child) => {
    const html = renderWithIntl(
      <Field label="Name" htmlFor="name" hint="A hint">
        {child as unknown as ComponentProps<typeof Field>["children"]}
      </Field>,
    );

    expect(attribute(startTags(html, "label")[0] ?? "", "for")).toBe("name");
    expect(html).toContain("A hint");
    if (typeof child === "string") {
      expect(html).toContain(child);
    }
  });

  it("lets the label wrap, so a long one is never cut", () => {
    const html = renderWithIntl(
      <Field label="Adresse e-mail professionnelle" htmlFor="email">
        <Input />
      </Field>,
    );
    const label = classesOf(startTags(html, "label")[0] ?? "");

    expect(label).toContain("block");
    expect(label).not.toContain("leading-none");
  });
});

describe("segmented control", () => {
  const OPTIONS = [
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly", badge: "2 months free" },
  ];
  const control = (value: string, extra: { disabled?: boolean } = {}) => (
    <SegmentedControl
      label="Billing period"
      options={OPTIONS}
      value={value}
      onValueChange={noop}
      {...extra}
    />
  );

  it("names the group with a legend only screen readers see", () => {
    const html = renderWithIntl(control("year"));

    expect(html).toMatch(/^<fieldset /);
    expect(html).toContain('<legend class="sr-only">Billing period</legend>');
  });

  it("presses only the segment of the current value", () => {
    const html = renderWithIntl(control("year"));
    const [monthly = "", yearly = ""] = html.split("<button").slice(1);

    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(monthly).toContain('aria-pressed="false"');
    expect(monthly).toContain("Monthly");
    expect(yearly).toContain('aria-pressed="true"');
    expect(yearly).toContain("Yearly");
  });

  it("moves the press with the value", () => {
    const buttons = startTags(renderWithIntl(control("month")), "button");

    expect(buttons[0]).toContain('aria-pressed="true"');
    expect(buttons[1]).toContain('aria-pressed="false"');
  });

  it("makes each segment a button that submits nothing", () => {
    const buttons = startTags(renderWithIntl(control("year")), "button");

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(attribute(button, "type")).toBe("button");
    }
  });

  it("reads the badge after the label, behind a separator that is not announced", () => {
    const html = renderWithIntl(control("year"));
    const yearly = html.slice(html.indexOf("Yearly"));

    expect(html.match(/2 months free/g)).toHaveLength(1);
    expect(yearly).toMatch(
      /Yearly[\s\S]*<span[^>]* aria-hidden="true"[^>]*>·<\/span>[\s\S]*2 months free/,
    );
    expect(html.indexOf("Monthly")).toBeLessThan(html.indexOf("Yearly"));
  });

  it("makes every segment a stop of the Tab key: none is taken out of the tab order", () => {
    const html = renderWithIntl(control("year"));
    const buttons = startTags(html, "button");

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(attribute(button, "tabindex")).toBeUndefined();
    }
    expect(html).not.toContain('tabindex="-1"');
  });

  it("gives each segment a 44 px target and the focus ring", () => {
    const buttons = startTags(renderWithIntl(control("year")), "button");

    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(classesOf(button)).toContain("tap-target");
      expect(classesOf(button)).toContain("focus-visible:focus-ring");
    }
  });

  it("draws a track, and a raised surface under the pressed segment", () => {
    const html = renderWithIntl(control("year"));
    const button = classesOf(startTags(html, "button")[0] ?? "");

    expect(classesOf(startTags(html, "fieldset")[0] ?? "")).toContain(
      "bg-track",
    );
    expect(button).toContain("aria-pressed:bg-surface");
    expect(button).toContain("aria-pressed:shadow-card");
  });

  it("keeps the focus ring on the pressed segment, as its raised surface is a shadow too", () => {
    const button = classesOf(
      startTags(renderWithIntl(control("year")), "button")[1] ?? "",
    );

    expect(button).toContain("aria-pressed:shadow-card");
    expect(button).toContain("aria-pressed:focus-visible:focus-ring");
  });

  it("outlines the pressed segment, as the surface alone is 1.1:1 against the track", () => {
    const button = classesOf(
      startTags(renderWithIntl(control("year")), "button")[0] ?? "",
    );

    expect(button).toContain("border");
    expect(button).toContain("border-transparent");
    expect(button).toContain("aria-pressed:border-input");
  });

  it("lets a long label wrap inside its segment instead of overflowing", () => {
    const button = classesOf(
      startTags(renderWithIntl(control("year")), "button")[0] ?? "",
    );

    expect(button).toContain("whitespace-normal");
    expect(button).toContain("min-w-0");
    expect(
      classesOf(
        startTags(renderWithIntl(control("year")), "fieldset")[0] ?? "",
      ),
    ).toContain("max-w-full");
  });

  it("disables every segment with the group", () => {
    const fieldset = startTags(
      renderWithIntl(control("year", { disabled: true })),
      "fieldset",
    )[0];

    expect(fieldset).toContain('disabled=""');
    expect(
      startTags(renderWithIntl(control("year")), "fieldset")[0],
    ).not.toContain('disabled=""');
  });
});

describe("nextSegment", () => {
  it("moves right, and back to the start after the last segment", () => {
    expect(nextSegment(0, "ArrowRight", 3)).toBe(1);
    expect(nextSegment(2, "ArrowRight", 3)).toBe(0);
  });

  it("moves left, and on to the last segment before the first", () => {
    expect(nextSegment(2, "ArrowLeft", 3)).toBe(1);
    expect(nextSegment(0, "ArrowLeft", 3)).toBe(2);
  });

  it("jumps to the first segment with Home and to the last with End", () => {
    expect(nextSegment(1, "Home", 3)).toBe(0);
    expect(nextSegment(1, "End", 3)).toBe(2);
  });

  it("stays where it is for any other key", () => {
    for (const key of ["a", "Enter", " ", "Tab", "ArrowUp", "ArrowDown"]) {
      expect(nextSegment(1, key, 3)).toBe(1);
    }
  });

  it("stays on the only segment of a one-segment control", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(nextSegment(0, key, 1)).toBe(0);
    }
  });
});

describe("option cards", () => {
  const PLANS = [
    { value: "free", label: "Free", description: "For trying things out" },
    {
      value: "pro",
      label: "Pro",
      description: "For growing teams",
      icon: ZapIcon,
    },
    { value: "team", label: "Team" },
  ];
  const cards = (props: { label?: string; disabled?: boolean } = {}) => (
    <OptionCards
      name="plan"
      options={PLANS}
      value="pro"
      onValueChange={noop}
      {...props}
    />
  );

  it("checks only the radio of the current value", () => {
    const radios = startTags(renderWithIntl(cards()), "input");

    expect(radios).toHaveLength(3);
    expect(radios[0]).not.toContain("checked");
    expect(radios[1]).toContain('checked=""');
    expect(radios[2]).not.toContain("checked");
  });

  it("groups the radios under one name, each with its value", () => {
    const radios = startTags(renderWithIntl(cards()), "input");

    expect(radios.map((radio) => attribute(radio, "type"))).toEqual([
      "radio",
      "radio",
      "radio",
    ]);
    expect(radios.map((radio) => attribute(radio, "name"))).toEqual([
      "plan",
      "plan",
      "plan",
    ]);
    expect(radios.map((radio) => attribute(radio, "value"))).toEqual([
      "free",
      "pro",
      "team",
    ]);
  });

  it("hides the radio from sight, keeps it for the keyboard, and styles the card from it", () => {
    const radios = startTags(renderWithIntl(cards()), "input");

    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(attribute(radio, "class")).toBe("sr-only peer");
    }
  });

  it("makes each card a label around its radio, so the whole card is the target", () => {
    const html = renderWithIntl(cards());

    expect(html.match(/<label[^>]*><input type="radio"/g)).toHaveLength(3);
    expect(startTags(html, "label")).toHaveLength(3);
    for (const label of startTags(html, "label")) {
      // 44 px high at least, without the layer `tap-target` lays over a card's own text
      expect(classesOf(label)).toContain("min-h-11");
      expect(classesOf(label)).toContain("relative");
      expect(classesOf(label)).not.toContain("tap-target");
    }
  });

  it("writes the label and the description of each card", () => {
    const html = renderWithIntl(cards());

    expect(html).toContain("Free");
    expect(html).toContain("For trying things out");
    expect(html).toContain("For growing teams");
    expect(html).toContain("Team");
  });

  it("draws the icon of a card, hidden from assistive technology", () => {
    const html = renderWithIntl(cards());

    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toMatch(/<svg[^>]* aria-hidden="true"/);
  });

  it("names the group with a legend when it is given a label", () => {
    const html = renderWithIntl(cards({ label: "Plan" }));

    expect(html).toMatch(/^<fieldset /);
    expect(html).toContain('<legend class="sr-only">Plan</legend>');
    expect(renderWithIntl(cards())).not.toContain("<legend");
  });

  it("disables every radio with the group", () => {
    const html = renderWithIntl(cards({ disabled: true }));

    expect(startTags(html, "fieldset")[0]).toContain('disabled=""');
    expect(startTags(renderWithIntl(cards()), "fieldset")[0]).not.toContain(
      'disabled=""',
    );
  });
});

describe("input", () => {
  it.each([
    ["sm", "h-9"],
    ["default", "h-10"],
    ["lg", "h-12"],
  ] as const)("sizes %s as %s", (size, expected) => {
    expect(tokens(inputVariants({ size }))).toContain(expected);
    expect(
      classesOf(startTags(renderWithIntl(<Input size={size} />), "input")[0]),
    ).toContain(expected);
  });

  it("is 40 px high by default", () => {
    expect(tokens(inputVariants())).toContain("h-10");
    expect(
      classesOf(startTags(renderWithIntl(<Input />), "input")[0] ?? ""),
    ).toContain("h-10");
  });

  it("is a bordered field on the surface", () => {
    const classes = tokens(inputVariants());

    expect(classes).toContain("rounded-md");
    expect(classes).toContain("border");
    expect(classes).toContain("border-input");
    expect(classes).toContain("bg-surface");
  });

  it("keeps the markup it always had", () => {
    const html = renderWithIntl(
      <Input type="email" placeholder="you@example.com" disabled readOnly />,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "type")).toBe("email");
    expect(attribute(input, "placeholder")).toBe("you@example.com");
    expect(attribute(input, "data-slot")).toBe("input");
    expect(input).toContain('disabled=""');
    expect(input).toContain('readOnly=""');
  });

  it("rings in danger when invalid, and draws the border with it", () => {
    const classes = tokens(inputVariants());

    expect(classes).toContain("aria-invalid:border-danger");
    // `focus-ring` reads --focus-ring: the ring keeps its geometry and turns danger.
    expect(classes).toContain("aria-invalid:[--focus-ring:var(--danger)]");
    expect(classes).not.toContain("aria-invalid:border-destructive");
  });

  it("shows the focus ring of the system on keyboard and pointer focus", () => {
    const classes = tokens(inputVariants());

    expect(classes).toContain("focus-visible:focus-ring");
    expect(classes).toContain("focus-visible:border-ring");
  });

  it("keeps 16 px under md, as a smaller size makes iOS zoom the page", () => {
    for (const size of ["sm", "default", "lg"] as const) {
      expect(tokens(inputVariants({ size }))).toContain("text-base");
    }
    expect(tokens(inputVariants({ size: "default" }))).toContain(
      "md:text-body",
    );
    expect(tokens(inputVariants({ size: "sm" }))).toContain("md:text-meta");
  });

  it("lets a caller's class win over the size", () => {
    const classes = classesOf(
      startTags(renderWithIntl(<Input className="h-8 w-48" />), "input")[0] ??
        "",
    );

    expect(classes).toContain("h-8");
    expect(classes).not.toContain("h-10");
    expect(classes).toContain("w-48");
  });
});

describe("textarea", () => {
  it.each([
    ["sm", "min-h-14"],
    ["default", "min-h-16"],
    ["lg", "min-h-24"],
  ] as const)("sizes %s from %s", (size, expected) => {
    expect(tokens(textareaVariants({ size }))).toContain(expected);
    expect(
      classesOf(
        startTags(renderWithIntl(<Textarea size={size} />), "textarea")[0],
      ),
    ).toContain(expected);
  });

  it("is a bordered field on the surface", () => {
    const classes = tokens(textareaVariants());

    expect(classes).toContain("rounded-md");
    expect(classes).toContain("border");
    expect(classes).toContain("border-input");
    expect(classes).toContain("bg-surface");
  });

  it("rings in danger when invalid, and shows the focus ring of the system", () => {
    const classes = tokens(textareaVariants());

    expect(classes).toContain("aria-invalid:border-danger");
    expect(classes).toContain("aria-invalid:[--focus-ring:var(--danger)]");
    expect(classes).toContain("focus-visible:focus-ring");
    expect(classes).not.toContain("aria-invalid:border-destructive");
  });

  it("keeps the markup it always had", () => {
    const html = renderWithIntl(
      <Textarea rows={4} placeholder="Tell us more" disabled />,
    );
    const textarea = startTags(html, "textarea")[0] ?? "";

    expect(attribute(textarea, "rows")).toBe("4");
    expect(attribute(textarea, "data-slot")).toBe("textarea");
    expect(textarea).toContain('disabled=""');
  });

  it("keeps 16 px under md", () => {
    for (const size of ["sm", "default", "lg"] as const) {
      expect(tokens(textareaVariants({ size }))).toContain("text-base");
    }
  });
});

describe("select", () => {
  const trigger = (props: Parameters<typeof SelectTrigger>[0] = {}) =>
    renderWithIntl(
      <Select>
        <SelectTrigger {...props}>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
      </Select>,
    );
  const triggerClasses = (props: Parameters<typeof SelectTrigger>[0] = {}) =>
    classesOf(
      startTags(trigger(props), "button").find((tag) =>
        tag.includes('data-slot="select-trigger"'),
      ) ?? "",
    );

  it.each([
    ["sm", "h-9"],
    ["default", "h-10"],
    ["lg", "h-12"],
  ] as const)("sizes the trigger %s as %s", (size, expected) => {
    expect(triggerClasses({ size })).toContain(expected);
  });

  it("is 40 px high by default, as an input is", () => {
    expect(triggerClasses()).toContain("h-10");
  });

  it("looks like an input: bordered, on the surface, rounded as a field", () => {
    const classes = triggerClasses();

    expect(classes).toContain("rounded-md");
    expect(classes).toContain("border-input");
    expect(classes).toContain("bg-surface");
  });

  it("rings in danger when invalid, and shows the focus ring of the system", () => {
    const classes = triggerClasses();

    expect(classes).toContain("aria-invalid:border-danger");
    expect(classes).toContain("aria-invalid:[--focus-ring:var(--danger)]");
    expect(classes).toContain("focus-visible:focus-ring");
  });

  it("gives the trigger a 44 px target", () => {
    expect(triggerClasses()).toContain("tap-target");
  });

  it("keeps the markup it always had", () => {
    const html = trigger({ id: "role", "aria-invalid": true });
    const button = startTags(html, "button")[0] ?? "";

    expect(attribute(button, "role")).toBe("combobox");
    expect(attribute(button, "id")).toBe("role");
    expect(attribute(button, "aria-invalid")).toBe("true");
    expect(html).toContain("Pick one");
  });

  it("keeps the chevron readable: muted, not half transparent", () => {
    const chevron = classesOf(startTags(trigger(), "svg")[0] ?? "");

    expect(chevron).toContain("size-4");
    expect(chevron).not.toContain("opacity-50");
  });
});

describe("checkbox", () => {
  const classes = (props: Parameters<typeof Checkbox>[0] = {}) =>
    classesOf(startTags(renderWithIntl(<Checkbox {...props} />), "button")[0]);

  it("gives the box a 44 px target and the focus ring of the system", () => {
    expect(classes()).toContain("tap-target");
    expect(classes()).toContain("focus-visible:focus-ring");
  });

  it("draws a 20 px bordered box on the surface", () => {
    expect(classes()).toContain("size-5");
    expect(classes()).toContain("border-input");
    expect(classes()).toContain("bg-surface");
  });

  it("fills with the primary color when checked or mixed", () => {
    for (const state of ["checked", "indeterminate"]) {
      expect(classes()).toContain(`data-[state=${state}]:bg-primary`);
      expect(classes()).toContain(`data-[state=${state}]:border-primary`);
    }
    expect(classes()).toContain("text-primary-foreground");
  });

  it("rings in danger when invalid", () => {
    expect(classes()).toContain("aria-invalid:border-danger");
    expect(classes()).toContain("aria-invalid:[--focus-ring:var(--danger)]");
  });

  it("keeps the invalid cue when checked or mixed: danger wins over the primary border", () => {
    for (const state of ["checked", "indeterminate"]) {
      expect(classes()).toContain(
        `aria-invalid:data-[state=${state}]:border-danger`,
      );
    }
  });

  it("keeps the markup it always had", () => {
    const html = renderWithIntl(<Checkbox checked disabled />);
    const button = startTags(html, "button")[0] ?? "";

    expect(attribute(button, "role")).toBe("checkbox");
    expect(attribute(button, "aria-checked")).toBe("true");
    expect(attribute(button, "data-slot")).toBe("checkbox");
    expect(button).toContain('disabled=""');
  });

  it("draws a glyph when checked or mixed, and none when unchecked", () => {
    expect(renderWithIntl(<Checkbox checked />)).toContain("<svg");
    expect(renderWithIntl(<Checkbox checked="indeterminate" />)).toContain(
      "<svg",
    );
    expect(renderWithIntl(<Checkbox />)).not.toContain("<svg");
  });

  it("tells assistive technology it is mixed", () => {
    const button = startTags(
      renderWithIntl(<Checkbox checked="indeterminate" />),
      "button",
    )[0];

    expect(attribute(button ?? "", "aria-checked")).toBe("mixed");
  });
});

describe("switch", () => {
  const classes = (props: Parameters<typeof Switch>[0] = {}) =>
    classesOf(startTags(renderWithIntl(<Switch {...props} />), "button")[0]);

  it("gives the track a 44 px target and the focus ring of the system", () => {
    expect(classes()).toContain("tap-target");
    expect(classes()).toContain("focus-visible:focus-ring");
  });

  it("is a 44 by 24 px track", () => {
    expect(classes()).toContain("h-6");
    expect(classes()).toContain("w-11");
  });

  it("fills with the primary color when on, and with the control border color when off", () => {
    expect(classes()).toContain("data-[state=checked]:bg-primary");
    expect(classes()).toContain("data-[state=unchecked]:bg-input");
  });

  it("keeps the off track at full strength: a 3:1 control is not made lighter", () => {
    expect(classes().filter((name) => /bg-input\/\d+/.test(name))).toEqual([]);
  });

  it("slides a surface-colored thumb", () => {
    const html = renderWithIntl(<Switch checked />);
    const thumb = classesOf(
      startTags(html, "span").find((tag) =>
        tag.includes('data-slot="switch-thumb"'),
      ) ?? "",
    );

    expect(thumb).toContain("bg-surface");
    expect(thumb).toContain("data-[state=checked]:translate-x-5");
  });

  it("keeps the markup it always had", () => {
    const html = renderWithIntl(<Switch checked disabled />);
    const button = startTags(html, "button")[0] ?? "";

    expect(attribute(button, "role")).toBe("switch");
    expect(attribute(button, "aria-checked")).toBe("true");
    expect(attribute(button, "data-slot")).toBe("switch");
    expect(button).toContain('disabled=""');
  });
});

describe("password input", () => {
  const field = (props: Parameters<typeof PasswordInput>[0] = {}) =>
    startTags(renderWithIntl(<PasswordInput {...props} />), "input")[0] ?? "";
  const toggle = (props: Parameters<typeof PasswordInput>[0] = {}) =>
    startTags(renderWithIntl(<PasswordInput {...props} />), "button")[0] ?? "";
  // The default Input, as a password field.
  const inputClasses = classesOf(
    startTags(renderWithIntl(<Input type="password" />), "input")[0] ?? "",
  );

  it("is a password field that keeps its markup", () => {
    const input = field({ placeholder: "Your password", disabled: true });

    expect(attribute(input, "type")).toBe("password");
    expect(attribute(input, "data-slot")).toBe("input");
    expect(attribute(input, "placeholder")).toBe("Your password");
    expect(input).toContain('disabled=""');
  });

  it("carries the classes of an Input at its default size, and only adds room for the toggle", () => {
    const classes = classesOf(field());

    expect(classes).toEqual(expect.arrayContaining(inputClasses));
    expect(classes.filter((name) => !inputClasses.includes(name))).toEqual([
      "pr-9",
    ]);
  });

  it("is 40 px high, with the border, the radius and the surface of a field", () => {
    const classes = classesOf(field());

    expect(classes).toContain("h-10");
    expect(classes).toContain("rounded-md");
    expect(classes).toContain("border-input");
    expect(classes).toContain("bg-surface");
  });

  it("rings in danger when invalid, and shows the focus ring of the system", () => {
    const classes = classesOf(field());

    expect(classes).toContain("aria-invalid:border-danger");
    expect(classes).toContain("aria-invalid:[--focus-ring:var(--danger)]");
    expect(classes).toContain("focus-visible:focus-ring");
    expect(classes).not.toContain("aria-invalid:border-destructive");
  });

  it("has dropped the old look: 36 px, transparent, shadow and a 20 % ring", () => {
    const classes = classesOf(field());

    for (const old of [
      "h-9",
      "bg-transparent",
      "shadow-xs",
      "focus-visible:ring-[3px]",
      "focus-visible:ring-ring/20",
      "aria-invalid:ring-destructive/20",
    ]) {
      expect(classes).not.toContain(old);
    }
  });

  it("lets a caller's class win over the size", () => {
    const classes = classesOf(field({ className: "h-8" }));

    expect(classes).toContain("h-8");
    expect(classes).not.toContain("h-10");
  });

  it("is wired by a Field like any other control", () => {
    const html = renderWithIntl(
      <Field label="Password" htmlFor="password" error="Too short" required>
        <PasswordInput />
      </Field>,
    );
    const input = startTags(html, "input")[0] ?? "";

    expect(attribute(input, "id")).toBe("password");
    expect(attribute(input, "aria-describedby")).toBe("password-error");
    expect(attribute(input, "aria-invalid")).toBe("true");
    expect(attribute(input, "aria-required")).toBe("true");
  });

  it("keeps a real button for the toggle, named, with a 44 px target", () => {
    const html = renderWithIntl(<PasswordInput />);
    const button = toggle();

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(attribute(button, "type")).toBe("button");
    expect(attribute(button, "aria-label")).toBe("Show password");
    expect(classesOf(button)).toContain("tap-target");
  });

  it("keeps the toggle at the right of the field, centered", () => {
    const classes = classesOf(toggle());

    for (const name of ["absolute", "right-2", "top-1/2", "-translate-y-1/2"]) {
      expect(classes).toContain(name);
    }
  });

  it("gives the toggle a 24 px box of its own, centering the 16 px icon", () => {
    const classes = classesOf(toggle());

    // WCAG 2.5.8: the 44 px layer of `tap-target` is not part of the element's box
    // (axe measures the box), and the field behind it is a target too.
    expect(classes).toContain("size-6");
    expect(classes).toContain("grid");
    expect(classes).toContain("place-items-center");
    expect(
      startTags(renderWithIntl(<PasswordInput />), "svg").map((svg) =>
        classesOf(svg),
      )[0],
    ).toContain("size-4");
  });

  it("disables the toggle with the field, and dims it with it", () => {
    const disabled = toggle({ disabled: true });
    const classes = classesOf(disabled);

    expect(disabled).toContain('disabled=""');
    expect(classes).toContain("disabled:opacity-50");
    expect(classes).toContain("disabled:cursor-not-allowed");
    // no hover color on a toggle that does nothing
    expect(classes).toContain("enabled:hover:text-foreground");
    expect(classes).not.toContain("hover:text-foreground");
  });

  it("leaves the toggle live on a field that is enabled or read-only", () => {
    expect(toggle()).not.toContain('disabled=""');
    expect(toggle({ readOnly: true })).not.toContain('disabled=""');
  });

  it("makes the toggle a stop of the Tab key: it has no tabindex of its own", () => {
    expect(attribute(toggle(), "tabindex")).toBeUndefined();
  });

  it("gives the toggle the focus ring of the system, rounded around the icon", () => {
    const classes = classesOf(toggle());

    expect(classes).toContain("focus-visible:focus-ring");
    expect(classes).toContain("rounded-xs");
  });

  it.each([
    ["en", "Show password"],
    ["fr", "Afficher le mot de passe"],
  ] as const)(
    "names the toggle in the language of the page (%s)",
    (locale, expected) => {
      const button =
        startTags(renderWithIntl(<PasswordInput />, locale), "button")[0] ?? "";

      expect(attribute(button, "aria-label")).toBe(expected);
    },
  );

  it("has the label of each state, in both languages", () => {
    expect([en.common.showPassword, en.common.hidePassword]).toEqual([
      "Show password",
      "Hide password",
    ]);
    expect([fr.common.showPassword, fr.common.hidePassword]).toEqual([
      "Afficher le mot de passe",
      "Masquer le mot de passe",
    ]);
  });
});

describe("form controls", () => {
  const LOOKS: Record<string, () => string[]> = {
    input: () => tokens(inputVariants()),
    textarea: () => tokens(textareaVariants()),
    "password input": () =>
      classesOf(startTags(renderWithIntl(<PasswordInput />), "input")[0] ?? ""),
    "select trigger": () =>
      classesOf(
        startTags(
          renderWithIntl(
            <Select>
              <SelectTrigger />
            </Select>,
          ),
          "button",
        ).find((tag) => tag.includes('data-slot="select-trigger"')) ?? "",
      ),
  };

  it.each(Object.keys(LOOKS))("share the same look in the %s", (name) => {
    const classes = LOOKS[name]?.() ?? [];

    for (const expected of [
      "rounded-md",
      "border-input",
      "bg-surface",
      "focus-visible:focus-ring",
      "aria-invalid:border-danger",
      "aria-invalid:[--focus-ring:var(--danger)]",
      "disabled:cursor-not-allowed",
      "disabled:opacity-50",
    ]) {
      expect(classes).toContain(expected);
    }
  });

  const FILES = [
    "input",
    "textarea",
    "select",
    "checkbox",
    "switch",
    "field",
    "segmented-control",
    "option-cards",
    "password-input",
  ];

  it.each(FILES)(
    "%s.tsx uses the theme tokens: no raw palette color, white, black or hex",
    (name) => {
      const source = readFileSync(resolve(uiDir, `${name}.tsx`), "utf-8");

      expect(source).not.toMatch(
        /\b(?:bg|text|border|ring|fill|stroke|from|to|shadow|outline|decoration|divide|accent|caret)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/,
      );
      expect(source).not.toMatch(/#[\da-f]{3,8}\b/i);
      expect(source).not.toMatch(/\brgba?\(/);
    },
  );

  it.each(FILES)("%s.tsx never uses the destructive text color", (name) => {
    const source = readFileSync(resolve(uiDir, `${name}.tsx`), "utf-8");

    expect(source).not.toMatch(/\btext-destructive\b/);
  });

  it.each(["segmented-control", "option-cards", "field"])(
    "%s.tsx puts no role or click handler on a div",
    (name) => {
      const source = readFileSync(resolve(uiDir, `${name}.tsx`), "utf-8");

      expect(source).not.toMatch(/<div\b[^>]*\srole=/);
      expect(source).not.toMatch(/<div\b[^>]*\sonClick=/);
    },
  );
});

// theme-contrast.test.ts measures the tokens a theme provides; these are the
// pairs the form controls put together.
describe.each([
  ["light", light],
  ["dark", { ...light, ...darkOverrides }],
])("%s theme, form controls", (_mode, vars) => {
  const all = { ...vars, ...inline };
  const ratio = (fg: string, bg: string) =>
    contrastRatio(`var(--${fg})`, `var(--${bg})`, all);

  it.each([
    // placeholder and hint, the inactive segment, the description of a selected card
    ["ink-muted", "surface"],
    ["ink-muted", "track"],
    ["ink-muted", "brand-tint"],
    ["ink", "track"],
    ["ink", "brand-tint"],
    // the error text, on a card and on the page
    ["danger-text", "surface"],
    ["danger-text", "surface-sunken"],
  ])("reads %s on %s at 4.5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    // the border of a field, of a box, of an off switch, of the pressed segment
    ["control-border", "surface"],
    ["control-border", "surface-sunken"],
    ["control-border", "track"],
    // an invalid border and its ring, on a card and on the page
    ["danger", "surface"],
    ["danger", "surface-sunken"],
    // the thumb on an off track, and on an on track
    ["surface", "control-border"],
    ["surface", "brand"],
    // the border of the selected card, against its tint
    ["brand", "brand-tint"],
  ])("tells %s from %s at 3:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});
