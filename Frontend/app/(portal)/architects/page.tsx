import Link from 'next/link';
import { dbClient } from '@/Backend/lib/db';
import { StarRating } from '@/Frontend/components/StarRating';

export default async function ArchitectsPage({ searchParams }: { searchParams: Promise<{ q?: string; spec?: string }> }) {
  const { q, spec } = await searchParams;
  const profiles = await dbClient.architectProfile.findMany();
  const users = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u: any) => u.id === id)?.name ?? 'Unknown';

  const allSpecs = Array.from(new Set(profiles.flatMap((p: any) => JSON.parse(p.specializations ?? '[]') as string[])));

  let list = profiles.map((p: any) => ({
    id: p.userId,
    name: nameFor(p.userId),
    bio: p.biography,
    specs: JSON.parse(p.specializations ?? '[]') as string[],
    experience: p.experience,
    location: p.location,
    rating: p.rating,
    reviewCount: p.reviewCount,
    verified: p.verificationStatus === 'VERIFIED',
    portfolio: JSON.parse(p.portfolio ?? '[]') as string[],
  }));

  const ql = (q ?? '').toLowerCase();
  if (ql) list = list.filter((a) => (a.name + ' ' + a.bio + ' ' + a.specs.join(' ') + ' ' + a.location).toLowerCase().includes(ql));
  if (spec) list = list.filter((a) => a.specs.includes(spec));

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Discover Architects</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Find and collaborate with verified architecture professionals.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/architects"
          className={`text-label-md px-4 py-2 rounded-full border transition-colors ${!spec ? 'bg-primary-container text-on-primary-container dark:bg-primary-fixed-dim dark:text-on-primary-fixed border-transparent' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}
        >
          All
        </Link>
        {allSpecs.map((s) => (
          <Link
            key={s}
            href={`/architects?spec=${encodeURIComponent(s)}`}
            className={`text-label-md px-4 py-2 rounded-full border transition-colors ${spec === s ? 'bg-primary-container text-on-primary-container dark:bg-primary-fixed-dim dark:text-on-primary-fixed border-transparent' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}
          >
            {s}
          </Link>
        ))}
        <form action="/architects" method="get" className="ml-auto flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search architects…" className="input w-56" />
          <button type="submit" className="btn-primary px-4 py-2 rounded-lg text-label-md">Search</button>
        </form>
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {list.map((a) => (
          <Link
            key={a.id}
            href={`/architects/${a.id}`}
            className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden hover:shadow-elevation transition-all flex flex-col"
          >
            <div className="h-44 w-full relative">
              <img src={a.portfolio[0] ?? '/images/project-villa.png'} alt={a.name} className="w-full h-full object-cover" />
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 dark:bg-black/60 backdrop-blur px-2 py-1 rounded-full text-label-md text-[#2F6B50] dark:text-primary-fixed">
                <StarRating value={a.rating} readOnly size="text-[14px]" />
                <span className="font-semibold text-on-surface dark:text-surface-container-lowest ml-1">{a.rating}</span>
              </div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{a.name}</h3>
                {a.verified && (
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                )}
              </div>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-3">{a.location} · {a.experience} yrs · {a.reviewCount} reviews</p>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant line-clamp-2">{a.bio}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.specs.slice(0, 3).map((s) => (
                  <span key={s} className="text-label-md px-2 py-1 rounded bg-surface-container-low dark:bg-primary-container text-on-surface-variant dark:text-on-primary-container">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {list.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant dark:text-surface-variant">No architects match your filters.</div>
      )}
    </div>
  );
}
