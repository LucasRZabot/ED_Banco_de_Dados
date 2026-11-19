import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markAllNotificationsRead } from "@/features/notifications/actions";
import { NotificationRow } from "@/features/notifications/components/notification-row";
import { listNotifications } from "@/features/notifications/queries";
import { requireRole } from "@/lib/dal";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const user = await requireRole("FINANCEIRO", "REQUESTER");
  const items = await listNotifications(user, 50);

  return (
    <>
      <PageHeader
        title="Notificações"
        actions={
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline">
              Marcar todas como lidas
            </Button>
          </form>
        }
      />
      <Card className="divide-y py-0">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma notificação.</p>
        ) : (
          items.map((n) => (
            <NotificationRow
              key={n.id}
              id={n.id}
              title={n.title}
              message={n.message}
              link={n.link}
              createdAt={n.createdAt.toISOString()}
              unread={!n.readAt}
            />
          ))
        )}
      </Card>
    </>
  );
}
