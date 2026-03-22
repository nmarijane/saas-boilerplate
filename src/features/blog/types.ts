export interface BlogPostMeta {
  title: string;
  description: string;
  date: string;
  author: string;
  authorImage?: string;
  image?: string;
  tags: string[];
  published: boolean;
  readingTime?: string;
}

export interface BlogPost {
  slug: string;
  meta: BlogPostMeta;
  content: string;
}
