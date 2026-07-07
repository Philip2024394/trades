// Active-entity session layer.
//
// A party may belong to multiple entities (their personal one + several
// business ones). We store the currently-active entity in a cookie
// (`xrated_active_entity`). Server components can call
// `loadActiveEntity()` to resolve the party's current context.
import "server-only";
import { cookies } from "next/headers";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import {
  getPersonalEntityForParty,
  loadMembership,
  listMembershipsForParty,
  meetsRole,
  type MembershipRecord,
  type MemberRole
} from "@/lib/os/entities";

export const ACTIVE_ENTITY_COOKIE = "xrated_active_entity";

const ACTIVE_ENTITY_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 90 // 90 days
};

// Best-effort resolution: cookie wins if it names an entity the party
// is still an active member of; otherwise fall back to the party's
// personal entity.
export async function loadActiveMembership(): Promise<MembershipRecord | null> {
  const party = await loadHomeownerSession();
  if (!party) return null;

  const jar = await cookies();
  const cookieEntityId = jar.get(ACTIVE_ENTITY_COOKIE)?.value;

  if (cookieEntityId) {
    const m = await loadMembership({ entityId: cookieEntityId, partyId: party.id });
    if (m) return m;
  }

  const personal = await getPersonalEntityForParty(party.id);
  if (!personal) return null;
  return loadMembership({ entityId: personal.id, partyId: party.id });
}

export async function requireActiveMembership(): Promise<MembershipRecord> {
  const m = await loadActiveMembership();
  if (!m) {
    throw new Error("Not authenticated / no active entity");
  }
  return m;
}

export async function requireEntityRole(
  minimum: MemberRole
): Promise<MembershipRecord> {
  const m = await requireActiveMembership();
  if (!meetsRole(m.role, minimum)) {
    throw new Error(`Requires role >= ${minimum}, have ${m.role}`);
  }
  return m;
}

// List every entity this party can act as, for the switcher UI.
export async function listEntitiesForSwitch(): Promise<MembershipRecord[]> {
  const party = await loadHomeownerSession();
  if (!party) return [];
  return listMembershipsForParty(party.id);
}

// Server-action-safe cookie setter — call from a route handler.
export async function setActiveEntityCookie(entityId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_ENTITY_COOKIE, entityId, ACTIVE_ENTITY_COOKIE_OPTIONS);
}

export async function clearActiveEntityCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_ENTITY_COOKIE, "", { ...ACTIVE_ENTITY_COOKIE_OPTIONS, maxAge: 0 });
}
