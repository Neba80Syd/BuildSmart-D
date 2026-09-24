import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicPostBySlug, getPublicPosts, formatBlogDate } from "@/Backend/lib/blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPostBySlug(slug);
  if (!post) return { title: "Article not found | BuildSmart AI" };
  return {
    title: `${post.title} | BuildSmart AI Journal`,
    description: post.excerpt.slice(0, 155),
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublicPostBySlug(slug);
  if (!post) notFound();

  const related = (await getPublicPosts())
    .filter((item) => item.slug !== post.slug)
    .slice(0, 3);
  const paragraphs = post.content.split("\n\n").filter(Boolean);
  const readTime = `${Math.max(2, Math.round(post.content.split(" ").length / 220))} min read`;

  return (
    <article>
      {/* Hero heading */}
      <section className="px-margin-mobile md:px-margin-desktop max-w-4xl mx-auto pt-16 pb-8">
        <Link href="/blog" className="inline-flex items-center gap-1 text-body-sm text-primary dark:text-primary-fixed hover:underline mb-6">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to journal
        </Link>
        <div className="flex flex-wrap items-center gap-sm text-label-md text-on-surface-variant dark:text-surface-variant mb-4">
          <span className="bg-primary-container/10 dark:bg-primary-fixed/10 text-primary dark:text-primary-fixed px-3 py-1 rounded-full">{post.category}</span>
          <span>{formatBlogDate(post.publishedAt ?? post.createdAt)}</span>
          <span>·</span>
          <span>{readTime}</span>
        </div>
        <h1 className="text-headline-lg md:text-display text-on-surface dark:text-surface-container-lowest leading-tight mb-4">
          {post.title}
        </h1>
        <div className="flex items-center gap-sm text-body-sm text-on-surface-variant dark:text-surface-variant">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-fixed text-white flex items-center justify-center font-bold">
            {post.author.charAt(0)}
          </span>
          <div>
            <p className="font-semibold text-on-surface dark:text-surface-container-lowest">{post.author}</p>
            <p>BuildSmart AI Editorial</p>
          </div>
        </div>
      </section>

      {/* Cover */}
      <section className="px-margin-mobile md:px-margin-desktop max-w-5xl mx-auto">
        <div className="relative h-72 md:h-[500px] rounded-2xl overflow-hidden border border-outline-variant dark:border-outline shadow-elevation-hover">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 1000px, 100vw"
          />
        </div>
      </section>

      {/* Body */}
      <section className="px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto py-16">
        <div className="prose-custom text-body-lg text-on-surface dark:text-surface-container-lowest leading-relaxed space-y-5">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-xl pt-lg border-t border-outline-variant dark:border-outline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md">
          <div className="flex items-center gap-sm text-body-sm text-on-surface-variant dark:text-surface-variant">
            <span className="w-9 h-9 rounded-full bg-primary-container/15 dark:bg-primary-fixed/15 text-primary dark:text-primary-fixed flex items-center justify-center font-bold">
              {post.author.charAt(0)}
            </span>
            <div>
              <p className="font-semibold text-on-surface dark:text-surface-container-lowest">Written by {post.author}</p>
              <p>Share this article</p>
            </div>
          </div>
          <div className="flex gap-sm">
            {["telegram", "content_copy", "mail"].map((icon) => (
              <button key={icon} className="w-10 h-10 rounded-full border border-outline-variant dark:border-outline flex items-center justify-center text-on-surface-variant dark:text-surface-variant hover:border-primary dark:hover:border-primary-fixed hover:text-primary dark:hover:text-primary-fixed transition-colors">
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="px-margin-mobile md:px-margin-desktop max-w-6xl mx-auto pb-24">
          <div className="text-center mb-xl">
            <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest">Continue reading</h2>
            <p className="text-body-md text-on-surface-variant dark:text-surface-variant">More insights from the BuildSmart journal.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-gutter">
            {related.map((item) => (
              <Link
                key={item.id}
                href={`/blog/${item.slug}`}
                className="group bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-elevation-hover transition-all duration-300"
              >
                <div className="relative h-36 overflow-hidden">
                  <Image
                    src={item.coverImage}
                    alt={item.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(min-width: 1024px) 33vw, 100vw"
                  />
                </div>
                <div className="p-5">
                  <span className="text-label-md text-primary dark:text-primary-fixed">{item.category}</span>
                  <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest leading-tight mt-2 group-hover:text-primary dark:group-hover:text-primary-fixed transition-colors">
                    {item.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="px-margin-mobile md:px-margin-desktop max-w-6xl mx-auto pb-24">
        <div className="relative rounded-2xl overflow-hidden border border-outline-variant dark:border-outline">
          <Image src="/images/hero-villa.png" alt="Modern glass villa" fill className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-[#17201e]/80" />
          <div className="relative z-10 px-margin-mobile md:px-xl py-16 text-center text-white">
            <h2 className="text-headline-lg mb-sm">Put these ideas to work</h2>
            <p className="text-body-md text-white/80 max-w-xl mx-auto mb-lg">
              Start designing with AI, estimate confidently, and connect with verified suppliers today.
            </p>
            <Link href="/register" className="inline-flex bg-white text-primary hover:bg-surface-container-low text-label-md px-xl py-md rounded-lg transition-colors shadow-lg">
              Start Free
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
