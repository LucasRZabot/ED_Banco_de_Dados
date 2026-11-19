import Link from "next/link";
import { NotificationRow } from "@/features/notifications/components/notification-row";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SEVERITY_CLASS = {
  CRITICAL: "border-l-4 border-l-red-500",
  WARNING: "border-l-4 border-l-amber-500",
  INFO: "border-l-4 border-l-emerald-500",
} as const;

export function DashboardNotifications({
  items,
}: {
  items: {
    id: string;
    title: string;
    message: string;
    link: string | null;
    createdAt: Date;
    readAt: Date | null;
    severity: "INFO" | "WARNING" | "CRITICAL";
  }[];
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>Alertas da coordenação: vermelho crítico, amarelo atenção, verde informativo.</CardDescription>
        </div>
        <Link href="/notificacoes" className="text-sm text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      {items.length === 0 ? (
        <p className="px-6 pb-5 text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
      ) : (
        <div className="divide-y">
          {items.map((n) => (
            <div key={n.id} className={cn(SEVERITY_CLASS[n.severity], !n.readAt && "bg-muted/20")}>
              <NotificationRow
                id={n.id}
                title={n.title}
                message={n.message}
                link={n.link}
                createdAt={n.createdAt.toISOString()}
                unread={!n.readAt}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
