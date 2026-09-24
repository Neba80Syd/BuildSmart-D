import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { dbClient } from "./db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The app is served through the Arena/e2b preview proxy, which terminates
  // TLS and forwards requests as http to localhost. Auth.js would otherwise
  // detect `https` (from X-Forwarded-Proto) and switch to `__Host-`/`__Secure-`
  // prefixed, `Secure`-only cookies — which break the CSRF round-trip through
  // the proxy and cause "MissingCSRF" on every login. Force non-secure cookie
  // mode so cookie names are consistent behind the proxy.
  useSecureCookies: false,
  // Trust the forwarded Host header so URLs resolve to the preview host.
  trustHost: true,
  // Auth.js requires a secret to sign/verify JWTs. In dev/preview the changeable
  // dev secret below keeps sign-in working without an .env file; production
  // deployments should still set AUTH_SECRET explicitly.
  secret: process.env.AUTH_SECRET || "buildsmart-ai-dev-secret-change-me-in-production",
  session: { strategy: "jwt" },
  basePath: "/api/auth",
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        }).safeParse(credentials)

        if (!parsed.success) return null

        const user: any = await dbClient.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Keep relative URLs relative so they resolve against the browser's
      // current origin (the Arena/e2b preview host) — never hardcode an origin
      // like http://localhost:3000, which the user's browser cannot reach.
      if (url.startsWith("/")) return url
      // Allow same-origin absolute URLs (open-redirect protection).
      if (new URL(url).origin === baseUrl) return url

      // Fallback to the role router.
      return "/auth/redirect"
    },
  },
})

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
    }
  }
}
