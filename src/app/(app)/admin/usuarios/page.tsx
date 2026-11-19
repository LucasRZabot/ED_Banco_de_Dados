import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { CreateUserButton, UserRowActions } from "./user-dialogs";

export const metadata: Metadata = { title: "Usuários" };

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: process.env.APP_TIMEZONE ?? "America/Sao_Paulo",
});

export default async function UsersPage() {
  const admin = await requireAdmin();
  const [users, sectors] = await Promise.all([
    db.user.findMany({
      orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        lastLoginAt: true,
        sectorId: true,
        sector: { select: { name: true } },
      },
    }),
    db.sector.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, costCenter: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Contas são criadas somente aqui. O administrador não acessa chamados nem lançamentos."
        actions={<CreateUserButton sectors={sectors} />}
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={u.active ? undefined : "text-muted-foreground"}>
                <TableCell>
                  <div className="font-medium">{u.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "REQUESTER" ? "outline" : u.role === "ADMIN" ? "default" : "secondary"}>
                    {u.role === "ADMIN" ? "Administrador" : u.role === "FINANCEIRO" ? "Financeiro" : "Chefia"}
                  </Badge>
                </TableCell>
                <TableCell>{u.sector?.name ?? "—"}</TableCell>
                <TableCell className="space-x-1">
                  <Badge variant={u.active ? "outline" : "destructive"}>{u.active ? "Ativo" : "Inativo"}</Badge>
                  {u.mustChangePassword ? <Badge variant="outline">Senha provisória</Badge> : null}
                </TableCell>
                <TableCell className="tabular-nums">
                  {u.lastLoginAt ? dateTime.format(u.lastLoginAt) : "Nunca"}
                </TableCell>
                <TableCell>
                  <UserRowActions
                    user={{ id: u.id, name: u.name, email: u.email, role: u.role, sectorId: u.sectorId, active: u.active }}
                    sectors={sectors}
                    isSelf={u.id === admin.id}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
