import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dbClient } from '@/Backend/lib/db';
import { StarRating } from '@/Frontend/components/StarRating';
import { ReviewForm } from '@/Frontend/components/reviews/ReviewForm';

export default async function ArchitectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: id } });
  if (!profile) notFound();

  const users = await dbClient.user.findMany();
  const name = users.find((u: any) => u.id === id)?.name ?? 'Architect';
  const reviews = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: id, status: 'APPROVED' } });
  const specs = JSON.parse(profile.specializations ?? '[]') as string[];
  const portfolio = JSON.parse(profile.portfolio ?? '[]') as string[];

  return (
    <div className="max-w-5xl mx-auto p-margin-mobile md:p-margin-desktop">
      <Link href="/architects" className="inline-flex items-center gap-1 text-body-sm text-primary dark:text-primary-fixed hover:underline mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to architects
      </Link>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
                {name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest">{name}</h1>
                  {profile.verificationStatus === 'VERIFIED' && (
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                  )}
                </div>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{profile.location} · {profile.experience} years experience · License {profile.licenseNumber}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StarRating value={profile.rating} readOnly />
                  <span className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest">{profile.rating}</span>
                  <span className="text-body-sm text-on-surface-variant dark:text-surface-variant">({profile.reviewCount} reviews)</span>
                </div>
              </div>
              <a href="/chat" className="btn-primary px-4 py-2 rounded-lg text-label-md whitespace-nowrap hidden sm:inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">forum</span> Contact
              </a>
            </div>
            <div className="mt-6">
              <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">Biography</h3>
              <p className="text-body-md text-on-background dark:text-surface-container-lowest">{profile.biography}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {specs.map((s: string) => (
                <span key={s} className="text-label-md px-3 py-1 rounded-full bg-surface-container-low dark:bg-primary-container text-on-surface-variant dark:text-on-primary-container">{s}</span>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
            <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Portfolio</h3>
            <div className="grid grid-cols-2 gap-3">
              {portfolio.map((src: string) => (
                <img key={src} src={src} alt="Portfolio" className="rounded-lg h-40 w-full object-cover border border-outline-variant dark:border-outline" />
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
            <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Reviews ({reviews.length})</h3>
            {reviews.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No approved reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-b border-outline-variant dark:border-outline pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StarRating value={r.rating} readOnly size="text-[16px]" />
                      <span className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest">{r.title}</span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{r.body}</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">— {r.authorName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-1">
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation sticky top-24">
            <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Leave a Review</h3>
            <ReviewForm targetType="ARCHITECT" targetId={id} />
          </div>
        </div>
      </div>
    </div>
  );
}
