import { NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  PREVIEW MODE — authentication is TEMPORARILY DISABLED so the role
//     dashboards can be previewed without logging in (per user request).
//
//     To re-enable auth: restore the auth-wrapped proxy (login redirect
//     + role-based route protection) — see the previous version in git
//     history (`git show 3e64f5c:middleware.ts`).
// ═══════════════════════════════════════════════════════════════════════════
export default function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
