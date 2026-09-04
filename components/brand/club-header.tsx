import { attribution, type ClubBrand } from "@/lib/brand/identity";

/*
  The masthead a Managed deliverable wears.

  Server-safe — no state, no effects — so it can sit at the top of a report
  that renders on the server and prints.

  TWO RULES IT KEEPS.

  The colour is used TWICE and differently: `primary` raw for the rule and the
  crest backing, where it is a shape and any colour works; `primaryReadable`
  for anything that is read. That is the whole reason `lib/brand/identity.ts`
  derives a second value — a navy club still gets navy on the rule, and still
  gets legible text.

  And the byline is not optional. The document looks like the club's, which is
  what the tier sells; the small line that says who prepared it is what keeps
  that from being a lie.
*/

export function ClubHeader({
  brand,
  title,
  meta,
}: {
  brand: ClubBrand;
  /** What this document is — "MD-3 · Defending transitions". */
  title: string;
  /** A short factual line: date, opponent, age group. */
  meta?: string;
}) {
  const { title: clubName, byline } = attribution(brand);
  const initials = brand.shortName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <header className="border-b pb-5" style={{ borderColor: brand.primary }}>
      <div className="flex items-start gap-3.5">
        {brand.crestUrl ? (
          /* A plain <img>: a club crest is an arbitrary external URL, and
             next/image would need every client's host allow-listed. */
          <img
            src={brand.crestUrl}
            alt=""
            className="size-11 shrink-0 rounded-md object-contain"
            style={{ background: brand.primary }}
          />
        ) : (
          <div
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-white"
            style={{ background: brand.primary }}
          >
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div
            className="font-display text-lg font-semibold leading-tight"
            style={{ color: brand.primaryReadable }}
          >
            {clubName}
          </div>
          <h1 className="mt-0.5 font-display text-2xl font-bold leading-tight text-text-hi">
            {title}
          </h1>
          {meta && <div className="label-tech mt-1.5">{meta}</div>}
        </div>
      </div>

      {/* Never omitted. See the note above. */}
      <p className="mt-4 text-[11px] leading-relaxed text-text-faint">{byline}</p>
    </header>
  );
}
