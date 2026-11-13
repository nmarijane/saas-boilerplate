import { describe, expect, it, vi } from "vitest";
import { CopyCode } from "@/shared/components/ui/copy-code";
import { copyText } from "@/shared/utils/clipboard";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

describe("copyText", () => {
  it("puts the text on the clipboard it is given, and says it got there", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyText("sk_live_abc", { writeText })).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledExactlyOnceWith("sk_live_abc");
  });

  it("says it did not, and does not throw, when the browser refuses", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    await expect(copyText("sk_live_abc", { writeText })).resolves.toBe(false);
  });

  it("says it did not when there is no clipboard to put it on: a page that is not in a secure context has none", async () => {
    await expect(copyText("sk_live_abc", undefined)).resolves.toBe(false);
  });
});

describe("the box that copies a text", () => {
  const render = (props: { value?: string; autoFocus?: boolean } = {}, locale: "en" | "fr" = "en") =>
    renderWithIntl(<CopyCode value={props.value ?? "sk_live_AbCdEf123"} autoFocus={props.autoFocus} />, locale);

  it("shows the text in mono, in a box that breaks a long text anywhere and selects it whole when it is clicked", () => {
    const html = render({ value: "sk_live_".padEnd(80, "x") });
    const [code = ""] = startTags(html, "code");

    expect(textOf(elements(html, "code")[0] ?? "")).toBe("sk_live_".padEnd(80, "x"));
    expect(decodedClassesOf(code)).toEqual(expect.arrayContaining(["font-mono", "break-all", "select-all"]));
  });

  it("has one button that copies, 44 px high, an outline: the main button of the dialog it is in is another", () => {
    const html = render();
    const [button = ""] = startTags(html, "button");

    expect(elements(html, "button").map(textOf)).toEqual(["Copy"]);
    expect(attribute(button, "type")).toBe("button");
    expect(decodedClassesOf(button)).toEqual(expect.arrayContaining(["tap-target", "border-input"]));
    expect(decodedClassesOf(button)).not.toContain("bg-primary");
  });

  it("draws its icon as decoration: the word says what the button does", () => {
    const [button = ""] = elements(render(), "button");

    expect(button).toContain('aria-hidden="true"');
    expect(textOf(button)).toBe("Copy");
  });

  it("has a status region in the page before anything is said, so that Copied is heard when it comes", () => {
    const html = render();
    const [status = ""] = startTags(html, "span").filter((tag) => attribute(tag, "role") === "status");

    expect(status).not.toBe("");
    expect(decodedClassesOf(status)).toContain("sr-only");
    expect(textOf(elements(html, "span").find((span) => span.includes('role="status"')) ?? "")).toBe("");
  });

  it("tells no failure at rest", () => {
    expect(render()).not.toContain('role="alert"');
  });

  it("speaks French", () => {
    expect(elements(render({}, "fr"), "button").map(textOf)).toEqual(["Copier"]);
  });
});
