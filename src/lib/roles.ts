// Sem dependência do Prisma: usado também no proxy e em Client Components.
export const ROLES = ["ADMIN", "FINANCEIRO", "REQUESTER"] as const;
export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Administrador (TI)",
  FINANCEIRO: "Financeiro",
  REQUESTER: "Chefia de setor",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  ADMIN: "Gerencia usuários e setores. Não acessa chamados nem lançamentos.",
  FINANCEIRO: "Avalia chamados e lança NFs, boletos, contratos e orçamentos. Não gerencia usuários.",
  REQUESTER: "Abre chamados e envia notas do próprio setor. Vê somente o que ela mesma enviou.",
};

/** Quem acessa cada área. Usado pelo proxy (redirecionamento) e pela sidebar. */
export const ROUTE_ACCESS: { prefix: string; roles: readonly AppRole[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard", roles: ["FINANCEIRO"] },
  { prefix: "/orcamentos", roles: ["FINANCEIRO"] },
  { prefix: "/notas-fiscais", roles: ["FINANCEIRO", "REQUESTER"] },
  { prefix: "/boletos", roles: ["FINANCEIRO"] },
  { prefix: "/contratos", roles: ["FINANCEIRO"] },
  { prefix: "/chamados", roles: ["FINANCEIRO", "REQUESTER"] },
  { prefix: "/notificacoes", roles: ["FINANCEIRO", "REQUESTER"] },
];

export function canAccessPath(role: AppRole | undefined, pathname: string) {
  const rule = ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return !rule || (!!role && rule.roles.includes(role));
}

export function homePathFor(role: AppRole | undefined) {
  if (role === "ADMIN") return "/admin/usuarios";
  if (role === "FINANCEIRO") return "/dashboard";
  return "/chamados";
}
