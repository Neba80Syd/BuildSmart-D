import Link from 'next/link';
import { getAllPosts } from '@/Backend/lib/blog';
import { resolveUser } from '@/Backend/lib/preview';
import { BlogAdmin } from '@/Frontend/components/blog/BlogAdmin';

const CATEGORIES = ['AI & Architecture', 'Construction', 'Building Materials', 'Architectural Design', 'Project Management'];

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const user = await resolveUser('ADMIN');
  const allPosts: any[] = await getAllPosts();

  let posts = allPosts;
  const ql = (q ?? '').toLowerCase();
  if (ql) posts = posts.filter((p) => (p.title + ' ' + p.excerpt + ' ' + p.category).toLowerCase().includes(ql));
  if (category) posts = posts.filter((p) => p.category === category);

  const featured = posts.find((p) => p.status === 'PUBLISHED') ?? posts[0];
  const rest = posts.filter((p) => p.id !== featured?.id);

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">BuildSmart Journal</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Insights on AI, architecture, and modern construction.</p>
        </div>
        <form action="/journal" method="get" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search articles…" className="input w-56" />
          <button type="submit" className="btn-primary px-4 py-2 rounded-lg text-label-md">Search</button>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link href="/journal" className={`text-label-md px-4 py-2 rounded-full border ${!category ? 'bg-primary-container text-on-primary-container dark:bg-primary-fixed-dim dark:text-on-primary-fixed border-transparent' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c} href={`/journal?category=${encodeURIComponent(c)}`} className={`text-label-md px-4 py-2 rounded-full border ${category === c ? 'bg-primary-container text-on-primary-container dark:bg-primary-fixed-dim dark:text-on-primary-fixed border-transparent' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>
            {c}
          </Link>
        ))}
      </div>

      {featured && (
        <Link href={`/journal/${featured.slug}`} className="block mb-10">
          <div className="grid md:grid-cols-2 gap-6 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden hover:shadow-elevation transition-shadow">
            <img src={featured.coverImage} alt={featured.title} className="w-full h-64 md:h-full object-cover" />
            <div className="p-8 flex flex-col justify-center">
              <span className="text-label-md text-primary-container dark:text-primary-fixed uppercase tracking-wider mb-2">{featured.category}</span>
              <h2 className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest mb-3">{featured.title}</h2>
              <p className="text-body-md text-on-surface-variant dark:text-surface-variant">{featured.excerpt}</p>
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant mt-4">By {featured.author}</span>
            </div>
          </div>
        </Link>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {rest.map((p: any) => (
          <Link key={p.id} href={`/journal/${p.slug}`} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden hover:shadow-elevation transition-shadow flex flex-col">
            <img src={p.coverImage} alt={p.title} className="w-full h-40 object-cover" />
            <div className="p-5 flex flex-col flex-1">
              <span className="text-label-md text-primary-container dark:text-primary-fixed uppercase tracking-wider mb-1">{p.category}</span>
              <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest leading-tight mb-2">{p.title}</h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant line-clamp-3 flex-1">{p.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>

      <BlogAdmin posts={allPosts} isAdmin={user.role === 'ADMIN'} />
    </div>
  );
}
