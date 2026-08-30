import { BellOff } from "lucide-react";
import { listNotifications } from "@/lib/data/notifications";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata = { title: "Notifications — MIDO XI" };

export default async function NotificationsPage() {
  const items = await listNotifications(100);

  return (
    <div className="mx-auto max-w-[640px] px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-hi">Notifications</h1>
        <p className="mt-1 text-sm text-text-dim">Everything somebody else&rsquo;s action put in front of you.</p>
      </header>

      {items.length === 0 ? (
        <div className="panel px-6 py-14 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-lg border border-line bg-ink-850 text-text-faint">
            <BellOff className="size-5" />
          </span>
          <p className="mt-3 text-sm text-text-dim">Quiet — nobody needs you right now.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-text-faint">
            Coach feedback, meeting invites, replies and shares land here the moment
            somebody else acts. Connect with your coach or squad and this page starts working.
          </p>
        </div>
      ) : (
        <NotificationList items={items} showMarkAll />
      )}
    </div>
  );
}
