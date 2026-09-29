// BuildSmart AI — real authenticated session identity.
//
// `resolveUser` in `lib/preview.ts` intentionally falls back to a demo identity
// so the role dashboards remain usable while authentication is in preview mode.
// Checkout/private flows must never fall back to that demo identity, so this
// helper returns only a real Auth.js session (or null when the visitor is not
// authenticated).
import { auth } from "./auth";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "CLIENT" | "ARCHITECT" | "VENDOR" | "ADMIN";
};

export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (session?.user) {
    return {
      id: (session.user as any).id ?? "",
      name: session.user.name ?? "User",
      email: session.user.email ?? "",
      role: ((session.user as any).role ?? "CLIENT") as AuthenticatedUser["role"],
    };
  }

  return null;
}

