import { Link2, ShieldCheck, Info } from "lucide-react";
import { listMyConnections } from "@/lib/data/connections";
import { SHARE_SCOPES } from "@/lib/data/connection-types";
import { isDemoMode } from "@/lib/env";
import { PageHeader } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { DemoNote } from "@/components/dashboards/shared";
import { JoinForm } from "@/components/connections/join-form";
import { ConnectionCard } from "@/components/connections/connection-card";

export const metadata = { title: "Connections — MIDO XI" };

export default async function ConnectionsPage() {
  const connections = await listMyConnections();

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      <PageHeader
        icon={Link2}
        title="Connections"
        tagline="Who you are linked to, and exactly what they can see."
      />

      <section className="mb-8">
        <JoinForm />
      </section>

      <section className="mb-8">
        <SectionHeader label={`Linked to you · ${connections.length}`} />
        {connections.length ? (
          <div className="space-y-2">
            {connections.map((c) => (
              <ConnectionCard key={c.id} connection={c} />
            ))}
          </div>
        ) : (
          <div className="panel p-5">
            <p className="text-sm leading-relaxed text-text-dim">
              Nobody is linked to your account. Your matches, development map, studies, clips and
              check-ins are visible only to you.
            </p>
          </div>
        )}
      </section>

      <section>
        <SectionHeader label="How sharing works" />
        <div className="panel overflow-hidden">
          <div className="flex items-start gap-3 border-b border-line p-5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info" />
            <p className="text-sm leading-relaxed text-text-dim">
              You choose the level when you accept an invitation, and you can change it or disconnect
              here at any time. The level is enforced in the database — a coach cannot widen their own
              access, and disconnecting removes it immediately.
            </p>
          </div>
          <dl className="divide-y divide-line">
            {SHARE_SCOPES.map((s) => (
              <div key={s.value} className="p-5">
                <dt className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-hi">{s.label}</span>
                  <span className="label-tech" style={{ color: s.color }}>
                    {s.value}
                  </span>
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-text-dim">{s.summary}</dd>
                <dd className="mt-2 flex flex-wrap gap-1.5">
                  {s.opens.map((o) => (
                    <span key={o} className="chip chip-prose">
                      {o}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-line p-5 text-[11px] leading-relaxed text-text-faint">
            Nothing you study is ever shared. Your study history, quiz results and the notes you write
            about your own game stay yours at every level.
          </p>
        </div>
      </section>

      <p className="mt-8 flex items-start justify-center gap-2 text-center text-[11px] leading-relaxed text-text-faint">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Coaches, trainers and clubs keep their own notes about you regardless. Linking decides what of{" "}
        <span className="text-text-dim">yours</span> they can read.
      </p>

      {isDemoMode && (
        <DemoNote>
          Demo mode is a single identity, so a code you issue can be redeemed here to walk the flow
          through. With a backend the two sides are different accounts.
        </DemoNote>
      )}
    </div>
  );
}
