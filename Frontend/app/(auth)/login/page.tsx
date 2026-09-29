'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button } from '@/Frontend/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('registered');
    if (param === 'true') {
      setJustRegistered(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setPending(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const password = String(formData.get('password') ?? '');

    try {
      const res = await signIn('credentials', { email, password, redirect: false });

      if (res?.error) {
        setError('Invalid email or password');
        setPending(false);
        return;
      }

      // Resolve the role after a successful sign-in and route to the correct
      // dashboard. /api/me is populated by the auth session established above.
      const me = await fetch('/api/me').then((r) => r.json());
      const role = (me?.role ?? 'CLIENT').toUpperCase();
      const home =
        role === 'ARCHITECT' ? '/architect'
        : role === 'VENDOR' ? '/vendor'
        : role === 'ADMIN' ? '/admin'
        : '/client';

      // Verify callbackUrl matches the user's role workspace
      const searchParams = new URLSearchParams(window.location.search);
      const callbackUrl = searchParams.get('callbackUrl');
      let target = home;
      if (callbackUrl && callbackUrl.startsWith('/')) {
        const isTargetAllowed =
          (role === 'ARCHITECT' && callbackUrl.startsWith('/architect')) ||
          (role === 'CLIENT' && callbackUrl.startsWith('/client')) ||
          (role === 'VENDOR' && callbackUrl.startsWith('/vendor')) ||
          (role === 'ADMIN' && callbackUrl.startsWith('/admin'));
        if (isTargetAllowed) {
          target = callbackUrl;
        }
      }

      router.push(target);
      router.refresh();
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] dark:bg-[#17201e] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <span className="material-symbols-outlined text-[#315C4C] dark:text-[#A4D2BE] text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>architecture</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#17201e] dark:text-[#effcf7]">Welcome back</h1>
          <p className="text-[#414944] dark:text-[#A8B1AD] mt-1">Sign in to your BuildSmart AI account</p>
        </div>

        <div className="bg-white dark:bg-[#25312e] border border-[#DDE2E0] dark:border-[#3F4946] rounded-2xl shadow-card p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {justRegistered && (
              <div className="p-3.5 bg-[#eaf7f1] dark:bg-[#1f2926] border border-[#315C4C]/30 text-[#184436] dark:text-[#a4d2be] rounded-lg text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-lg" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                <span>Account created successfully! Please sign in with your credentials.</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5 text-[#17201e] dark:text-[#effcf7]">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-white dark:bg-[#17201e] border border-[#DDE2E0] dark:border-[#5E6762] rounded-lg px-3.5 py-2.5 text-[#17201e] dark:text-[#effcf7] placeholder-[#8A9490] dark:placeholder-[#6F7975] focus:border-[#315C4C] focus:ring-2 focus:ring-[#315C4C]/15 outline-none transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-[#17201e] dark:text-[#effcf7]">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                className="w-full bg-white dark:bg-[#17201e] border border-[#DDE2E0] dark:border-[#5E6762] rounded-lg px-3.5 py-2.5 text-[#17201e] dark:text-[#effcf7] placeholder-[#8A9490] dark:placeholder-[#6F7975] focus:border-[#315C4C] focus:ring-2 focus:ring-[#315C4C]/15 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[#414944] dark:text-[#A8B1AD]">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-[#315C4C] dark:text-[#A4D2BE] hover:underline">Create one</Link>
          </div>
        </div>

        {/* PREVIEW MODE: quick links to each role dashboard without signing in */}
        <div className="mt-6 p-5 border border-dashed border-[#315C4C]/40 rounded-lg bg-white/60">
          <p className="text-xs uppercase tracking-wider text-[#414944] font-medium mb-3">
            Preview a dashboard (no sign-in)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/client" className="text-center px-3 py-2 rounded border border-[#315C4C]/40 text-[#315C4C] font-medium text-sm hover:bg-[#315C4C] hover:text-white transition-colors">Client</Link>
            <Link href="/architect" className="text-center px-3 py-2 rounded border border-[#315C4C]/40 text-[#315C4C] font-medium text-sm hover:bg-[#315C4C] hover:text-white transition-colors">Architect</Link>
            <Link href="/vendor" className="text-center px-3 py-2 rounded border border-[#315C4C]/40 text-[#315C4C] font-medium text-sm hover:bg-[#315C4C] hover:text-white transition-colors">Vendor</Link>
            <Link href="/admin" className="text-center px-3 py-2 rounded border border-[#315C4C]/40 text-[#315C4C] font-medium text-sm hover:bg-[#315C4C] hover:text-white transition-colors">Admin</Link>
          </div>
        </div>

        <p className="text-center text-xs text-[#414944] dark:text-[#A8B1AD] mt-8">
          Demo accounts (password: <span className="font-mono">demo1234</span>):<br />
          jordan@buildsmart.ai (Client) • elena@buildsmart.ai (Architect) • marcus@buildsmart.ai (Vendor) • admin@buildsmart.ai (Admin)
        </p>
      </div>
    </div>
  );
}
