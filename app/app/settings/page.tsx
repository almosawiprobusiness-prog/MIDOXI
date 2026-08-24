import { Settings, User, ShieldCheck, Globe, Eye, Bell, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getProfileSettings } from "@/lib/data/profile";
import { getEmailOptIn } from "@/lib/data/notifications";
import { isDemoMode, hasEmail } from "@/lib/env";
import { PageHeader } from "@/components/ui/kit";
import { ProfileForm } from "@/components/settings/profile-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { PublicProfileForm } from "@/components/settings/public-profile-form";
import { AccountSecurity, PrivacyToggle } from "@/components/settings/account-security";
import { EmailPreferenceToggle } from "@/components/settings/notification-preferences";
import { DangerZone } from "@/components/settings/danger-zone";

export const metadata = { title: "Settings — MIDO XI" };

const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Football profile", icon: User },
  { id: "account", label: "Account & security", icon: ShieldCheck },
  { id: "public", label: "Public profile", icon: Globe },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy", icon: Eye },
  { id: "data", label: "Data & account", icon: TriangleAlert },
];

function Section({ id, label, icon: Icon, children }: { id: string; label: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-signal-bright" />
        <h2 className="font-display text-base font-semibold text-text-hi">{label}</h2>
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const [profile, emailOptIn] = await Promise.all([getProfileSettings(), getEmailOptIn()]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6">
      <PageHeader icon={Settings} title="Settings" tagline="Your profile, account and data." />

      {isDemoMode && (
        <p className="mb-6 rounded-lg border border-review/30 bg-review/10 px-3 py-2 text-xs text-review">
          Demo mode — changes here won&rsquo;t persist. Connect Supabase to enable real account settings.
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
        {/* Sticky section nav */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-0.5">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-text-dim transition-colors hover:bg-ink-800 hover:text-text"
              >
                <n.icon className="size-4 text-text-faint" />
                {n.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Sections */}
        <div className="space-y-10">
          <Section id="profile" label="Football profile" icon={User}>
            <div className="mb-4">
              <AvatarUpload url={profile.avatarUrl} name={profile.knownAs || profile.fullName} />
            </div>
            <ProfileForm profile={profile} />
          </Section>
          <Section id="account" label="Account & security" icon={ShieldCheck}>
            <AccountSecurity email={profile.email} />
          </Section>
          <Section id="public" label="Public profile & community" icon={Globe}>
            <PublicProfileForm profile={profile} />
          </Section>
          <Section id="notifications" label="Notifications" icon={Bell}>
            <EmailPreferenceToggle initial={emailOptIn} configured={hasEmail} />
          </Section>
          <Section id="privacy" label="Privacy" icon={Eye}>
            <PrivacyToggle initial={profile.isPublic} />
          </Section>
          <Section id="data" label="Data & account" icon={TriangleAlert}>
            <DangerZone />
          </Section>
        </div>
      </div>
    </div>
  );
}
