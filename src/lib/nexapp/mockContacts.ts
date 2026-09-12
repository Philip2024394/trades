// NEX Contacts · mock data for the visual pass.
//
// Backend-agnostic mock so the Contacts panel can be built, tuned and
// signed-off visually WITHOUT the NEX-to-NEX messaging infrastructure
// (server-backed accounts · shared rooms · presence · routing) which
// is Priority 4+ per pinned `project_nex_four_corners_functional_model`.
//
// When that infrastructure lands: replace `MOCK_CONTACTS` + `MOCK_GROUPS`
// with hooks/APIs backed by the real system. Types + helpers stay the
// same — the UI never has to know the difference.
//
// Avatar strategy (Philip 2026-08-21 · confirmed): mix of real photos
// via pravatar.cc (`avatarUrl` present) + generated initial avatars
// (`avatarUrl` absent · component falls back to name-initial-on-orange).
// Proves both states side-by-side in the mock.

export type ContactStatus = "online" | "offline" | "typing";

export type MockContact = {
  id: string;                    // internal only
  publicNexId: string;           // NEX-XXXX-XXXX shareable identifier
  name: string;
  avatarUrl?: string;            // undefined → generated initial avatar
  status: ContactStatus;
  lastMessage: string;
  lastActivityAt: string;        // ISO timestamp
  unread: number;                // 0 = no badge
  blocked?: boolean;
};

export type MockGroup = {
  id: string;
  name: string;
  avatarUrl?: string;
  memberIds: string[];           // → resolve into MockContact[] for display
  lastSender: string;            // display name of last message sender
  lastMessage: string;
  lastActivityAt: string;
  unread: number;
};

// ── Business contacts · Philip 2026-09-05 · M0 slice ──────────────────
// Business Contacts live as a SECTION inside the same NEX Contacts list
// (per one-unified-contacts-list doctrine · not a separate destination).
// Tap → same universal NEX Chat surface used by personal contacts.
// Category/location surface where personal contacts would show
// last-message/time · same visual rhythm · different metadata.
// Japan is a first-class NEX market from Day 1 (per Japan doctrine).
// PT Fresh on Time Seafood = primary NEX Business demonstration business
// (per Business/Marketing doctrine · demo only · never real customer
// without explicit agreement).

export type MockBusinessContact = {
  id: string;
  publicNexId: string;           // NEX-XXXX-XXXX shareable identifier
  name: string;
  avatarUrl?: string;            // undefined → generated initial avatar (logo tile)
  category: string;              // e.g. "Seafood · International Trade"
  location: string;              // e.g. "Tokyo, Japan"
  lastInteractionAt?: string;    // ISO · optional · absent = "no interactions yet"
  favorite?: boolean;
};

export const MOCK_BUSINESS_CONTACTS: readonly MockBusinessContact[] = [
  {
    id: "biz-fresh-on-time-seafood",
    publicNexId: "NEX-FOT9-S3AF",
    name: "PT Fresh on Time Seafood",
    category: "Seafood · International Trade",
    location: "Indonesia",
    lastInteractionAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),   // 3h
    favorite: true,
  },
  {
    id: "biz-bali-seafood-export",
    publicNexId: "NEX-BSE4-XP07",
    name: "Bali Seafood Export",
    category: "Seafood Export",
    location: "Bali, Indonesia",
    lastInteractionAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),  // 1d+
  },
  {
    // Japan-first-class demo · Japanese business name variant available for
    // future bilingual display · M0 renders the Latin name only, but the
    // layout is designed to safely render Japanese characters (敬語 register
    // for business context lands in a later slice).
    id: "biz-tokyo-foods",
    publicNexId: "NEX-TKY0-F00D",
    name: "Tokyo Foods",
    category: "Food Import · Distribution",
    location: "Tokyo, Japan",
    lastInteractionAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),   // 2h
  },
  {
    id: "biz-jakarta-trading",
    publicNexId: "NEX-JKT5-TRD1",
    name: "Jakarta Trading",
    category: "International Trading",
    location: "Jakarta, Indonesia",
    // No lastInteractionAt → renders as "not yet contacted" style
  },
];

/**
 * Compact business-location + interaction-time summary.
 * "Tokyo, Japan · 2h"   (with interaction)
 * "Tokyo, Japan"        (never interacted)
 */
export function formatBusinessSubline(bc: MockBusinessContact, now: number = Date.now()): string {
  if (!bc.lastInteractionAt) return bc.location;
  return `${bc.location} · ${formatRelativeTime(bc.lastInteractionAt, now)}`;
}

// ── Mock data ──────────────────────────────────────────────

// pravatar.cc serves a deterministic avatar per `?u=<seed>` query.
// Seeds picked so contacts stay visually distinct across the demo.
export const MOCK_CONTACTS: readonly MockContact[] = [
  {
    id: "c1",
    publicNexId: "NEX-K7X2-J9M4",
    name: "Sarah Chen",
    avatarUrl: "https://i.pravatar.cc/96?u=sarah-chen",
    status: "online",
    lastMessage: "Sounds good — catch you tomorrow",
    lastActivityAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),          // 4m ago
    unread: 2,
  },
  {
    id: "c2",
    publicNexId: "NEX-A3P8-Q2R5",
    name: "Alex Morrison",
    avatarUrl: "https://i.pravatar.cc/96?u=alex-morrison",
    status: "typing",
    lastMessage: "Just finished the drawing",
    lastActivityAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),         // 12m
    unread: 0,
  },
  {
    id: "c3",
    publicNexId: "NEX-D5V1-N7T9",
    name: "Rani Putri",
    avatarUrl: "https://i.pravatar.cc/96?u=rani-putri",
    status: "offline",
    lastMessage: "Terima kasih! Sampai jumpa",
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),     // 2h
    unread: 1,
  },
  {
    id: "c4",
    publicNexId: "NEX-M8W3-Y4B6",
    name: "James O'Connor",
    // No avatarUrl → tests the generated-initial-avatar fallback.
    status: "offline",
    lastMessage: "I'll send the invoice on Monday",
    lastActivityAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),    // 1d+
    unread: 0,
  },
  {
    id: "c5",
    publicNexId: "NEX-H2L4-C8G7",
    name: "Priya Ramachandran",
    avatarUrl: "https://i.pravatar.cc/96?u=priya-r",
    status: "online",
    lastMessage: "Photos are in your inbox",
    lastActivityAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),         // 55m
    unread: 0,
  },
  {
    id: "c6",
    publicNexId: "NEX-Z9K5-F3D2",
    name: "Tom Weber",
    avatarUrl: "https://i.pravatar.cc/96?u=tom-weber",
    status: "offline",
    lastMessage: "no worries, take your time",
    lastActivityAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),// 3d
    unread: 0,
    blocked: true,   // exercises the blocked visual state
  },
];

export const MOCK_GROUPS: readonly MockGroup[] = [
  {
    id: "g1",
    name: "Building Team",
    avatarUrl: "https://i.pravatar.cc/96?u=group-building-team",
    memberIds: ["c1", "c2", "c4", "c5"],
    lastSender: "Alex",
    lastMessage: "on my way",
    lastActivityAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),         // 12m
    unread: 8,
  },
  {
    id: "g2",
    name: "Jakarta Trip",
    // No avatarUrl → tests generated-group-avatar fallback.
    memberIds: ["c3", "c5"],
    lastSender: "Rani",
    lastMessage: "hotel confirmed for Friday",
    lastActivityAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),     // 5h
    unread: 0,
  },
];

// ── Helpers ────────────────────────────────────────────────

/**
 * Generate a pravatar URL for a given seed. Only used to synthesise a
 * group avatar composite in this V1 mock; real avatars come from the
 * contact records themselves.
 */
export function pravatarUrl(seed: string, size = 96): string {
  return `https://i.pravatar.cc/${size}?u=${encodeURIComponent(seed)}`;
}

/**
 * Return the initials of a name for the fallback avatar.
 * "Sarah Chen" → "SC" · "Rani Putri" → "RP" · "Alex" → "AL"
 */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * Compact relative time · WhatsApp-style.
 *   now → "just now"
 *   <60m → "12m"
 *   <24h → "3h"
 *   <7d → "Wed" (short day name)
 *   older → "Aug 21"
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = now - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  if (days < 7) {
    return new Date(t).toLocaleDateString(undefined, { weekday: "short" });
  }
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
