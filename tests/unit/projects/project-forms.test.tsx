import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteProject } from "@/features/projects/actions";
import { CreateProjectFormView } from "@/features/projects/components/create-project-dialog";
import { DeleteProjectZone } from "@/features/projects/components/delete-project-zone";
import { NewProjectButton } from "@/features/projects/components/new-project-button";
import { ProjectFields } from "@/features/projects/components/project-fields";
import { ProjectSettingsFormView } from "@/features/projects/components/project-settings-form";
import { ProjectsEmpty } from "@/features/projects/components/projects-empty";
import { PROJECT_DESCRIPTION_MAX, PROJECT_NAME_MAX } from "@/features/projects/schemas";
import { Dialog } from "@/shared/components/ui/dialog";
import { toast } from "@/shared/components/ui/sonner";
import {
  attribute,
  decodedClassesOf,
  elements,
  startTags,
  tagSaying,
  textOf,
} from "../../helpers/html";
import { renderWithIntl } from "../../helpers/intl";

// What the forms reach for outside themselves, replaced: the navigation of
// next-intl (no Next router runs in a test), the toasts, the server actions, and
// the confirm dialog, whose props are what the zone of deletion decides.
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const confirm = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));

vi.mock("@/shared/lib/i18n-navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/projects",
}));
vi.mock("@/shared/components/ui/sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/sonner")>()),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/features/projects/actions", () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));
vi.mock("@/shared/components/ui/confirm-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/components/ui/confirm-dialog")>()),
  ConfirmDialog: (props: Record<string, unknown>) => {
    confirm.calls.push(props);
    return null;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  confirm.calls.length = 0;
});

type Locale = "en" | "fr";

/** The submit button of a form: the one whose label holds a spinner while it works, so it is found by its type. */
function submitOf(html: string): string {
  return startTags(html, "button").find((tag) => attribute(tag, "type") === "submit") ?? "";
}

describe("the form that creates a project", () => {
  // The form lives in a dialog: its header and its Cancel button need the
  // context of one, which an open `Dialog` gives without drawing a portal.
  function renderForm(props: Partial<ComponentProps<typeof CreateProjectFormView>> = {}, locale: Locale = "en") {
    return renderWithIntl(
      <Dialog open>
        <CreateProjectFormView
          name=""
          description=""
          pending={false}
          failed={false}
          onNameChange={() => {}}
          onDescriptionChange={() => {}}
          onSubmit={() => {}}
          {...props}
        />
      </Dialog>,
      locale,
    );
  }

  it("asks for a name of 80 characters at most and a description of 280 at most, as the server accepts", () => {
    const html = renderForm();

    // (React writes these attributes as the DOM names them: maxLength)
    expect(attribute(startTags(html, "input")[0] ?? "", "maxLength")).toBe(String(PROJECT_NAME_MAX));
    expect(attribute(startTags(html, "textarea")[0] ?? "", "maxLength")).toBe(String(PROJECT_DESCRIPTION_MAX));
    expect([PROJECT_NAME_MAX, PROJECT_DESCRIPTION_MAX]).toEqual([80, 280]);
  });

  it("labels both fields, and marks the name as required for assistive technology", () => {
    const html = renderForm();
    const [name = ""] = startTags(html, "input");
    const [description = ""] = startTags(html, "textarea");

    expect(textOf(elements(html, "label")[0] ?? "")).toBe("Name*");
    expect(textOf(elements(html, "label")[1] ?? "")).toBe("Description");
    expect(html).toContain(`for="${attribute(name, "id")}"`);
    expect(html).toContain(`for="${attribute(description, "id")}"`);
    expect(attribute(name, "aria-required")).toBe("true");
    expect(attribute(description, "aria-required")).toBeUndefined();
    expect(textOf(html)).toContain("Optional. 280 characters at most.");
  });

  it("is a form whose button submits it, and whose Cancel does not", () => {
    const html = renderForm({ name: "Atlas" });

    expect(startTags(html, "form")).toHaveLength(1);
    expect(attribute(submitOf(html), "type")).toBe("submit");
    expect(attribute(tagSaying(html, "button", "Cancel"), "type")).toBe("button");
  });

  it("waits for a name: Create is disabled while the field is empty or holds only spaces", () => {
    expect(attribute(submitOf(renderForm({ name: "" })), "disabled")).toBe("");
    expect(attribute(submitOf(renderForm({ name: "   " })), "disabled")).toBe("");
    expect(attribute(submitOf(renderForm({ name: "Atlas" })), "disabled")).toBeUndefined();
  });

  it("shows no alert at rest", () => {
    expect(renderForm({ name: "Atlas" })).not.toContain('role="alert"');
  });

  it("shows the error in the dialog as an alert, and keeps what was typed", () => {
    const html = renderForm({ name: "Atlas", description: "The first one", failed: true });

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("We couldn't create the project. Please try again.");
    expect(attribute(startTags(html, "input")[0] ?? "", "value")).toBe("Atlas");
    expect(html).toContain(">The first one</textarea>");
  });

  it("holds the fields read-only, not disabled, while it sends: a disabled field would drop the focus", () => {
    const html = renderForm({ name: "Atlas", pending: true });
    const [name = ""] = startTags(html, "input");
    const [description = ""] = startTags(html, "textarea");
    const create = submitOf(html);

    expect(attribute(name, "readOnly")).toBe("");
    expect(attribute(description, "readOnly")).toBe("");
    expect(attribute(name, "disabled")).toBeUndefined();
    // Create keeps the focus and says it works (loading): it is not disabled. Cancel is held.
    expect(attribute(create, "aria-disabled")).toBe("true");
    expect(attribute(create, "data-loading")).toBe("");
    expect(attribute(create, "disabled")).toBeUndefined();
    expect(attribute(tagSaying(html, "button", "Cancel"), "disabled")).toBe("");
  });

  it("speaks French", () => {
    const html = renderForm({ name: "Atlas", failed: true }, "fr");

    expect(textOf(html)).toContain("Nouveau projet");
    expect(textOf(elements(html, "label")[0] ?? "")).toBe("Nom*");
    expect(textOf(html)).toContain("Impossible de créer le projet. Veuillez réessayer.");
    expect(tagSaying(html, "button", "Annuler")).not.toBe("");
  });
});

describe("the form that saves the settings of a project", () => {
  function renderForm(props: Partial<ComponentProps<typeof ProjectSettingsFormView>> = {}, locale: Locale = "en") {
    return renderWithIntl(
      <ProjectSettingsFormView
        name="Atlas"
        description="The first one"
        status="draft"
        pending={false}
        saved={false}
        failed={false}
        onNameChange={() => {}}
        onDescriptionChange={() => {}}
        onStatusChange={() => {}}
        onSubmit={() => {}}
        {...props}
      />,
      locale,
    );
  }

  /** The segment of the status control that is pressed, and the one that is not. */
  const segments = (html: string) => elements(html, "button").filter((button) => button.includes("aria-pressed"));

  it("holds the name to 80 characters and the description to 280, as the server does", () => {
    const html = renderForm();

    expect(attribute(startTags(html, "input")[0] ?? "", "maxLength")).toBe(String(PROJECT_NAME_MAX));
    expect(attribute(startTags(html, "textarea")[0] ?? "", "maxLength")).toBe(String(PROJECT_DESCRIPTION_MAX));
  });

  it("shows the values it was given, and marks the name as required", () => {
    const html = renderForm({ name: "Atlas 2", description: "Another sentence" });
    const [name = ""] = startTags(html, "input");

    expect(attribute(name, "value")).toBe("Atlas 2");
    expect(attribute(name, "aria-required")).toBe("true");
    expect(html).toContain(">Another sentence</textarea>");
  });

  it("chooses the status among the two the server knows, the current one pressed", () => {
    const html = renderForm({ status: "active" });
    const [group = ""] = startTags(html, "fieldset");

    expect(group).toContain('data-slot="segmented-control"');
    expect(textOf(elements(html, "legend")[0] ?? "")).toBe("Status");
    expect(segments(html).map((segment) => [textOf(segment), attribute(segment, "aria-pressed")])).toEqual([
      ["Draft", "false"],
      ["Active", "true"],
    ]);
  });

  it("captions the status with the Label primitive, as the fields above it are, and hides the caption from those who hear the legend", () => {
    const html = renderForm();
    const caption = startTags(html, "span").find((tag) => attribute(tag, "data-slot") === "label") ?? "";

    expect(attribute(caption, "aria-hidden")).toBe("true");
    // The same look as the label of the name: one primitive draws both
    expect(decodedClassesOf(caption)).toEqual(decodedClassesOf(startTags(html, "label")[0] ?? ""));
    // Said once to those who hear: the legend of the group, and the caption is hidden
    expect(html.match(/>Status</g)).toHaveLength(2);
  });

  it("saves with a submit button, and says nothing of a save until there is one", () => {
    const html = renderForm();

    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Save");
    expect(html).not.toContain('data-slot="inline-status"');
    expect(html).not.toContain('role="alert"');
  });

  it("tells a save that worked, as a status next to the button", () => {
    const html = renderForm({ saved: true });
    const status = elements(html, "span").find((span) => span.includes('data-slot="inline-status"')) ?? "";

    expect(status).toContain('role="status"');
    expect(textOf(status)).toContain("Saved");
    expect(html).not.toContain('role="alert"');
  });

  it("tells a save that failed, as an alert, and keeps what was typed", () => {
    const html = renderForm({ failed: true, name: "Atlas 2" });

    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(textOf(html)).toContain("We couldn't save your changes. Please try again.");
    expect(attribute(startTags(html, "input")[0] ?? "", "value")).toBe("Atlas 2");
    expect(html).not.toContain('data-slot="inline-status"');
  });

  it("holds everything while it saves: the fields read-only, the status fixed, Save loading and not disabled", () => {
    const html = renderForm({ pending: true });
    const save = submitOf(html);

    expect(attribute(startTags(html, "input")[0] ?? "", "readOnly")).toBe("");
    expect(attribute(startTags(html, "textarea")[0] ?? "", "readOnly")).toBe("");
    expect(attribute(startTags(html, "fieldset")[0] ?? "", "disabled")).toBe("");
    expect(attribute(save, "aria-disabled")).toBe("true");
    expect(attribute(save, "data-loading")).toBe("");
    expect(attribute(save, "disabled")).toBeUndefined();
  });

  it("cannot save a name that is empty or holds only spaces", () => {
    expect(attribute(submitOf(renderForm({ name: "" })), "disabled")).toBe("");
    expect(attribute(submitOf(renderForm({ name: "  " })), "disabled")).toBe("");
    expect(attribute(submitOf(renderForm({ name: "Atlas" })), "disabled")).toBeUndefined();
  });

  it("speaks French", () => {
    const html = renderForm({ saved: true, status: "active" }, "fr");

    expect(textOf(html)).toContain("Enregistré");
    expect(segments(html).map(textOf)).toEqual(["Brouillon", "Actif"]);
    expect(textOf(elements(html, "button").find((button) => button.includes('type="submit"')) ?? "")).toBe("Enregistrer");
  });
});

describe("the fields every form of a project has", () => {
  function renderFields(props: Partial<ComponentProps<typeof ProjectFields>> = {}, locale: Locale = "en") {
    return renderWithIntl(
      <ProjectFields
        name="Atlas"
        description="The first one"
        pending={false}
        onNameChange={() => {}}
        onDescriptionChange={() => {}}
        {...props}
      />,
      locale,
    );
  }

  it("is a name that is required and a description that is not, each labelled, with the limits of the server", () => {
    const html = renderFields();
    const [name = ""] = startTags(html, "input");
    const [description = ""] = startTags(html, "textarea");

    expect(elements(html, "label").map(textOf)).toEqual(["Name*", "Description"]);
    expect(html).toContain(`for="${attribute(name, "id")}"`);
    expect(html).toContain(`for="${attribute(description, "id")}"`);
    expect(attribute(name, "aria-required")).toBe("true");
    expect(attribute(description, "aria-required")).toBeUndefined();
    expect(attribute(name, "maxLength")).toBe(String(PROJECT_NAME_MAX));
    expect(attribute(description, "maxLength")).toBe(String(PROJECT_DESCRIPTION_MAX));
    expect(textOf(html)).toContain("Optional. 280 characters at most.");
    // The name is a 44 px target, and the description has room for a few lines
    expect(decodedClassesOf(name)).toContain("min-h-11");
    expect(attribute(description, "rows")).toBe("3");
  });

  it("waits, read-only and not disabled, while the form sends", () => {
    const html = renderFields({ pending: true });

    expect(attribute(startTags(html, "input")[0] ?? "", "readOnly")).toBe("");
    expect(attribute(startTags(html, "textarea")[0] ?? "", "readOnly")).toBe("");
    expect(attribute(startTags(html, "input")[0] ?? "", "disabled")).toBeUndefined();
    expect(attribute(startTags(renderFields(), "input")[0] ?? "", "readOnly")).toBeUndefined();
  });

  it("gives each form its own ids: two forms on a page never share a label", () => {
    const html = renderWithIntl(
      <>
        <ProjectFields name="A" description="" pending={false} onNameChange={() => {}} onDescriptionChange={() => {}} />
        <ProjectFields name="B" description="" pending={false} onNameChange={() => {}} onDescriptionChange={() => {}} />
      </>,
    );
    const ids = [...startTags(html, "input"), ...startTags(html, "textarea")].map((tag) => attribute(tag, "id"));
    const labelled = elements(html, "label").map((label) => /for="([^"]+)"/.exec(label)?.[1]);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(labelled).toEqual([ids[0], ids[2], ids[1], ids[3]]);
  });

  it("speaks French", () => {
    const html = renderFields({}, "fr");

    expect(elements(html, "label").map(textOf)).toEqual(["Nom*", "Description"]);
    expect(textOf(html)).toContain("Facultatif. 280 caractères au plus.");
  });
});

describe("the new project button", () => {
  it("is the one primary button, with a plus, that says it opens a dialog", () => {
    const html = renderWithIntl(<NewProjectButton orgId="org_1" />);
    const [button = ""] = startTags(html, "button");

    expect(startTags(html, "button")).toHaveLength(1);
    expect(textOf(html)).toBe("New project");
    expect(attribute(button, "aria-haspopup")).toBe("dialog");
    expect(attribute(button, "aria-expanded")).toBe("false");
    expect(attribute(button, "type")).toBe("button");
    // The primary variant, and an icon that is decoration
    expect(decodedClassesOf(button)).toContain("bg-primary");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("draws no dialog until it is opened", () => {
    expect(renderWithIntl(<NewProjectButton orgId="org_1" />)).not.toContain('role="dialog"');
  });

  it("speaks French", () => {
    expect(textOf(renderWithIntl(<NewProjectButton orgId="org_1" />, "fr"))).toBe("Nouveau projet");
  });
});

describe("the empty list", () => {
  it("says there is no project, under the h1 of the page, with the one button that opens the dialog", () => {
    const html = renderWithIntl(<ProjectsEmpty orgId="org_1" />);

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("No projects yet");
    expect(startTags(html, "h1")).toHaveLength(0);
    expect(elements(html, "button").map(textOf)).toEqual(["New project"]);
    // The folder, in a tinted tile
    expect(html).toContain('data-slot="icon-tile"');
  });

  it("speaks French", () => {
    const html = renderWithIntl(<ProjectsEmpty orgId="org_1" />, "fr");

    expect(textOf(elements(html, "h2")[0] ?? "")).toBe("Aucun projet pour l'instant");
    expect(elements(html, "button").map(textOf)).toEqual(["Nouveau projet"]);
  });
});

describe("the zone that deletes a project", () => {
  const render = (locale: Locale = "en") => renderWithIntl(<DeleteProjectZone orgId="org_1" projectId="p1" />, locale);

  /** The props the zone gave the confirm dialog on its first draw. */
  const dialog = () => confirm.calls[0] ?? {};

  it("is a danger card: a danger edge on the danger background, one sentence and one destructive button", () => {
    const html = render();
    const [zone = ""] = startTags(html, "div");
    const [button = ""] = startTags(html, "button");

    expect(decodedClassesOf(zone)).toEqual(expect.arrayContaining(["border-danger", "bg-danger-bg"]));
    expect(decodedClassesOf(zone)).not.toContain("bg-card");
    expect(elements(html, "button").map(textOf)).toEqual(["Delete project"]);
    expect(elements(html, "p").map(textOf)).toEqual([
      "Deleting this project removes it for everyone in your workspace, and it can't be undone.",
    ]);
    // The destructive variant of the button
    expect(decodedClassesOf(button)).toContain("bg-destructive");
  });

  it("says that the button opens a dialog, and the sentence describes it for those who hear it", () => {
    const html = render();
    const [button = ""] = startTags(html, "button");
    const [sentence = ""] = startTags(html, "p");

    expect(attribute(button, "aria-haspopup")).toBe("dialog");
    expect(attribute(button, "aria-expanded")).toBe("false");
    expect(attribute(button, "aria-describedby")).toBe(attribute(sentence, "id"));
    // Danger text on the danger background: the pair that the contrast test holds to 4.5:1
    expect(decodedClassesOf(sentence)).toContain("text-danger-text");
  });

  it("asks to confirm in the danger tone, with no text to type, and a button that says what it does", () => {
    render();

    expect(dialog()).toMatchObject({
      open: false,
      tone: "danger",
      title: "Delete this project?",
      confirmLabel: "Delete project",
    });
    expect(dialog().requireText).toBeUndefined();
  });

  it("gives the focus back to its button when the confirmation closes without a deletion", () => {
    render();
    const event = { preventDefault: vi.fn() };

    // Radix would give the focus to a trigger that does not exist: the zone cancels that
    (dialog().onCloseAutoFocus as (event: unknown) => void)(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("deletes the project of this workspace, says so, then leaves for the list", async () => {
    vi.mocked(deleteProject).mockResolvedValue({ success: true, data: undefined });
    render();

    await (dialog().onConfirm as () => Promise<void>)();

    expect(deleteProject).toHaveBeenCalledExactlyOnceWith({ organizationId: "org_1", projectId: "p1" });
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Project deleted.");
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/projects");
    // The toast comes first: the page it is about is still there when it appears
    expect(vi.mocked(toast.success).mock.invocationCallOrder[0]).toBeLessThan(router.push.mock.invocationCallOrder[0] ?? 0);
  });

  it("stays on the project, with the dialog open, when the server refuses: the confirm dialog says so", async () => {
    vi.mocked(deleteProject).mockResolvedValue({ success: false, error: "Failed to delete project" });
    render();

    await expect((dialog().onConfirm as () => Promise<void>)()).rejects.toThrow("Failed to delete project");

    expect(toast.success).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("speaks French", () => {
    const html = render("fr");

    expect(elements(html, "button").map(textOf)).toEqual(["Supprimer le projet"]);
    expect(dialog()).toMatchObject({ title: "Supprimer ce projet ?", confirmLabel: "Supprimer le projet" });
  });
});
