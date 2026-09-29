import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/Backend/lib/blog';

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post: any = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="max-w-3xl mx-auto p-margin-mobile md:p-margin-desktop">
      <Link href="/journal" className="inline-flex items-center gap-1 text-body-sm text-primary dark:text-primary-fixed hover:underline mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back to journal
      </Link>

      <span className="text-label-md text-primary-container dark:text-primary-fixed uppercase tracking-wider">{post.category}</span>
      <h1 className="text-display text-on-background dark:text-surface-container-lowest leading-tight mt-2 mb-4">{post.title}</h1>
      <div className="flex items-center gap-3 text-body-sm text-on-surface-variant dark:text-surface-variant mb-8">
        <span>By {post.author}</span>
        <span>·</span>
        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
      </div>

      <img src={post.coverImage} alt={post.title} className="w-full h-80 object-cover rounded-xl mb-8 border border-outline-variant dark:border-outline" />

      <div className="prose-custom text-body-lg text-on-background dark:text-surface-container-lowest leading-relaxed space-y-5">
        {post.content.split('\n\n').map((para: string, i: number) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  );
}
