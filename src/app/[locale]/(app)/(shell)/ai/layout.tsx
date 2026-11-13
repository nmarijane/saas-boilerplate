import type { ReactNode } from "react";

// The assistant fills the screen: 100dvh less what the shell keeps over the page
// (its sticky bars, `--shell-chrome`) and the margins above and below the content
// (`--shell-gutter-y`), both measured in global.css. It is never shorter than
// 24 rem, so that a landscape phone still has room to type.
export default function AILayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-96 flex-col h-[calc(100dvh-var(--shell-chrome)-var(--shell-gutter-y))]">
      {children}
    </div>
  );
}
