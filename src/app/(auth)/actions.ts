"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { bootstrapSecretMatches, configuredBootstrapSecret } from "@/lib/bootstrap-secret";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/password";
import { loginLimiter } from "@/lib/rate-limit";
import { homePathFor } from "@/lib/roles";

/**
 * Entrar, trocar senha e sair devolvem `redirectTo` em vez de chamar `redirect()`: o cliente faz
 * navegação completa, porque o redirect de server action entre os grupos (auth) e (app) deixa a
 * rota nova montada oculta (Activity do Cache Components) e a antiga visível.
 */
export type FormState =
  | { error?: string; fieldErrors?: Record<string, string[] | undefined>; redirectTo?: string }
  | undefined;

/** Usa só caminho + query do `callbackUrl` (a origem é descartada), evitando open redirect. */
function safeRedirectPath(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return "/";
  try {
    const url = new URL(raw, "http://interno");
    const path = `${url.pathname}${url.search}`;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login") ? path : "/";
  } catch {
    return "/";
  }
}

const INVALID_LOGIN = "E-mail ou senha inválidos, ou conta desativada.";

const bootstrapSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome completo.").max(120),
    email: z.email("E-mail inválido.").transform((v) => v.trim().toLowerCase()),
    password: passwordSchema,
    confirmPassword: z.string(),
    setupSecret: z.string().min(1, "Informe o código de setup da TI."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  });

/** Só quando o banco não tem nenhum usuário: TI completa o setup com BOOTSTRAP_SECRET. */
export async function bootstrapFirstAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!loginLimiter.take("bootstrap")) {
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  }
  if (!configuredBootstrapSecret()) {
    return { error: "Setup bloqueado. A TI precisa configurar BOOTSTRAP_SECRET no host." };
  }
  const parsed = bootstrapSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (!bootstrapSecretMatches(parsed.data.setupSecret)) {
    return { error: "Código de setup inválido." };
  }

  try {
    await db.$transaction(async (tx) => {
      if ((await tx.user.count()) > 0) {
        throw new Error("ALREADY_BOOTSTRAPPED");
      }
      await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          role: "ADMIN",
          passwordHash: await hashPassword(parsed.data.password),
          mustChangePassword: false,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_BOOTSTRAPPED") {
      return { error: "Já existe usuário. Entre com a conta da TI." };
    }
    throw err;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) return { redirectTo: "/login" };
    throw err;
  }
  return { redirectTo: homePathFor("ADMIN") };
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!loginLimiter.take(`login:${email || "empty"}`)) {
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  }
  try {
    const url: string = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    if (url && new URL(url, "http://interno").searchParams.has("error")) return { error: INVALID_LOGIN };
  } catch (err) {
    if (err instanceof AuthError) return { error: INVALID_LOGIN };
    throw err;
  }
  return { redirectTo: safeRedirectPath(formData.get("callbackUrl")) };
}

export async function logout(): Promise<FormState> {
  await signOut({ redirect: false });
  return { redirectTo: "/login" };
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem.",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da atual.",
  });

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser({ allowPendingPassword: true });
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.currentPassword, record.passwordHash))) {
    return { fieldErrors: { currentPassword: ["Senha atual incorreta."] } };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false },
  });
  return { redirectTo: homePathFor(user.role) };
}
