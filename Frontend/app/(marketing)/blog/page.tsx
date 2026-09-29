import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicPosts, formatBlogDate } from "@/Backend/lib/blog";

export const metadata: Metadata = {
  title: "BuildSmart AI Journal — Architecture, Construction & Technology",
  description:
    "Explore insights on AI-assisted architecture, sustainable construction, material selection, procurement, and modern project delivery.",
};

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "AI & Architecture",
  "Architectural Design",
  "Construction",
  "Building Materials",
  "Project Management",
];

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const allPosts = await getPublicPosts();
  const ql = (q ?? "").toLowerCase();

  const filtered = allPosts.filter((post) => {
    if (category && post.category !== category) return false;
    if (ql && !`${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(ql)) return false;
    return true;
  });

  const [featured, ...rest] = filtered;

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[62vh] flex items-center overflow-hidden">
        <Image
          src="/images/hero-interior.png"
          alt="Interior of a modern sustainable building"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#17201e]/90 via-[#17201e]/60 to-[#17201e]/25" />
        <div className="relative z-10 px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto py-28 w-full">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-label-md border border-white/30 uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]">article</span>
              BuildSmart Journal
            </span>
            <h1 className="font-display text-[42px] md:text-[60px] leading-tight text-white mt-6 mb-md">
              Ideas shaping the future of building.
            </h1>
            <p className="font-body-lg text-body-lg text-white/85 max-w-2xl mb-xl">
              Practical insights on AI design, sustainable architecture, smart materials, and
              connected construction — written for professionals who build the future.
            </p>
          </div>
        </div>
      </section>

      <div className="px-margin-mobile md:px-margin-desktop max-w-[1440px] mx-auto">
        {/* Search & categories */}
        <section className="py-10">
          <form action="/blog" method="get" className="flex flex-col sm:flex-row gap-sm justify-between items-stretch sm:items-center mb-md">
            <div className="flex flex-wrap gap-sm">
              <Link
                href="/blog"
                className={`text-label-md px-4 py-2 rounded-full border ${
                  !category
                    ? "bg-primary dark:bg-primary-fixed text-white dark:text-on-primary-fixed border-transparent"
                    : "border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant"
                }`}
              >
                All
              </Link>
              {CATEGORIES.map((item) => (
                <Link
                  key={item}
                  href={`/blog?category=${encodeURIComponent(item)}`}
                  className={`text-label-md px-4 py-2 rounded-full border ${
                    category === item
                      ? "bg-primary dark:bg-primary-fixed text-white dark:text-on-primary-fixed border-transparent"
                      : "border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant"
                  }`}
                >
                  {item}
                </Link>
              ))}
            </div>
            <div className="relative sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant text-[20px]">search</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Search articles…"
                className="w-full bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-full pl-10 pr-4 py-2 text-body-sm text-on-surface dark:text-surface-container-lowest focus:outline-none focus:border-primary dark:focus:border-primary-fixed"
              />
            </div>
          </form>
        </section>

        {/* Featured */}
        {featured && (
          <section className="pb-xl">
            <Link href={`/blog/${featured.slug}`} className="block group">
              <div className="grid lg:grid-cols-2 rounded-2xl overflow-hidden border border-outline-variant dark:border-outline bg-white dark:bg-surface-container shadow-elevation hover:shadow-elevation-hover transition-all">
                <div className="relative h-72 md:h-[460px] overflow-hidden">
                  <Image
                    src={featured.coverImage}
                    alt={featured.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                    sizes="(min-width: 1024px) 50vw, 100vw"
                  />
                  <span className="absolute top-4 left-4 bg-[#315C4C]/90 text-white text-label-md px-3 py-1 rounded-full backdrop-blur">
                    Featured
                  </span>
                </div>
                <div className="p-8 md:p-xl flex flex-col justify-center">
                  <span className="text-label-md text-primary dark:text-primary-fixed uppercase tracking-wider mb-2">
                    {featured.category}
                  </span>
                  <h2 className="text-headline-lg text-on-surface dark:text-surface-container-lowest mb-3 group-hover:text-primary dark:group-hover:text-primary-fixed transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-body-md text-on-surface-variant dark:text-surface-variant mb-5">
                    {featured.excerpt}
                  </p>
                  <div className="flex items-center gap-sm text-body-sm text-on-surface-variant dark:text-surface-variant">
                    <span className="w-8 h-8 rounded-full bg-primary-container/15 dark:bg-primary-fixed/15 text-primary dark:text-primary-fixed flex items-center justify-center font-bold">
                      {featured.author.charAt(0)}
                    </span>
                    <span className="font-semibold">{featured.author}</span>
                    <span>·</span>
                    <span>{formatBlogDate(featured.publishedAt ?? featured.createdAt)}</span>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Grid */}
        <section className="pb-24">
          {rest.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {rest.map((post, index) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden hover:-translate-y-1 hover:shadow-elevation-hover transition-all duration-300"
                >
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    />
                    <span className="absolute top-3 left-3 bg-[#17201e]/70 text-white text-label-md px-3 py-1 rounded-full backdrop-blur">
                      {post.category}
                    </span>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-sm text-label-md text-on-surface-variant dark:text-surface-variant mb-2">
                      <span>{formatBlogDate(post.publishedAt ?? post.createdAt)}</span>
                      <span>{Math.max(3, Math.round(post.content.split(" ").length / 220))} min read</span>
                    </div>
                    <h3 className="text-headline-sm text-on-surface dark:text-surface-container-lowest leading-tight mb-2 group-hover:text-primary dark:group-hover:text-primary-fixed transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant line-clamp-3 flex-1">
                      {post.excerpt}
                    </p>
                    <span className="inline-flex items-center gap-1 text-label-md text-primary dark:text-primary-fixed mt-4">
                      Read article
                      <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-outline-variant dark:border-outline rounded-xl">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant text-[42px]">article</span>
              <p className="text-headline-sm text-on-surface dark:text-surface-container-lowest mt-3">No articles found</p>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-sm">
                Try a different category or search term.
              </p>
              <Link href="/blog" className="btn-primary mt-lg">View all articles</Link>
            </div>
          )}
        </section>

        {/* Newsletter */}
        <section className="pb-24">
          <div className="relative rounded-2xl overflow-hidden border border-outline-variant dark:border-outline">
            <Image
              src="/images/blueprint-ai.png"
              alt="Architectural blueprint concept"
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-[#17201e]/80" />
            <div className="relative z-10 px-margin-mobile md:px-xl py-16 text-center text-white">
              <span className="material-symbols-outlined text-[36px]">mark_email_unread</span>
              <h2 className="text-headline-lg mt-3 mb-sm">Get smarter building insights</h2>
              <p className="text-body-md text-white/80 max-w-xl mx-auto mb-lg">
                Join the BuildSmart newsletter for practical ideas on AI architecture, sustainable
                design, and smart construction.
              </p>
              <form action="/blog" method="get" className="flex flex-col sm:flex-row gap-sm justify-center max-w-md mx-auto">
                <input
                  type="email"
                  name="q"
                  placeholder="you@example.com"
                  className="flex-1 bg-white/10 backdrop-blur border border-white/40 rounded-lg px-4 py-3 text-body-sm text-white placeholder:text-white/60 focus:outline-none focus:border-white"
                />
                <button className="bg-white text-primary hover:bg-surface-container-low text-label-md px-xl py-3 rounded-lg transition-colors">
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
