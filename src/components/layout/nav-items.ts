import {
  Banknote,
  ClipboardList,
  FileSignature,
  FileText,
  LayoutDashboard,
  Receipt,
  Building,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/roles";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: readonly AppRole[];
  /** Módulo ainda não implementado: aparece desabilitado com selo "Em breve". */
  soon?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Geral",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
      { title: "Chamados", href: "/chamados", icon: ClipboardList, roles: ["ADMIN", "REQUESTER"] },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { title: "Orçamentos", href: "/orcamentos", icon: FileText, roles: ["ADMIN"], soon: true },
      { title: "Notas Fiscais", href: "/notas-fiscais", icon: Receipt, roles: ["ADMIN"], soon: true },
      { title: "Boletos", href: "/boletos", icon: Banknote, roles: ["ADMIN"], soon: true },
      { title: "Contratos", href: "/contratos", icon: FileSignature, roles: ["ADMIN"], soon: true },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Usuários", href: "/admin/usuarios", icon: Users, roles: ["ADMIN"] },
      { title: "Setores", href: "/admin/setores", icon: Building, roles: ["ADMIN"] },
    ],
  },
];

export function navGroupsFor(role: AppRole) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );
}

export function titleForPath(pathname: string) {
  const all = NAV_GROUPS.flatMap((g) => g.items);
  const match = all
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.title ?? "";
}
