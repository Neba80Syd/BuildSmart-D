'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/Frontend/components/ui/button';

const VALID_ROLES = ['CLIENT', 'ARCHITECT', 'VENDOR'];

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CLIENT',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Read ?role= only in the browser after hydration. Reading it during the
  // initial useState call causes a server/client hydration mismatch (SSR
  // always sends CLIENT), which unmounts the form in the browser.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('role');
    if (!param) return;
    const role = param.toUpperCase();
    if (VALID_ROLES.includes(role)) {
      setForm((f) => ({ ...f, role }));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Registration failed');
      setLoading(false);
    } else {
      router.push('/login?registered=true');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] dark:bg-[#17201e] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <span className="material-symbols-outlined text-[#315C4C] dark:text-[#A4D2BE] text-4xl" style={{fontVariationSettings: "'FILL' 1"}}>architecture</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#17201e] dark:text-[#effcf7]">Create your account</h1>
          <p className="text-[#414944] dark:text-[#A8B1AD] mt-1">Join the professional AEC platform</p>
        </div>

        <div className="bg-white dark:bg-[#25312e] border border-[#DDE2E0] dark:border-[#3F4946] rounded-2xl shadow-card p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>}

            {[
              { label: 'Full Name', name: 'name', type: 'text', value: form.name, placeholder: 'Alex Rivera' },
              { label: 'Email', name: 'email', type: 'email', value: form.email, placeholder: 'you@firm.com' },
              { label: 'Password', name: 'password', type: 'password', value: form.password, placeholder: 'Create a strong password' },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium mb-1.5 text-[#17201e] dark:text-[#effcf7]">{field.label}</label>
                <input
                  name={field.name}
                  type={field.type}
                  value={field.value}
                  onChange={handleChange}
                  required
                  minLength={field.name === 'password' ? 8 : undefined}
                  className="w-full bg-white dark:bg-[#17201e] border border-[#DDE2E0] dark:border-[#5E6762] rounded-lg px-3.5 py-2.5 text-[#17201e] dark:text-[#effcf7] placeholder-[#8A9490] dark:placeholder-[#6F7975] focus:border-[#315C4C] focus:ring-2 focus:ring-[#315C4C]/15 outline-none transition-all"
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-[#17201e] dark:text-[#effcf7]">I am a</label>
              <select name="role" value={form.role} onChange={handleChange} className="w-full bg-white dark:bg-[#17201e] border border-[#DDE2E0] dark:border-[#5E6762] rounded-lg px-3.5 py-2.5 text-[#17201e] dark:text-[#effcf7] focus:border-[#315C4C] focus:ring-2 focus:ring-[#315C4C]/15 outline-none transition-all">
                <option value="CLIENT">Client / Homeowner</option>
                <option value="ARCHITECT">Architect / Designer</option>
                <option value="VENDOR">Material Vendor / Supplier</option>
              </select>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[#414944] dark:text-[#A8B1AD]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[#315C4C] dark:text-[#A4D2BE] hover:underline">Sign in</Link>
          </div>
        </div>

        <p className="text-center mt-5 text-xs text-[#414944] dark:text-[#A8B1AD]">Your data is protected with industry-standard security.</p>
      </div>
    </div>
  );
}
