import { PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/kit";
import { SectionHeader } from "@/components/ui/primitives";
import { listDeliverables } from "@/lib/data/deliverables";
import { getClubBrand } from "@/lib/data/brand";
import { needsAttention } from "@/lib/data/deliverable-types";
import { requireRole, viewingFromOtherOs } from "@/lib/auth/guard";
import { ROLES } from "@/lib/roles/roles";
import { OsNotice } from "@/components/shell/os-notice";
import { DeliveryQueue } from "@/components/managed/delivery-queue";
import { BrandPanel } from "@/components/managed/brand-panel";
import { ClubHeader } from "@/components/brand/club-header";

export const metadata = { title: "Delivery — MIDO XI" };

/*
  MIDO MANAGED — the operator's desk.

  Two things live here because they are two halves of one promise: work goes
  out in the client's identity (the panel), and nothing goes out that a person
  has not read (the queue).

  This page shows EVERYTHING, including drafts — it is the inside of the
  operation. Anything the client sees goes through `listForClient()` instead,
  which filters on `canClientSee`. The two reads are separate functions so
  that using the wrong one is visible in a diff rather than silent.
*/
export default async function DeliveryPage() {
  /*
    Delivery is a Club OS surface. `requireRole` is the entitlement gate — an
    account whose plan does not open Club is sent away rather than shown the
    queue. Being in another system is not a refusal, only a disorientation,
    so that is answered with a notice rather than a redirect.
  */
  const user = await requireRole("club");
  const elsewhere = viewingFromOtherOs(user, "club");

  const [items, brand] = await Promise.all([listDeliverables(), getClubBrand()]);
  const open = items.filter((d) => needsAttention(d.status)).length;
  const sample = items[0];

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6">
      {elsewhere && <OsNotice role="club" label={ROLES.club.label} />}

      <PageHeader
        icon={PackageCheck}
        title="Delivery"
        tagline={
          open === 0
            ? "Nothing waiting on you."
            : `${open} ${open === 1 ? "item is" : "items are"} waiting on you.`
        }
      />

      <section className="mb-8">
        <SectionHeader label="The queue" />
        <p className="mb-3 text-xs leading-relaxed text-text-faint">
          Everything drafted for this client, and where it has got to. Work can only reach them
          through <span className="text-text-dim">approved</span> — there is no path from a draft
          straight to the client.
        </p>
        <DeliveryQueue items={items} />
      </section>

      <section className="mb-8">
        <SectionHeader label="Identity" />
        <BrandPanel
          initial={{
            name: brand.isDefault ? "" : brand.name,
            shortName: brand.isDefault ? "" : brand.shortName,
            crestUrl: brand.crestUrl ?? "",
            primary: brand.isDefault ? "" : brand.primary,
          }}
        />
      </section>

      <section>
        <SectionHeader label="How a document arrives" />
        <p className="mb-3 text-xs leading-relaxed text-text-faint">
          The masthead every delivered document carries, as it looks right now.
        </p>
        <div className="panel p-5">
          <ClubHeader
            brand={brand}
            title={sample?.title ?? "Session plan"}
            meta="Prepared this week"
          />
        </div>
      </section>
    </div>
  );
}
