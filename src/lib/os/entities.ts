// OS Entity helpers.
//
// An ENTITY is the commissioning organisation. Every party has a
// personal entity auto-created. Businesses/contractors/enterprises get
// non-personal entities that many people join as members.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type EntityTier =
  | "individual"
  | "small_business"
  | "contractor"
  | "enterprise"
  | "public_sector";

export type MemberRole =
  | "owner"
  | "finance"
  | "foreman"
  | "estimator"
  | "viewer"
  | "trade";

export type EntityRecord = {
  id: string;
  tier: EntityTier;
  display_name: string;
  legal_name: string | null;
  companies_house_number: string | null;
  slug: string | null;
  personal_of_party_id: string | null;
  created_at: string;
};

export type MembershipRecord = {
  id: string;
  entity_id: string;
  party_id: string;
  role: MemberRole;
  can_see_financials: boolean;
  scoped_site_ids: string[];
  status: "active" | "paused" | "removed";
  joined_at: string;
  entity: EntityRecord;
};

// Every membership a party holds, resolved to full entity records.
export async function listMembershipsForParty(
  partyId: string
): Promise<MembershipRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("os_entity_members")
    .select(
      "id, entity_id, party_id, role, can_see_financials, scoped_site_ids, status, joined_at, entity:os_entities!inner(*)"
    )
    .eq("party_id", partyId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error || !data) return [];
  return data as unknown as MembershipRecord[];
}

// The party's personal (individual-tier) entity — always exists thanks
// to the trigger + backfill.
export async function getPersonalEntityForParty(
  partyId: string
): Promise<EntityRecord | null> {
  const { data } = await supabaseAdmin
    .from("os_entities")
    .select("*")
    .eq("personal_of_party_id", partyId)
    .maybeSingle();
  return (data as EntityRecord) ?? null;
}

// Load a single entity + the caller's membership + role in it, in one
// resolved shot. Returns null if the party is not a member.
export async function loadMembership(input: {
  entityId: string;
  partyId: string;
}): Promise<MembershipRecord | null> {
  const { data } = await supabaseAdmin
    .from("os_entity_members")
    .select(
      "id, entity_id, party_id, role, can_see_financials, scoped_site_ids, status, joined_at, entity:os_entities!inner(*)"
    )
    .eq("entity_id", input.entityId)
    .eq("party_id", input.partyId)
    .eq("status", "active")
    .maybeSingle();
  return (data as unknown as MembershipRecord) ?? null;
}

// Role hierarchy for `requireEntityRole`. Higher number = more access.
// A role of `owner` (5) satisfies a required role of `foreman` (2).
const ROLE_RANK: Record<MemberRole, number> = {
  trade: 0,
  viewer: 1,
  foreman: 2,
  estimator: 3,
  finance: 4,
  owner: 5
};

export function meetsRole(actual: MemberRole, minimum: MemberRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum];
}

// Convert a raw membership + role check into a strict "yes or no" that
// upstream endpoints can trust.
export function hasFinancialAccess(m: MembershipRecord): boolean {
  return m.can_see_financials || meetsRole(m.role, "finance");
}

// Create a non-personal entity (business, contractor, enterprise).
// Automatically adds the creator as `owner` with financial access.
export async function createBusinessEntity(input: {
  creatorPartyId: string;
  tier: Exclude<EntityTier, "individual">;
  displayName: string;
  legalName?: string;
  companiesHouseNumber?: string;
  postcode?: string;
  city?: string;
}): Promise<EntityRecord | null> {
  const { data: entity, error } = await supabaseAdmin
    .from("os_entities")
    .insert({
      tier: input.tier,
      display_name: input.displayName,
      legal_name: input.legalName ?? null,
      companies_house_number: input.companiesHouseNumber ?? null,
      postcode: input.postcode ?? null,
      city: input.city ?? null
    })
    .select("*")
    .single();
  if (error || !entity) return null;

  await supabaseAdmin.from("os_entity_members").insert({
    entity_id: entity.id,
    party_id: input.creatorPartyId,
    role: "owner",
    can_see_financials: true
  });

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: entity.id,
    actor_party_id: input.creatorPartyId,
    verb: "entity.created",
    after_state: {
      tier: input.tier,
      display_name: input.displayName
    }
  });

  return entity as EntityRecord;
}
