import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getSearchIndex } from "@/lib/data/search-index";
import type { ShellIdentity } from "@/lib/roles/roles";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();

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

  /*
    The command bar searches the user's own matches, clips and goals. It is
    built here rather than fetched on keystroke — a round trip in front of every
    character typed into the fastest surface in the product would defeat it.
    A failure here must not take the workspace down with it.
  */
  const searchIndex = await getSearchIndex().catch(() => []);

  const dateLabel = new Date()
    .toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();

  return (
    <AppShell identity={identity} dateLabel={dateLabel} searchIndex={searchIndex}>
      {children}
    </AppShell>
  );
}
