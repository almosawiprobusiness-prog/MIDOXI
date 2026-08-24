import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getSearchIndex } from "@/lib/data/search-index";
import { listNotifications, unreadCount } from "@/lib/data/notifications";
import type { ShellIdentity } from "@/lib/roles/roles";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  /*
    Everything the shell needs, at once.

    These ran one after another — identity, then the search index, then the
    notification bell — and each is its own set of database round trips.
    None of them needs anything from the one before it: they all just need
    to know who is asking, and `getAuthUser()` is request-cached so asking
    four times costs one verification. Sequential here was habit, not
    dependency, and it was the single largest cost in loading any /app page.

    The `.catch` on the last three is unchanged and deliberate: a failed
    search index or an empty bell must not take the whole workspace down.
    `getCurrentUser()` has no catch because without it there is no shell to
    render.
  */
  const [user, searchIndex, notifications, notifUnread] = await Promise.all([
    getCurrentUser(),
    getSearchIndex().catch(() => []),
    listNotifications(30).catch(() => []),
    unreadCount().catch(() => 0),
  ]);

  // Real mode: signed-out users can't reach the app (proxy also enforces this).
  if (!user) redirect("/login");

  // Real mode: finish onboarding before entering the workspace.
  if (!user.isDemo && !user.onboardingComplete) redirect("/onboarding");

  // Only plain data crosses into the client shell.
  const identity: ShellIdentity = {
    role: user.role,
    availableRoles: user.availableRoles,
    lockedRoles: user.lockedRoles,
    displayName: user.displayName,
    identityLine: user.identityLine,
    badge: user.badge,
    isDemo: user.isDemo,
  };

  const dateLabel = new Date()
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();

  return (
    <AppShell identity={identity} dateLabel={dateLabel} searchIndex={searchIndex} notifications={notifications} notifUnread={notifUnread}>
      {children}
    </AppShell>
  );
}
