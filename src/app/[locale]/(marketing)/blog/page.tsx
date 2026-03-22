import { useTranslations } from "next-intl";

import { BlogCard } from "@/features/blog/components/blog-card";
import { getAllPosts, getAllTags } from "@/features/blog/queries";

export default function BlogPage() {
  const t = useTranslations("marketing.blog");
  const posts = getAllPosts();
  const tags = getAllTags();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {tags.length > 0 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <p className="text-lg">{t("noPosts")}</p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} slug={post.slug} meta={post.meta} />
          ))}
        </div>
      )}
    </div>
  );
}
