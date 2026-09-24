import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const products = await dbClient.product.findMany();
  const architects = await dbClient.architectProfile.findMany();
  const users = await dbClient.user.findMany();
  const projects = await dbClient.project.findMany();
  const blog = await dbClient.blogPost.findMany({ where: { status: 'PUBLISHED' } });

  const nameFor = (id: string) => users.find((u: any) => u.id === id)?.name ?? '';

  const matches = (hay: string) => !q || hay.toLowerCase().includes(q);

  const results: any = {
    products: [],
    architects: [],
    projects: [],
    articles: [],
  };

  if (matches('')) {
    // Empty query → return top recommendations rather than everything.
    results.products = products.slice(0, 4).map((p: any) => ({ id: p.id, name: p.name, category: p.category, price: p.price, unit: p.unit }));
    results.architects = architects.slice(0, 3).map((a: any) => ({ id: a.userId, name: nameFor(a.userId), rating: a.rating, location: a.location, verificationStatus: a.verificationStatus }));
    results.projects = projects.slice(0, 2).map((p: any) => ({ id: p.id, name: p.name, status: p.status }));
    results.articles = blog.slice(0, 3).map((b: any) => ({ id: b.id, title: b.title, slug: b.slug, category: b.category }));
  } else {
    results.products = products
      .filter((p: any) => matches(p.name + ' ' + p.category + ' ' + (p.description ?? '')))
      .map((p: any) => ({ id: p.id, name: p.name, category: p.category, price: p.price, unit: p.unit }));

    results.architects = architects
      .filter((a: any) => {
        const specs = JSON.parse(a.specializations ?? '[]').join(' ');
        return matches(nameFor(a.userId) + ' ' + a.location + ' ' + specs + ' ' + (a.biography ?? ''));
      })
      .map((a: any) => ({ id: a.userId, name: nameFor(a.userId), rating: a.rating, location: a.location, verificationStatus: a.verificationStatus }));

    results.projects = projects
      .filter((p: any) => matches(p.name + ' ' + (p.description ?? '') + ' ' + (p.location ?? '')))
      .map((p: any) => ({ id: p.id, name: p.name, status: p.status, location: p.location }));

    results.articles = blog
      .filter((b: any) => matches(b.title + ' ' + b.excerpt + ' ' + b.category))
      .map((b: any) => ({ id: b.id, title: b.title, slug: b.slug, category: b.category }));
  }

  return NextResponse.json({ query: q, results });
}
