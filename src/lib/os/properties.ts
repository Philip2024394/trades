// OS Foundation — Property Registry helpers.
//
// Property is the primary key of the entire OS. Any workflow that
// touches a UK address goes through here to find-or-create the
// canonical property row + record the caller's claim.
import "server-only";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

export type PropertyRecord = {
  id: string;
  uprn: number | null;
  address_hash: string;
  address_lines: string[];
  city: string | null;
  postcode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  voa_property_type: string | null;
  bedrooms: number | null;
  built_year: number | null;
  tenure: string | null;
  created_at: string;
};

export type ClaimRole = "owner" | "occupier" | "agent" | "previous_owner";
export type ClaimStatus = "self" | "verified" | "disputed" | "revoked";

export type PropertyClaimRecord = {
  id: string;
  property_id: string;
  party_id: string;
  role: ClaimRole;
  status: ClaimStatus;
  claimed_at: string;
  verified_at: string | null;
};

export function normalisePostcode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidUkPostcode(input: string): boolean {
  return UK_POSTCODE_RE.test(normalisePostcode(input));
}

/** Address hash — canonical form for dedup. Postcode is authoritative;
 *  address lines are normalised (lowercase, collapse whitespace, drop
 *  punctuation) before hashing so "Flat 3, 12 Elm Grove" and
 *  "flat 3 12 elm grove" collide as intended. */
export function computeAddressHash(
  addressLines: string[],
  postcode: string
): string {
  const norm = addressLines
    .filter((l) => l && l.trim().length > 0)
    .map((l) =>
      l
        .toLowerCase()
        .replace(/[,\.]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join("|");
  return createHash("sha256")
    .update(`${normalisePostcode(postcode)}::${norm}`)
    .digest("hex")
    .slice(0, 32);
}

export async function findOrCreateProperty(input: {
  addressLines: string[];
  postcode: string;
  city?: string | null;
  uprn?: number | null;
  actorPartyId?: string | null;
}): Promise<PropertyRecord> {
  const postcode = normalisePostcode(input.postcode);
  if (!isValidUkPostcode(postcode)) {
    throw new Error("Invalid UK postcode");
  }

  // UPRN takes precedence when known — it's the national key.
  if (input.uprn) {
    const { data } = await supabaseAdmin
      .from("os_properties")
      .select("*")
      .eq("uprn", input.uprn)
      .maybeSingle();
    if (data) return data as PropertyRecord;
  }

  const addressHash = computeAddressHash(input.addressLines, postcode);
  const { data: existing } = await supabaseAdmin
    .from("os_properties")
    .select("*")
    .eq("address_hash", addressHash)
    .maybeSingle();
  if (existing) return existing as PropertyRecord;

  const { data: created, error } = await supabaseAdmin
    .from("os_properties")
    .insert({
      uprn: input.uprn ?? null,
      address_hash: addressHash,
      address_lines: input.addressLines,
      city: input.city ?? null,
      postcode
    })
    .select("*")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create property: ${error?.message}`);
  }
  const property = created as PropertyRecord;

  // Record on the timeline (no project_id yet — property claim events
  // sit above projects on the timeline).
  await recordTimelineEvent({
    propertyId: property.id,
    actorPartyId: input.actorPartyId ?? null,
    verb: "property.created",
    subjectType: "property",
    subjectId: property.id,
    headline: `Property added: ${property.address_lines.join(", ") || property.postcode}`,
    payload: { postcode: property.postcode, uprn: property.uprn }
  });

  return property;
}

export async function claimProperty(input: {
  propertyId: string;
  partyId: string;
  role: ClaimRole;
  status?: ClaimStatus;
}): Promise<PropertyClaimRecord> {
  // Reuse existing active claim if present
  const { data: existing } = await supabaseAdmin
    .from("os_property_claims")
    .select("*")
    .eq("property_id", input.propertyId)
    .eq("party_id", input.partyId)
    .eq("role", input.role)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) return existing as PropertyClaimRecord;

  const { data: created, error } = await supabaseAdmin
    .from("os_property_claims")
    .insert({
      property_id: input.propertyId,
      party_id: input.partyId,
      role: input.role,
      status: input.status ?? "self"
    })
    .select("*")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create claim: ${error?.message}`);
  }
  const claim = created as PropertyClaimRecord;

  await recordTimelineEvent({
    propertyId: input.propertyId,
    actorPartyId: input.partyId,
    verb: "property.claimed",
    subjectType: "property",
    subjectId: input.propertyId,
    headline: `Property claimed (${input.role})`,
    payload: { role: input.role, status: claim.status }
  });

  return claim;
}

export async function listClaimsForParty(partyId: string) {
  const { data } = await supabaseAdmin
    .from("os_property_claims")
    .select(
      "id, role, status, claimed_at, verified_at, os_properties!inner(id, address_lines, city, postcode, uprn, voa_property_type, bedrooms, tenure)"
    )
    .eq("party_id", partyId)
    .is("revoked_at", null)
    .order("claimed_at", { ascending: false });
  return data || [];
}
