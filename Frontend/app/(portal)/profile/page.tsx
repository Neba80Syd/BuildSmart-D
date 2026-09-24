import { resolveUser, type SessionUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { ProfileForm } from '@/Frontend/components/profile/ProfileForm';
import { StarRating } from '@/Frontend/components/StarRating';

const ROLE_MAP: Record<string, SessionUser['role']> = { client: 'CLIENT', architect: 'ARCHITECT', vendor: 'VENDOR', admin: 'ADMIN' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  const role = ROLE_MAP[(as ?? '').toLowerCase()] ?? 'CLIENT';
  const user = await resolveUser(role);

  const profile: any = (await dbClient.userProfile.findUnique({ where: { userId: user.id } })) ?? {};
  let roleProfile: any = null;
  let reviews: any[] = [];
  let projects: any[] = [];

  if (user.role === 'ARCHITECT') {
    roleProfile = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
    reviews = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: user.id, status: 'APPROVED' } });
  }
  if (user.role === 'VENDOR') {
    roleProfile = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
    reviews = await dbClient.review.findMany({ where: { targetType: 'VENDOR', targetId: user.id, status: 'APPROVED' } });
    projects = [];
  }
  if (user.role === 'CLIENT') {
    projects = await dbClient.project.findMany({ where: { ownerId: user.id } });
  }

  const asLinks = (['CLIENT', 'ARCHITECT', 'VENDOR', 'ADMIN'] as const).filter((r) => r !== user.role);

  return (
    <div className="max-w-4xl mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Profile</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Manage your personal, professional and account information.</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-label-md text-on-surface-variant dark:text-surface-variant">Preview as:</span>
          {asLinks.map((r) => (
            <a key={r} href={`/profile?as=${r.toLowerCase()}`} className="text-label-md px-3 py-1.5 rounded-lg border border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container transition-colors">
              {r}
            </a>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Identity + edit */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation text-center">
            <div className="w-20 h-20 rounded-full bg-primary-container text-white flex items-center justify-center text-2xl font-bold mx-auto mb-3">
              {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{user.name}</h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{user.email}</p>
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container-low dark:bg-primary-container text-primary dark:text-on-primary-container text-label-md uppercase tracking-wider">
              {user.role}
            </div>
            {roleProfile?.verificationStatus && (
              <div className="mt-2 inline-flex items-center gap-1 text-label-md text-[#2F6B50] dark:text-primary-fixed">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                {roleProfile.verificationStatus === 'VERIFIED' || roleProfile.verificationStatus === 'FULLY_VERIFIED' ? 'Verified' : roleProfile.verificationStatus}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
            <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Edit Details</h3>
            <ProfileForm initial={{ name: user.name, location: profile.location ?? '', bio: profile.bio ?? '' }} />
          </div>
        </div>

        {/* Role-specific */}
        <div className="md:col-span-2 space-y-6">
          {user.role === 'ARCHITECT' && roleProfile && (
            <>
              <Section title="Professional Profile">
                <div className="grid grid-cols-2 gap-4 text-body-sm">
                  <Field label="Specializations" value={JSON.parse(roleProfile.specializations ?? '[]').join(', ')} />
                  <Field label="Experience" value={`${roleProfile.experience} years`} />
                  <Field label="License" value={roleProfile.licenseNumber ?? '—'} />
                  <Field label="Location" value={roleProfile.location ?? profile.location ?? '—'} />
                </div>
                <div className="mt-4">
                  <span className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Biography</span>
                  <p className="text-body-sm text-on-background dark:text-surface-container-lowest">{roleProfile.biography}</p>
                </div>
              </Section>
              <Section title="Portfolio">
                <div className="grid grid-cols-3 gap-3">
                  {JSON.parse(roleProfile.portfolio ?? '[]').map((src: string) => (
                    <img key={src} src={src} alt="Portfolio" className="rounded-lg h-24 w-full object-cover border border-outline-variant dark:border-outline" />
                  ))}
                </div>
              </Section>
            </>
          )}

          {user.role === 'VENDOR' && roleProfile && (
            <Section title="Business Profile">
              <div className="grid grid-cols-2 gap-4 text-body-sm">
                <Field label="Business Name" value={roleProfile.businessName} />
                <Field label="Location" value={roleProfile.location} />
                <Field label="Verification" value={roleProfile.verificationStatus} />
                <Field label="Rating" value={`${roleProfile.rating} / 5 (${roleProfile.reviewCount} reviews)`} />
              </div>
              <div className="mt-4">
                <span className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Description</span>
                <p className="text-body-sm text-on-background dark:text-surface-container-lowest">{roleProfile.description}</p>
              </div>
            </Section>
          )}

          {user.role === 'CLIENT' && (
            <Section title="My Projects">
              {projects.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No projects yet.</p>
              ) : (
                <ul className="divide-y divide-outline-variant dark:divide-outline">
                  {projects.map((p: any) => (
                    <li key={p.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{p.name}</span>
                        <span className="text-body-sm text-on-surface-variant dark:text-surface-variant ml-3">{p.location}</span>
                      </div>
                      <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {reviews.length > 0 && (
            <Section title={`Ratings & Reviews (${reviews.length})`}>
              <div className="space-y-4">
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-b border-outline-variant dark:border-outline pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StarRating value={r.rating} readOnly />
                      <span className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest">{r.title}</span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{r.body}</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">— {r.authorName}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {user.role === 'ADMIN' && (
            <Section title="Administrator">
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                Platform administrators manage users, verifications, moderation, and analytics. Use the Admin dashboard for operations.
              </p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
      <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-label-md text-on-surface-variant dark:text-surface-variant">{label}</span>
      <span className="text-body-md text-on-background dark:text-surface-container-lowest">{value}</span>
    </div>
  );
}
