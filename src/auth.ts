import "@/lib/auth-host";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.email().transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

class InvalidLogin extends CredentialsSignin {
  code = "invalid_credentials";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Mantido para provedores OAuth futuros (ex.: Entra ID); com Credentials + JWT não cria sessões no banco.
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidLogin();

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, role: true, active: true, passwordHash: true },
        });
        const ok = await verifyPassword(parsed.data.password, user?.passwordHash);
        if (!user || !ok || !user.active) throw new InvalidLogin();

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
});
