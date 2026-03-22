import type { ReactNode } from "react";

export default function AILayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {children}
    </div>
  );
}