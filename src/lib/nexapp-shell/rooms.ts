// src/lib/nexapp-shell/rooms.ts · Philip 2026-08-29
//
// The five NEX rooms. Single source of truth for the persistent-shell
// information architecture (doctrine v5, five-button IA).
//
// Rooms in fixed order: Discover · Messages · Activity · Wallet · Me.
// Each room has an ordered list of sub-sections. Every sub-section may
// declare role visibility — if the visibility array is present, the section
// only appears when the current user has AT LEAST ONE of the listed roles.
// Absent visibility = shown to everyone.
//
// Phase 1 constraint: `workspace` values are placeholders. Every sub-section
// currently renders a "Coming soon" overlay when tapped. Phase 2+ wires
// real workspaces per the finalized deep-audit sequencing.
//
// Doctrine anchors:
//   · project_nex_five_button_ia_doctrine_2026_08_29 (CONSTITUTIONAL)
//   · project_nex_persistent_app_shell_doctrine_2026_08_29

export type RoomId = "discover" | "messages" | "activity" | "wallet" | "me";

export type UserRole = "user" | "provider" | "business" | "creator";

/**
 * Workspace ids consumed by NexAppShell's WorkspaceArtifact union.
 * "coming-soon" is the placeholder value used by unmigrated sections —
 * the drawer shows a chip instead of navigating.
 * Any other string is a real WorkspaceArtifact id.
 */
export type RoomSectionWorkspace = "coming-soon" | string;

export interface RoomSection {
  /** Stable id used by the drawer to key items + resolve navigation. */
  id: string;
  /** User-facing label. */
  label: string;
  /** Optional short helper below the label (11px caption). */
  hint?: string;
  /**
   * Which roles see this section. Absent = universal (shown to all).
   * Additive semantics: user has ["provider"] role → they see provider-only
   * items AND all universal items.
   */
  visibility?: UserRole[];
  /**
   * "coming-soon" → drawer shows placeholder chip on tap, workspace unchanged.
   * Anything else → drawer closes and workspace changes to that id.
   */
  workspace: RoomSectionWorkspace;
}

export interface Room {
  id: RoomId;
  /** Displayed in rail button label + drawer header. */
  label: string;
  /** Emoji or short symbol shown in the rail icon slot. */
  glyph: string;
  /** Short one-line intro shown at the top of the drawer body. */
  intro: string;
  /** Ordered sub-section list. */
  sections: RoomSection[];
  /**
   * Default section id for this room. Used to determine which sub-section
   * highlights on first drawer open. Must appear in `sections`.
   */
  defaultSectionId: string;
}

// ─── DISCOVER ───────────────────────────────────────────────────────
const DISCOVER: Room = {
  id: "discover",
  label: "Discover",
  glyph: "🔍",
  intro: "Find things in Indonesia.",
  defaultSectionId: "feed",
  sections: [
    { id: "feed",         label: "Feed",         hint: "Videos & posts",           workspace: "discover-feed" },
    // Phase 2 Step 1 · Reconciliation · Philip 2026-08-30
    // People wires DiscoverShell (floating profile universe) into the
    // canonical NEX interior. Same component as the standalone
    // /nex-app/discover route (preserved as recoverable escape until
    // migration is confirmed).
    { id: "people",       label: "People",       hint: "Floating profiles · connect",  workspace: "discover-people" },
    // Philip 2026-08-30 · Slice B · Businesses wired to NexWorkspaceBusinesses
    // (Food first · Hotels/Trades/Marketplace/Mobility/Rentals extend later).
    // Immersive artifact: rail collapses + orb perches via Slice A infra.
    { id: "businesses",   label: "Businesses",   hint: "Food · Stay · Services",   workspace: "discover-businesses" },
    // Philip 2026-08-30 · Directory Surface step 3 · Hotels registers a
    // second vertical against NexDirectorySurface to prove the abstraction
    // before B-wide sweep. Same immersive contract as Businesses.
    { id: "hotels",       label: "Hotels",       hint: "Places to stay in Yogyakarta", workspace: "discover-hotels" },
    // Philip 2026-08-30 · B-wide · Trades stress test.
    // Provider/company entities registered against NexDirectorySurface.
    { id: "trades",       label: "Trades",       hint: "Local providers who can help", workspace: "discover-trades" },
    // Philip 2026-08-30 · B-wide sweep · Marketplace/Mobility/Rentals/Services
    // registered against NexDirectorySurface. Descriptor-only. No new UI code.
    { id: "marketplace",  label: "Marketplace",  hint: "Buy from local sellers",   workspace: "discover-marketplace" },
    { id: "mobility",     label: "Mobility",     hint: "Bike · Parcel · Food run", workspace: "discover-mobility" },
    { id: "rentals",      label: "Rentals",      hint: "Bikes to rent nearby",     workspace: "discover-rentals" },
    { id: "services",     label: "Services",     hint: "Photography · tutoring · beauty · more", workspace: "discover-services" },
    // Philip 2026-08-30 · LIVE wired to NexLiveClient prototype (TikTok-style
    // dark video surface reusing the shipped Media Foundation feed). Old
    // /nex-live route preserved as recoverable escape.
    { id: "live",         label: "LIVE",         hint: "Watch what's happening",   workspace: "discover-live" },
    { id: "near-me",      label: "Near me",      hint: "Filter by your city",      workspace: "coming-soon" },
  ],
};

// ─── MESSAGES ───────────────────────────────────────────────────────
const MESSAGES: Room = {
  id: "messages",
  label: "Messages",
  glyph: "💬",
  intro: "Talk to NEX, people, and businesses.",
  defaultSectionId: "nex-chat",
  sections: [
    { id: "nex-chat",  label: "NEX chat",  hint: "The assistant — this is home",    workspace: "coming-soon" },
    // Phase 1 · Reconciliation · Philip 2026-08-30
    // 1:1 wired to canonical NexWorkspaceFriends (migration of the retired
    // NexAppHome's NexPendingChats + NexFriendChatView). Contacts wired to
    // canonical ContactsShell (from /nex-app/contacts). Both render inside
    // NexHudFrame children slot · Golden Rule respected.
    { id: "friends",   label: "1:1",       hint: "Direct conversations",            workspace: "messages-friends" },
    { id: "contacts",  label: "Contacts",  hint: "People and businesses you know",  workspace: "messages-contacts" },
    { id: "calls",     label: "Calls",     hint: "Voice + video · 1:1",             workspace: "coming-soon" },
    { id: "groups",    label: "Groups",    hint: "Coming later",                    workspace: "coming-soon" },
  ],
};

// ─── ACTIVITY (role-adaptive) ──────────────────────────────────────
const ACTIVITY: Room = {
  id: "activity",
  label: "Activity",
  glyph: "⚡",
  intro: "Everything happening for you right now.",
  defaultSectionId: "incoming-requests", // provider default; UI falls back to my-requests when no provider role
  sections: [
    // Provider-first (visible only when provider role is active)
    { id: "incoming-requests",    label: "Incoming requests",   hint: "New service requests for you", visibility: ["provider"], workspace: "activity-incoming-requests" },
    { id: "provider-services",    label: "My services",         hint: "Completed request history",    visibility: ["provider"], workspace: "coming-soon" },
    { id: "provider-rating",      label: "My rating",           hint: "Reviews from customers",       visibility: ["provider"], workspace: "coming-soon" },
    { id: "provider-availability",label: "Availability toggle", hint: "Turn on/off receiving requests", visibility: ["provider"], workspace: "coming-soon" },

    // Business-first
    { id: "biz-enquiries",        label: "Enquiries",           hint: "Chat inbound from customers",  visibility: ["business"], workspace: "coming-soon" },
    { id: "biz-bookings",         label: "Bookings",            hint: "Customer bookings against your business", visibility: ["business"], workspace: "coming-soon" },
    { id: "biz-listings",         label: "My listings",         hint: "Edit business profile, hours, photos", visibility: ["business"], workspace: "coming-soon" },
    { id: "biz-reviews",          label: "Reviews",             hint: "Moderation and reply",         visibility: ["business"], workspace: "coming-soon" },

    // Universal
    { id: "my-requests",          label: "My requests",         hint: "Mobility requests you've sent", workspace: "activity-my-requests" },
    { id: "my-orders",            label: "My orders",           hint: "Marketplace purchases",         workspace: "coming-soon" },
    { id: "my-bookings",          label: "My bookings",         hint: "Rentals, services, stays",      workspace: "coming-soon" },
    { id: "notifications",        label: "Notifications",       hint: "Payments, acceptances, updates", workspace: "coming-soon" },
    { id: "history",              label: "History",             hint: "Last 30 days",                  workspace: "coming-soon" },
  ],
};

// ─── WALLET (role-adaptive) ────────────────────────────────────────
const WALLET: Room = {
  id: "wallet",
  label: "Wallet",
  glyph: "💰",
  intro: "Your NEX wallet, transactions, and network fees.",
  defaultSectionId: "balance",
  sections: [
    { id: "balance",            label: "Balance",            hint: "Current wallet amount",           workspace: "wallet-balance" },
    { id: "topup",              label: "Top up",             hint: "Rp 20k · 50k · 100k · 250k · 500k", workspace: "coming-soon" },
    { id: "transactions",       label: "Transactions",       hint: "Every wallet change, newest first", workspace: "coming-soon" },
    { id: "network-fee-status", label: "Network fee status", hint: "8% · 2 free per month",           visibility: ["provider"], workspace: "coming-soon" },
    { id: "earnings",           label: "Earnings",           hint: "Net of NEX fees",                 visibility: ["provider", "business"], workspace: "coming-soon" },
    { id: "payment-methods",    label: "Payment methods",    hint: "Saved cards & e-wallet",          workspace: "coming-soon" },
  ],
};

// ─── ME ─────────────────────────────────────────────────────────────
const ME: Room = {
  id: "me",
  label: "Me",
  glyph: "👤",
  intro: "Your identity, roles, tools, and settings.",
  defaultSectionId: "profile",
  sections: [
    { id: "profile",            label: "Profile",             hint: "Your name, photo, city",          workspace: "me-profile" },
    { id: "nex-id",             label: "NEX ID",              hint: "Canonical identity",              workspace: "coming-soon" },
    { id: "my-roles",           label: "My roles",            hint: "Become a provider · Claim a business · Become a creator", workspace: "me-my-roles" },
    { id: "tools",              label: "Tools",               hint: "Calculators · AI writer · Translator", workspace: "coming-soon" },
    { id: "themes",             label: "Themes",              hint: "Personalize the NEX look",        workspace: "coming-soon" },
    { id: "language",           label: "Language",            hint: "English · Bahasa Indonesia",      workspace: "coming-soon" },
    { id: "notifications-prefs",label: "Notifications",       hint: "What NEX pings you about",        workspace: "coming-soon" },
    { id: "privacy",            label: "Privacy & data",      hint: "Export or delete your data",      workspace: "coming-soon" },
    { id: "help",               label: "Help & support",      hint: "FAQ · Contact NEX",               workspace: "coming-soon" },
    { id: "sign-in-out",        label: "Sign in / out",       hint: "Switch account or log out",       workspace: "coming-soon" },
  ],
};

// ─── Exports ────────────────────────────────────────────────────────
export const ROOMS: ReadonlyArray<Room> = [DISCOVER, MESSAGES, ACTIVITY, WALLET, ME] as const;

/** Look up a room by id. Never throws — returns null on unknown id. */
export function getRoom(id: RoomId): Room | null {
  return ROOMS.find((r) => r.id === id) ?? null;
}

/**
 * Filter a room's sections by the current active roles.
 * A section is included if it has no visibility array, or if any of its
 * listed roles is present in `activeRoles`.
 */
export function visibleSections(room: Room, activeRoles: ReadonlySet<UserRole>): RoomSection[] {
  return room.sections.filter((s) => {
    if (!s.visibility || s.visibility.length === 0) return true;
    return s.visibility.some((role) => activeRoles.has(role));
  });
}

/**
 * Which section should be highlighted / defaulted when this room opens?
 * If the room's defaultSectionId belongs to a role the user doesn't have,
 * fall through to the first visible universal section.
 */
export function defaultVisibleSectionId(room: Room, activeRoles: ReadonlySet<UserRole>): string | null {
  const visible = visibleSections(room, activeRoles);
  const preferred = visible.find((s) => s.id === room.defaultSectionId);
  if (preferred) return preferred.id;
  return visible[0]?.id ?? null;
}
