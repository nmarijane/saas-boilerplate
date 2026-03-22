import type { BlogPostMeta } from "../types";

import { CalendarIcon, ClockIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

import { Link } from "@/shared/lib/i18n-navigation";

interface BlogCardProps {
  slug: string;
  meta: BlogPostMeta;
}

export function BlogCard({ slug, meta }: BlogCardProps) {
  return (
    <Link href={`/blog/${slug}` as never}>
      <Card className="group h-full transition-shadow hover:shadow-lg">
        {meta.image && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={meta.image}
              alt={meta.title}
              className="size-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardHeader>
          <div className="flex flex-wrap gap-2">
            {meta.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="text-xl font-semibold leading-tight transition-colors group-hover:text-primary">
            {meta.title}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {meta.description}
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {new Date(meta.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            {meta.readingTime && (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                {meta.readingTime}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
