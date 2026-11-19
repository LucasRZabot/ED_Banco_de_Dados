import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { CreateSectorForm, ToggleSectorButton } from "./sector-forms";

export const metadata: Metadata = { title: "Setores" };

export default async function SectorsPage() {
  await requireAdmin();
  const sectors = await db.sector.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      users: { where: { role: "REQUESTER", active: true }, select: { name: true, email: true } },
    },
  });

  return (
    <>
      <PageHeader title="Setores" description="Setores e centros de custo usados em chamados, notas e boletos." />
      <Card>
        <CardContent>
          <CreateSectorForm />
        </CardContent>
      </Card>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Centro de custo</TableHead>
              <TableHead>Chefias</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectors.map((s) => (
              <TableRow key={s.id} className={s.active ? undefined : "text-muted-foreground"}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-mono text-xs">{s.costCenter}</TableCell>
                <TableCell className="text-sm">
                  {s.users.length ? s.users.map((u) => u.name ?? u.email).join(", ") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={s.active ? "outline" : "destructive"}>{s.active ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <ToggleSectorButton id={s.id} active={s.active} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
