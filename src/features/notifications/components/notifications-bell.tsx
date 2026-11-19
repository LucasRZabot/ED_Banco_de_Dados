import { listNotifications, unreadNotificationCount } from "../queries";
import type { CurrentUser } from "@/lib/dal";
import { NotificationsMenu } from "./notifications-menu";

export async function NotificationsBell({ user }: { user: CurrentUser }) {
  const [unread, items] = await Promise.all([unreadNotificationCount(user), listNotifications(user, 8)]);
  return (
    <NotificationsMenu
      unread={unread}
      items={items.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        link: n.link,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}
