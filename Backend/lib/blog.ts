// BuildSmart AI — public blog helpers.
// Shared by the public marketing blog pages. Covers rendering fallbacks when a
// post was created before images were part of the blog flow, and keeps date
// formatting consistent.
import { dbClient, BLOG_POSTS } from "./db.ts";

export type PublicPost = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  author: string;
  status: string;
  coverImage: string;
  publishedAt: string | Date | null;
  createdAt: string | Date;
};

const FALLBACK_COVERS = [
  "/images/hero-villa.png",
  "/images/hero-interior.png",
  "/images/project-eco-office.png",
  "/images/blueprint-ai.png",
  "/images/project-villa.png",
  "/images/project-floorplan.png",
];

export function resolveCover(post: PublicPost, index = 0): string {
  if (post.coverImage) return post.coverImage;
  return FALLBACK_COVERS[index % FALLBACK_COVERS.length];
}

export function formatBlogDate(value: string | Date | null): string {
  if (!value) return "Recently published";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function toPublicPost(row: any, index = 0): PublicPost {
  return {
    id: row.id,
    title: row.title ?? "Untitled article",
    slug: row.slug,
    category: row.category ?? "Insights",
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    author: row.author ?? "BuildSmart Editorial",
    status: row.status ?? "DRAFT",
    coverImage: resolveCover(row, index),
    publishedAt: row.publishedAt ?? null,
    createdAt: row.createdAt,
  };
}

// Curated public posts served when the database is unavailable (or has not
// been configured yet). This keeps the marketing journal usable instead of
// crashing with a server error whenever a single DB read fails.
function curatedFallback(): PublicPost[] {
  return [...BLOG_POSTS]
    .sort((a, b) => {
      const da = new Date(a.publishedAt).getTime();
      const db = new Date(b.publishedAt).getTime();
      return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
    })
    .map((post, index) => {
      const row = {
        ...post,
        status: "PUBLISHED",
        createdAt: post.publishedAt,
      };
      return {
        ...toPublicPost(row, index),
        coverImage: resolveCover(row, index),
      };
    });
}

function isDatabaseUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("DATABASE_URL") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection refused") ||
    message.includes("connection refused") ||
    message.includes("getaddrinfo") ||
    message.includes("Failed to connect")
  );
}

export async function getPublicPosts(): Promise<PublicPost[]> {
  let rows: any[];
  try {
    rows = (await dbClient.blogPost.findMany({
      where: { status: "PUBLISHED" },
    })) as any[];
  } catch (error) {
    console.warn(
      isDatabaseUnavailable(error)
        ? "[buildsmart] Blog database unavailable; serving curated fallback posts."
        : "[buildsmart] Blog query failed; serving curated fallback posts.",
    );
    return curatedFallback();
  }

  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.publishedAt ?? a.createdAt).getTime();
    const db = new Date(b.publishedAt ?? b.createdAt).getTime();
    return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
  });

  return sorted.map((row, index) => ({
    ...toPublicPost(row, index),
    coverImage: resolveCover(row, index),
  }));
}

export async function getPublicPostBySlug(slug: string): Promise<PublicPost | null> {
  let row: any;
  try {
    row = (await dbClient.blogPost.findFirst({
      where: { slug, status: "PUBLISHED" },
    })) as any;
  } catch (error) {
    console.warn(
      isDatabaseUnavailable(error)
        ? "[buildsmart] Blog database unavailable; serving curated article fallback."
        : "[buildsmart] Blog query failed; serving curated article fallback.",
    );
    return curatedFallback().find((post) => post.slug === slug) ?? null;
  }
  if (!row) return null;
  return {
    ...toPublicPost(row),
    coverImage: resolveCover(row),
  };
}

// All rows (including drafts) for the portal journal/admin view. Falls back to
// the curated editorial set when the database is unavailable, so the journal
// never turns into a server error page.
export async function getAllPosts(): Promise<PublicPost[]> {
  let rows: any[];
  try {
    rows = (await dbClient.blogPost.findMany()) as any[];
  } catch (error) {
    console.warn(
      isDatabaseUnavailable(error)
        ? "[buildsmart] Blog database unavailable; serving curated fallback posts."
        : "[buildsmart] Blog query failed; serving curated fallback posts.",
    );
    return curatedFallback();
  }

  const sorted = [...rows].sort((a, b) => {
    const da = new Date(a.publishedAt ?? a.createdAt).getTime();
    const db = new Date(b.publishedAt ?? b.createdAt).getTime();
    return (Number.isNaN(db) ? 0 : db) - (Number.isNaN(da) ? 0 : da);
  });

  return sorted.map((row, index) => ({
    ...toPublicPost(row, index),
    coverImage: resolveCover(row, index),
  }));
}

export async function getPostBySlug(slug: string): Promise<PublicPost | null> {
  let row: any;
  try {
    row = (await dbClient.blogPost.findFirst({ where: { slug } })) as any;
  } catch (error) {
    console.warn(
      isDatabaseUnavailable(error)
        ? "[buildsmart] Blog database unavailable; serving curated article fallback."
        : "[buildsmart] Blog query failed; serving curated article fallback.",
    );
    return curatedFallback().find((post) => post.slug === slug) ?? null;
  }
  if (!row) return null;
  return {
    ...toPublicPost(row),
    coverImage: resolveCover(row),
  };
}
