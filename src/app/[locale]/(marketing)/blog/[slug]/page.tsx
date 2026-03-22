import type { Metadata } from "next";
import { ArrowLeftIcon, CalendarIcon, ClockIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { MdxContent } from "@/features/blog/components/mdx-content";
import { getAllPosts, getPostBySlug } from "@/features/blog/queries";
import { Button } from "@/shared/components/ui/button";
import { Link } from "@/shared/lib/i18n-navigation";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.meta.title,
    description: post.meta.description,
    openGraph: {
      title: post.meta.title,
      description: post.meta.description,
      type: "article",
      publishedTime: post.meta.date,
      authors: [post.meta.author],
      ...(post.meta.image && { images: [post.meta.image] }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description: post.meta.description,
      ...(post.meta.image && { images: [post.meta.image] }),
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Button variant="ghost" size="sm" className="mb-8" asChild>
          <Link href={"/blog" as never}>
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to blog
          </Link>
        </Button>

        {/* Header */}
        <header className="mb-12">
          <div className="mb-4 flex flex-wrap gap-2">
            {post.meta.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
            {post.meta.title}
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            {post.meta.description}
          </p>
          <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {post.meta.author}
            </span>
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3.5" />
              {new Date(post.meta.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            {post.meta.readingTime && (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3.5" />
                {post.meta.readingTime}
              </span>
            )}
          </div>
        </header>

        {/* Cover image */}
        {post.meta.image && (
          <div className="mb-12 aspect-video overflow-hidden rounded-lg">
            <img
              src={post.meta.image}
              alt={post.meta.title}
              className="size-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <MdxContent content={post.content} />
      </div>
    </div>
  );
}
