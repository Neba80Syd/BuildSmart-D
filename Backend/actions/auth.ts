'use server';

import { signIn, signOut } from '@/Backend/lib/auth';
import { AuthError } from 'next-auth';

export type AuthActionState = { error: string | null };

/**
 * Server Action login.
 *
 * This is the robust login path for the preview environment:
 *  - It runs fully on the server (server-side `signIn` from next-auth).
 *  - It bypasses CSRF (server-side signIn uses `skipCSRFCheck` internally),
 *    so it does not depend on the CSRF cookie round-tripping through the proxy.
 *  - It sets the session cookie directly via the Next.js `cookies()` API.
 *  - On success it calls Next.js `redirect('/auth/redirect')`, which resolves
 *    the role and sends the browser to the correct dashboard.
 */
export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.' };
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: '/auth/redirect',
    });
    // signIn() throws NEXT_REDIRECT on success, so we never reach this line.
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid email or password' };
    }
    // Re-throw the NEXT_REDIRECT (success redirect) and unexpected errors.
    throw error;
  }
}

/**
 * Server Action sign-out. Sets cookies server-side and redirects to home.
 */
export async function signoutAction() {
  await signOut({ redirectTo: '/' });
}
