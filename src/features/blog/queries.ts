import type { BlogPost, BlogPostMeta } from "./types";
import fs from "node:fs";

import path from "node:path";
import matter from "gray-matter";

import readingTime from "reading-time";

const CONTENT_DIR = path.join(process.cwd(), "content/blog");
const MDX_EXTENSION_RE = /\.mdx$/;

function ensureContentDir() {
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }
}

export function getAllPosts(): BlogPost[] {
  ensureContentDir();

  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));

  const posts = files
    .map((filename) => {
      const slug = filename.replace(MDX_EXTENSION_RE, "");
      const filePath = path.join(CONTENT_DIR, filename);
      const fileContent = fs.readFileSync(filePath, "utf8");
      const { data, content } = matter(fileContent);
      const stats = readingTime(content);

      const meta: BlogPostMeta = {
        title: (data.title as string) ?? "Untitled",
        description: (data.description as string) ?? "",
        date: (data.date as string) ?? new Date().toISOString(),
        author: (data.author as string) ?? "Team",
        authorImage: data.authorImage as string | undefined,
        image: data.image as string | undefined,
        tags: (data.tags as string[]) ?? [],
        published: (data.published as boolean) ?? false,
        readingTime: stats.text,
      };

      return { slug, meta, content };
    })
    .filter((post) => post.meta.published)
    .sort((a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime());

  return posts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  ensureContentDir();

  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(fileContent);
  const stats = readingTime(content);

  const meta: BlogPostMeta = {
    title: (data.title as string) ?? "Untitled",
    description: (data.description as string) ?? "",
    date: (data.date as string) ?? new Date().toISOString(),
    author: (data.author as string) ?? "Team",
    authorImage: data.authorImage as string | undefined,
    image: data.image as string | undefined,
    tags: (data.tags as string[]) ?? [],
    published: (data.published as boolean) ?? false,
    readingTime: stats.text,
  };

  return { slug, meta, content };
}

export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tags = new Set<string>();
  for (const post of posts) {
    for (const tag of post.meta.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter((post) => post.meta.tags.includes(tag));
}
