import type { NextAuthConfig } from "next-auth";
import { homePathFor, type AppRole } from "@/lib/roles";

const PUBLIC_PATHS = ["/login"];
const ADMIN_PREFIXES = ["/dashboard", "/admin", "/orcamentos", "/notas-fiscais", "/boletos", "/contratos"];

const maxAgeHours = Number(process.env.AUTH_SESSION_MAX_AGE_HOURS ?? 10);

/**
 * Configuração sem Prisma/bcrypt, usada pelo proxy. O proxy só faz o redirecionamento grosso
 * a partir do JWT; a autorização de verdade é refeita no servidor (lib/dal.ts) contra o banco.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: maxAgeHours * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const role = auth?.user?.role as AppRole | undefined;

      if (PUBLIC_PATHS.some((p) => pathname === p)) return true;
      if (!auth?.user) return false;

      if (pathname === "/") return Response.redirect(new URL(homePathFor(role), nextUrl));
      if (role !== "ADMIN" && ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return Response.redirect(new URL(homePathFor(role), nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
