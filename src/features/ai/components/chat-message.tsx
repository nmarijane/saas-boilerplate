"use client";

import type { ComponentProps } from "react";
import type { Components, ExtraProps } from "react-markdown";
import { BotIcon, UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { scrollableBlocks } from "@/shared/components/data/markdown-blocks";
import { isWebAddress } from "@/shared/components/shell/nav-row";
import { cn } from "@/shared/utils/cn";

// The check box of an item of a task list (`- [x] done`). It is read only, and it
// has a name: the text of the item sits beside it, not in a label, and a check
// box with no name is read as nothing at all.
function TaskCheckbox(props: ComponentProps<"input">) {
  const t = useTranslations("ai");

  return <input {...props} aria-label={t("task")} />;
}

type Tree = NonNullable<ExtraProps["node"]>;

/** What a link says by itself: its text, and the alt text of the images it holds (the chat draws that, and not the image). */
function textOf(node: Tree | Tree["children"][number]): string {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type !== "element") {
    return "";
  }
  if (node.tagName === "img") {
    return String(node.properties.alt ?? "");
  }

  return node.children.map(textOf).join("");
}

// A link of an answer. What a model typed is not a page of this app, and the rule for a link
// that leaves it is the one of the anchors of the shell (`ShellAnchor`): only a web address
// opens in a tab of its own, which knows nothing of this one (`noopener`, `noreferrer`) while
// the app vouches for no address (`nofollow`), and it says so to assistive technology in words
// only they read. Any other link is drawn as it is: the jump of a footnote is inside the
// message, and a `mailto:` hands over to the mail client. react-markdown has kept only the
// schemes it knows are safe by the time a link gets here.
//
// A link with no text of its own (an image with no alt text, or nothing between the brackets)
// shows its address: with no name it is a tab stop that a keyboard lands on and a screen
// reader reads as nothing. With no address (react-markdown empties that of a link whose
// scheme runs code) there is nothing to follow: an `<a href="">` is not nothing, it reloads
// the page. The text the link had stays, as text, with no link round it, and a link with no
// text and no address is not drawn at all.
function ChatLink({ node, href, children, ...props }: ComponentProps<"a"> & ExtraProps) {
  const tShell = useTranslations("shell");
  const web = href !== undefined && isWebAddress(href);
  const textless = node !== undefined && textOf(node).trim() === "";

  if (!href) {
    return textless ? null : children;
  }

  return (
    <a
      href={href}
      target={web ? "_blank" : undefined}
      rel={web ? "noopener noreferrer nofollow" : undefined}
      {...props}
    >
      {textless ? href : children}
      {web ? <span className="sr-only">{tShell("opensInNewTab")}</span> : null}
    </a>
  );
}

// The blocks that can be wider than the message (code, a table) scroll in a box of their own,
// which a keyboard reaches (`scrollableBlocks`).
const components: Components = {
  // The route streams text and nothing else, so an image in an answer is an address the
  // model typed, and an instruction slipped into the conversation can pick it: drawing it
  // would make the browser fetch it, and the address can carry what the conversation says.
  // The alt text is what is left of it (nothing, when it has none).
  img: ({ alt }) => alt ?? null,
  a: ChatLink,
  input: ({ node, ...props }) => <TaskCheckbox {...props} />,
  ...scrollableBlocks,
};

interface ChatMessageProps {
  role: string;
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const t = useTranslations("ai");
  const isAssistant = role === "assistant";

  return (
    <div className={cn("flex gap-3 px-4 py-3", isAssistant && "bg-muted/50")}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
        {isAssistant ? (
          <BotIcon className="size-4" />
        ) : (
          <UserIcon className="size-4" />
        )}
      </div>
      {/* The markdown style (global.css) spaces what the message holds and draws its
          lists, headings and code from the tokens: the typography plugin is not
          installed, and `prose` draws nothing */}
      <div className="markdown min-w-0 flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={components}
          // The words that a screen reader hears of the footnotes are the page's, not react-markdown's English:
          // the label of the notes, and the name of each link that goes back to the text (`1`, then `1-2` when the
          // note is cited again)
          remarkRehypeOptions={{
            footnoteLabel: t("footnotes"),
            footnoteBackLabel: (reference, repeat) =>
              t("footnoteBack", { reference: `${reference + 1}${repeat > 1 ? `-${repeat}` : ""}` }),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
