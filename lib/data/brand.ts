import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { currentOrgId } from "./club";
import { normalizeHex, toBrand, type ClubBrand } from "@/lib/brand/identity";

/*
  The client's identity, read and written.

  Composition lives in `lib/brand/identity.ts` — pure, client-safe, shared with
  the settings form. This file only fetches the row and hands it over, so there
  is exactly one place that decides what a brand IS.
*/

export interface BrandInput {
  name: string;
  shortName: string;
  crestUrl: string;
  primary: string;
}

/*
  Demo brand, held on globalThis like the other demo stores.

  Navy on purpose. #1b3a6b is a real club colour and it fails contrast against
  MIDO's ink — so the demo exercises the derivation in `readableOn` rather than
  quietly picking a colour that was always going to be legible.
*/
const g = globalThis as unknown as { __midoBrandDemo?: BrandInput };
const demoBrand: BrandInput = (g.__midoBrandDemo ??= {
  name: "Northgate FC",
  shortName: "Northgate",
  crestUrl: "",
  primary: "#1b3a6b",
});

export async function getClubBrand(): Promise<ClubBrand> {
  if (isDemoMode) return toBrand(demoBrand);

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return toBrand(null);

  const { data } = await supabase
    .from("organizations")
    .select("name, short_name, crest_url, brand_primary")
    .eq("id", orgId)
    .maybeSingle();
  if (!data) return toBrand(null);

  return toBrand({
    name: data.name as string,
    shortName: data.short_name as string | null,
    crestUrl: data.crest_url as string | null,
    primary: data.brand_primary as string | null,
  });
}

/**
 * Save the identity.
 *
 * A colour that will not parse is stored as null rather than as itself: the
 * brand then falls back to MIDO's accent, which renders, instead of putting a
 * broken value into every document the client receives.
 */
export async function saveClubBrand(input: BrandInput): Promise<boolean> {
  const name = input.name.trim();
  if (!name) return false;
  const primary = normalizeHex(input.primary);

  if (isDemoMode) {
    demoBrand.name = name;
    demoBrand.shortName = input.shortName.trim();
    demoBrand.crestUrl = input.crestUrl.trim();
    demoBrand.primary = primary ?? "";
    return true;
  }

  const supabase = await createClient();
  const orgId = await currentOrgId();
  if (!supabase || !orgId) return false;

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      short_name: input.shortName.trim() || null,
      crest_url: input.crestUrl.trim() || null,
      brand_primary: primary,
    })
    .eq("id", orgId);
  return !error;
}

/**
 * A named organization's identity, for a reader who is not signed in.
 *
 * Only ever called after a delivery token has resolved — the token is the
 * authorisation, and the org id comes from the resolved row rather than from
 * anything the reader supplied. Returns MIDO's own brand when the club has set
 * none, so a delivered document always has a masthead.
 */
export async function brandForOrg(orgId: string): Promise<ClubBrand> {
  if (isDemoMode) return toBrand(demoBrand);

  const admin = createAdminClient();
  if (!admin) return toBrand(null);

  const { data } = await admin
    .from("organizations")
    .select("name, short_name, crest_url, brand_primary")
    .eq("id", orgId)
    .maybeSingle();
  if (!data) return toBrand(null);

  return toBrand({
    name: data.name as string,
    shortName: data.short_name as string | null,
    crestUrl: data.crest_url as string | null,
    primary: data.brand_primary as string | null,
  });
}
