"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/shared/utils/cn";

interface MdxContentProps {
  content: string;
}

export function MdxContent({ content }: MdxContentProps) {
  return (
    <article
      className={cn(
        "prose prose-lg dark:prose-invert mx-auto max-w-3xl",
        "prose-headings:scroll-mt-20 prose-headings:font-bold",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm",
        "prose-pre:rounded-lg prose-pre:border",
        "prose-img:rounded-lg",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
