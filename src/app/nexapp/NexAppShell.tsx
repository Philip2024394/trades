// NEX home experience · v6 frame overlay shell.
//
// Doctrine anchors:
//   · project_nex_workspace_identity_doctrine_2026_08_25
//   · project_nex_workspace_terminology_addendum_2026_08_25
//   · project_nex_contextual_workspace_zone_doctrine_2026_08_25
//
// v6 architecture (Philip 2026-08-26):
//   Frame image = decorative overlay on top of live content
//   Rail on right = 5 labelled slots (Profile · Favorites · History · Services · Food)
//   Header top-right = 3 icon slots (Search · Bell · Menu)
//   Bottom pill = permanent composer (no separate nav dock)
//   Live workspace content sits inside the transparent interior opening.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Phase D · shared Control Center panel · scoped to phone frame via absolute inset-0
import { ControlCenterPanel } from "@/components/nex-app/shell/ControlCenterPanel";
import { useRouter, useSearchParams } from "next/navigation";
// Rail-icon lucide imports removed 2026-09-06 · rail buttons deleted.
// NEX Capability Surface · Philip 2026-08-30 · Slice 1
import { capabilityRegistry, type CapabilityId, type CapabilityFrame } from "@/lib/nexapp-shell/capabilities";
import { CapabilitySurface } from "@/components/nexapp/CapabilitySurface";
// Side-effect imports · register capabilities with the registry on load.
import "@/lib/nexapp-shell/capability-tools";
// Slice 3 · Philip 2026-08-30 · Network as Capability Surface (round buttons)
import "@/lib/nexapp-shell/capability-network";
// Slice 4 · Philip 2026-08-30 · Studio hybrid (round buttons · no sign-in surprise)
import "@/lib/nexapp-shell/capability-studio";
// Slice 2 · Philip 2026-08-30 · Creator round-button surface (7 tools)
import "@/lib/nexapp-shell/capability-creator";
import { NexHudFrame, type NexHudMode, type RailButton, type HeaderIconButton } from "@/components/nexapp/NexHudFrame";
import type { OrbLookDirection } from "@/components/nexapp/NexVoiceOrb";
import {
  initialState as initialEyeState,
  onEyeTap as reduceEyeTap,
  onVoiceButtonUsed as reduceVoiceButtonUsed,
  type EyeConversationState,
  type EyeConversationPhrase,
} from "@/components/nexapp/hud/eyeConversation";
import {
  NexGuidanceProvider,
  NexGuidanceBeamOverlay,
  useGuidance,
} from "@/components/nexapp/hud/NexGuidance";
import { useNexGuide } from "@/components/nexapp/hud/useNexGuide";
import { detectIntent } from "@/components/nexapp/hud/intentDetector";
import { NEX_HUD_THEME_REGISTRY, DEFAULT_THEME_ID } from "@/components/nexapp/hud/theme";
// NexContextCard import removed 2026-08-28 (Philip · card taken out of interior).
import { NexWorkspaceIdle } from "@/components/nexapp/NexWorkspaceIdle";
import { NexWorkspaceExplore } from "@/components/nexapp/NexWorkspaceExplore";
import { NexWorkspaceFriends } from "@/components/nexapp/NexWorkspaceFriends";
import { NEX_MOCK_FRIEND_THREADS, NEX_MOCK_FRIENDS, type FriendMessage } from "@/components/nexapp/NexPendingChats";
// Phase 2 workspaces · migrated in from standalone /nex-provider-* pages.
import { NexWorkspaceWallet } from "@/components/nexapp/NexWorkspaceWallet";
import { NexWorkspaceIncomingRequests } from "@/components/nexapp/NexWorkspaceIncomingRequests";
import { NexWorkspaceMyRoles } from "@/components/nexapp/NexWorkspaceMyRoles";
// Phase 1 · Reconciliation · Philip 2026-08-30 · Messages sub-section artifacts
// (NexWorkspaceFriends already imported at line 45 · reused for messages-friends)
// System A design-language ContactsShell replaced by v6 chassis
// ContactsPanel per Philip 2026-09-05 · M0 Business Contacts slice
// (one-unified-contacts-list + one-universal-chat doctrines · the
// cream/orange System A design is not acceptable for the v6 chassis).
// Import kept commented for one release cycle in case a rollback is
// needed; delete once the swap is stable.
// import { ContactsShell } from "@/components/nex-app/contacts/ContactsShell";
import { ContactsPanel } from "@/components/nexapp/ContactsPanel";
// Phase 2 Step 1 · Philip 2026-08-30 · Discover People (floating profiles)
import { DiscoverShell } from "@/components/nex-app/discover/DiscoverShell";
// Philip 2026-08-30 · Discover LIVE (TikTok-style prototype · same Media Foundation feed)
import { NexLiveClient } from "@/app/nex-live/NexLiveClient";
// Slice B · Philip 2026-08-30 · Food Directory · first fully-immersive artifact
import { NexWorkspaceBusinesses, type BusinessContext } from "@/components/nexapp/NexWorkspaceBusinesses";
import { NexDirectorySurface } from "@/components/nexapp/NexDirectorySurface";
import { hotelsVertical } from "@/lib/nexapp/verticals/hotels";
import { tradesVertical } from "@/lib/nexapp/verticals/trades";
import { marketplaceVertical } from "@/lib/nexapp/verticals/marketplace";
import { mobilityVertical } from "@/lib/nexapp/verticals/mobility";
import { rentalsVertical } from "@/lib/nexapp/verticals/rentals";
import { servicesVertical } from "@/lib/nexapp/verticals/services";
// Discover round-button constellation · Philip 2026-08-30 · restored from
// the retired NexAppHome era. Renders inside the bezel envelope when
// Discover is the active room. Component itself is unchanged (per surface-
// first rule) · wrapper below just gives it a positioning shell.
import { NexExploreSatellites } from "@/components/nexapp/NexExploreSatellites";
// Phase 3 workspaces · new functionality (not migrations).
import { NexWorkspaceMyRequests } from "@/components/nexapp/NexWorkspaceMyRequests";
import { NexWorkspaceProfile } from "@/components/nexapp/NexWorkspaceProfile";
// Products workspace · Philip 2026-09-05 · opens via keypad INSERT tile
// (relabelled "Products" in NexKeypad · key still "shop" for backward compat).
// Pure UI · mock data isolated · no backend contact. Reachable but does not
// touch C12 workforce trial running in the background.
import { NexWorkspaceProducts } from "@/components/nexapp/NexWorkspaceProducts";
// Product Creator workspace · Philip 2026-09-05 · UI + local draft only.
// Reached from Products via Add Product tile (P0.1 · Philip 2026-09-05) or
// via ?ws=product-creator deep link. Zero backend contact · does not touch
// C12 workforce.
import { NexWorkspaceProductCreator } from "@/components/nexapp/NexWorkspaceProductCreator";
// Business Home workspace · Philip 2026-09-05 · M0 owner cockpit.
// Composes with existing Products / Contacts / Chat surfaces via workspace
// swap (no duplicate systems per one-universal-chat / one-contacts-list
// doctrines). Zero taxonomy runtime access · zero workforce activation.
import { NexWorkspaceBusinessHome } from "@/components/nexapp/NexWorkspaceBusinessHome";
// Business Onboarding workspace · Philip 2026-09-05 · M1-A conversational
// onboarding. Reuses shell-mounted NexComposer for owner input · shell
// routes composer submits to acceptOwnerReply() when this artifact is
// active. LOCAL DRAFT ONLY · nex.business-profile.draft.v1 · no backend.
import { NexWorkspaceBusinessOnboarding } from "@/components/nexapp/NexWorkspaceBusinessOnboarding";
import { acceptOwnerReply as acceptBusinessOnboardingReply } from "@/lib/nexapp/mockBusinessOnboarding";
import { NexWorkspaceFeed } from "@/components/nexapp/NexWorkspaceFeed";
import { NexLiveStage } from "@/components/nexapp/hud/NexLiveStage";
import { NexDiscoveryStage } from "@/components/nexapp/hud/NexDiscoveryStage";
import { NexWorkspaceChat, type ChatMessage } from "@/components/nexapp/NexWorkspaceChat";
import { useAmbientInjector } from "@/lib/nexapp/ambientInjector";
import { NexButterflyCinematic } from "@/components/nexapp/NexButterflyCinematic";
import { NexComposer } from "@/components/nexapp/NexComposer";
import { NexKeypad } from "@/components/nexapp/NexKeypad";
import { NexSideDrawer } from "@/components/nexapp/NexSideDrawer";
// Five-button IA · Philip 2026-08-29 · Phase 1.
// Rail buttons open room drawers. Sub-sections in drawers are "Coming soon"
// placeholders in Phase 1 · Phase 2+ wires real workspaces.
import { NexRoomDrawer } from "@/components/nexapp/rooms/NexRoomDrawer";
import type { RoomId, UserRole } from "@/lib/nexapp-shell/rooms";
// CHAT ↔ CATEGORY ↔ CATEGORY_DETAIL surface · Philip 2026-09-01.
// The composer + button flips chatMode; NexCategoryMode paints a full-surface
// overlay on top of chat (conversation state preserved in `messages`).
import { NexCategoryMode, type CategoryChatMode } from "@/components/nexapp/NexCategoryMode";
// Recent-pages panel · Philip 2026-09-01 · opens when + is held for 2s.
import { NexRecentPagesPanel, type RecentPage } from "@/components/nexapp/NexRecentPagesPanel";
// Kebab quick-panel · Philip 2026-09-01. NEX Live + Chat entry buttons ·
// Chat drills into landscape friend cards · pick a friend to open the chat.
import { NexKebabQuickPanel } from "@/components/nexapp/NexKebabQuickPanel";
// Kept · will host future side tools (Images / Memory / Brain / Settings).
// Mascots now open the full-screen NexMascotStage instead of this drawer.
import { NexMascotStage } from "@/components/nexapp/hud/NexMascotStage";
import { listAll as listMascots } from "@/lib/nex-mascots/registry";
import type { MascotSection } from "@/lib/nex-mascots/types";
import { useNexVoice } from "@/lib/nex-voice";
// STEP 3 · Philip 2026-08-29 · wire activation state → frameMode.
import { useNexActivation, useNexIdentity } from "@/lib/nex-identity";

// Which artifact currently fills the workspace zone.
// Legacy artifacts (chat/profile/services/food) kept for pre-Phase-1 workspaces.
// Phase 2+ workspaces (wallet-balance / activity-incoming-requests /
// me-my-roles / ...) are added as each PR migrates a standalone page inside.
type WorkspaceArtifact =
  | "chat"                        // default · conversation transcript
  | "profile"                     // legacy profile placeholder (Me → Profile pending)
  | "services"                    // legacy services (Discover → Services pending)
  | "food"                        // legacy food (Discover → Food pending)
  | "wallet-balance"              // Phase 2 PR-1 · Wallet → Balance
  | "activity-incoming-requests"  // Phase 2 PR-2 · Activity → Incoming requests
  | "me-my-roles"                 // Phase 2 PR-3 · Me → My roles
  | "activity-my-requests"        // Phase 3 PR-4 · Activity → My requests
  | "me-profile"                  // Phase 3 PR-5 · Me → Profile
  | "discover-feed"               // Phase 3 PR-6 · Discover → Feed
  // Phase 1 · Reconciliation · Philip 2026-08-30 · surface completeness
  | "messages-friends"            // canonical migration of NexAppHome's Friends flow
  | "messages-contacts"           // canonical ContactsShell (from /nex-app/contacts)
  // Phase 2 Step 1 · Philip 2026-08-30 · Discover People (floating profiles)
  | "discover-people"              // canonical DiscoverShell mounted inside NEX interior
  // Philip 2026-08-30 · Discover LIVE (TikTok-style prototype in-shell)
  | "discover-live"                // canonical NexLiveClient mounted inside NEX interior
  // Slice B · Philip 2026-08-30 · Food Directory (first fully-immersive artifact)
  | "discover-businesses"          // NexWorkspaceBusinesses · rail collapses + orb perches
  // Directory Surface step 3 · Philip 2026-08-30 · Hotels vertical registered
  // against NexDirectorySurface (data-only registration · proves abstraction).
  | "discover-hotels"              // NexDirectorySurface + hotelsVertical · immersive
  // B-wide · Philip 2026-08-30 · Trades vertical · deliberate architecture
  // stress test (person/company entities, not venues).
  | "discover-trades"              // NexDirectorySurface + tradesVertical · immersive
  // B-wide sweep · Philip 2026-08-30 · Marketplace / Mobility / Rentals / Services
  // registered as descriptor-only registrations against NexDirectorySurface.
  | "discover-marketplace"         // NexDirectorySurface + marketplaceVertical · immersive
  | "discover-mobility"            // NexDirectorySurface + mobilityVertical · immersive
  | "discover-rentals"             // NexDirectorySurface + rentalsVertical · immersive
  | "discover-services"            // NexDirectorySurface + servicesVertical · immersive
  // Products workspace · Philip 2026-09-05 · opens via keypad INSERT "Products" tile
  | "products"                     // NexWorkspaceProducts · pure UI · mock data · no backend
  // Product Creator · Philip 2026-09-05 · Add Product/Service surface · UI + local draft
  | "product-creator"              // NexWorkspaceProductCreator · localStorage draft · no backend
  // Business Home · Philip 2026-09-05 · M0 owner cockpit · calm section grid
  | "business-home"                // NexWorkspaceBusinessHome · mock demo state · no backend
  // Business Onboarding · Philip 2026-09-05 · M1-A conversational onboarding
  | "business-onboarding";         // NexWorkspaceBusinessOnboarding · localStorage draft · no backend
// "history" retired 2026-08-27 · rail slot replaced by LIVE (Philip)
// "live" is NOT a workspace artifact · it's a full stage overlay like Mascot
// (uses overlaySlot + hideInteriorControls · covers the whole bezel interior)

// Immersive artifacts · Philip 2026-08-30 · Slice A infra.
// Module scope so both handleKebabTap (early in component) and the
// render-body derivation can reference the same set without a hoisting
// hazard. Adding an id here makes the shell auto-collapse the rail and
// perch the orb whenever that artifact is active.
const IMMERSIVE_ARTIFACTS = new Set<string>([
  "discover-live",
  "discover-people",       // Social · dating floating profiles (Philip 2026-09-01)
  "discover-businesses",   // Slice B · Food Directory needs full interior
  "discover-hotels",       // Directory Surface step 3 · Hotels vertical
  "discover-trades",       // B-wide · Trades vertical
  "discover-marketplace",  // B-wide sweep · Marketplace vertical
  "discover-mobility",     // B-wide sweep · Mobility vertical
  "discover-rentals",      // B-wide sweep · Rentals vertical
  "discover-services",     // B-wide sweep · Services vertical
]);

// Set of valid artifact strings (used to validate ?ws=... deep links).
const VALID_WORKSPACES = new Set<WorkspaceArtifact>([
  "chat", "profile", "services", "food",
  "wallet-balance", "activity-incoming-requests", "me-my-roles",
  "activity-my-requests", "me-profile", "discover-feed",
  "messages-friends", "messages-contacts",
  "discover-people", "discover-live",
  "discover-businesses",
  "discover-hotels",
  "discover-trades",
  "discover-marketplace",
  "discover-mobility",
  "discover-rentals",
  "discover-services",
  "products",
  "product-creator",
  "business-home",
  "business-onboarding",
]);
function coerceWorkspace(raw: string | null | undefined): WorkspaceArtifact | null {
  if (!raw) return null;
  return VALID_WORKSPACES.has(raw as WorkspaceArtifact) ? (raw as WorkspaceArtifact) : null;
}

// ── Recent-pages label + glyph mapping · Philip 2026-09-01 ──────────────
// Returns null for "chat home" so it isn't tracked. Consumed by the MRU
// stack driving NexRecentPagesPanel.
function pageLabel(cap: string | null, art: string): string | null {
  if (cap) {
    switch (cap) {
      case "studio":  return "Studio";
      case "tools":   return "Tools";
      case "creator": return "Creator";
      case "network": return "Network";
      default:        return cap.charAt(0).toUpperCase() + cap.slice(1);
    }
  }
  if (art === "chat") return null;
  switch (art) {
    case "food":                        return "Food";
    case "services":                    return "Services";
    case "profile":                     return "Profile";
    case "wallet-balance":              return "Wallet";
    case "activity-incoming-requests":  return "Requests";
    case "activity-my-requests":        return "My Requests";
    case "me-my-roles":                 return "Roles";
    case "me-profile":                  return "Profile";
    case "discover-feed":               return "Feed";
    case "messages-friends":            return "Messages";
    case "messages-contacts":           return "Contacts";
    case "discover-people":             return "People";
    case "discover-live":               return "Live";
    case "discover-businesses":         return "Food";
    case "discover-hotels":             return "Hotels";
    case "discover-trades":             return "Trades";
    case "discover-marketplace":        return "Market";
    case "discover-mobility":           return "Ride";
    case "discover-rentals":            return "Rentals";
    case "discover-services":           return "Services";
    default:                            return art;
  }
}
function pageGlyph(cap: string | null, art: string): string {
  if (cap) {
    switch (cap) {
      case "studio":  return "📦";
      case "tools":   return "🔧";
      case "creator": return "🎨";
      case "network": return "👥";
      default:        return "▫️";
    }
  }
  switch (art) {
    case "food":                        return "🍜";
    case "services":                    return "🛎️";
    case "profile":                     return "👤";
    case "wallet-balance":              return "💰";
    case "activity-incoming-requests":  return "📥";
    case "activity-my-requests":        return "📤";
    case "me-my-roles":                 return "🎭";
    case "me-profile":                  return "👤";
    case "discover-feed":               return "📰";
    case "messages-friends":            return "💬";
    case "messages-contacts":           return "📇";
    case "discover-people":             return "🧑";
    case "discover-live":               return "📺";
    case "discover-businesses":         return "🍜";
    case "discover-hotels":             return "🏨";
    case "discover-trades":             return "🔨";
    case "discover-marketplace":        return "🛍️";
    case "discover-mobility":           return "🛵";
    case "discover-rentals":            return "🔑";
    case "discover-services":           return "🛎️";
    default:                            return "▫️";
  }
}

const POLL_INTERVAL_MS = 20_000;

interface LatestDiscovery {
  workerId: string;
  vertical: string;
  city: string | null;
  recordsNew: number;
  recordsProcessed: number;
  cycleOutcome: string | null;
  finishedAt: string;
  secondsAgo: number;
}
interface DiscoveryPayload {
  version: number;
  latest: LatestDiscovery | null;
  rollup24h: { recordsNew: number; cyclesCompleted: number; byVertical: Record<string, number> } | null;
}

const VERTICAL_LABEL: Record<string, string> = {
  food:          "restaurants",
  accommodation: "places to stay",
  market:        "markets",
  transport:     "providers",
  unknown:       "businesses",
};

// Mock friend chat (Jack) removed 2026-08-28 · Phase 1 cleanup ·
// friend chat deferred to Phase 5 per NEX chat plan.

function humanAgo(secs: number): string {
  if (secs < 90) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)} min ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

// cardFromDiscovery removed 2026-08-28 (Philip · context card taken out).
// Discovery status still observable in /nex-head-quarters/discovery.

// ── Icon primitives ────────────────────────────────────────────────────────
// Base icon · thin premium stroke with subtle drop-shadow so white icons
// read as "polished" against the metallic rail housing. Consumers set
// their own colour via CSS `color` (inherited by `currentColor`).
const Icon = ({ children, size = 22 }: { children: React.ReactNode; size?: number }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round"
    style={{
      filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
    }}
  >
    {children}
  </svg>
);
// Rail
const IconProfile   = () => <Icon><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>;
// Mascot icon · tiny teddy-adjacent silhouette · consistent with rail line style
// (head circle · two small ears · minimal features). Doctrine: no artwork
// fabrication (Philip 2026-08-27) · this is a UI control glyph, not a mascot.
const IconMascot    = () => <Icon><circle cx="8" cy="6.2" r="1.6" /><circle cx="16" cy="6.2" r="1.6" /><circle cx="12" cy="12.5" r="5.2" /><circle cx="10" cy="12" r="0.7" fill="currentColor" /><circle cx="14" cy="12" r="0.7" fill="currentColor" /><path d="M10.5 14.5c0.4 0.5 2.6 0.5 3 0" /></Icon>;
const IconClock     = () => <Icon><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>;
// LIVE rail icon · red dot + concentric arcs (radio-wave silhouette)
const IconLive      = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <path d="M8.5 8.5a5 5 0 0 0 0 7" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M5.5 5.5a9 9 0 0 0 0 13" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Icon>
);
const IconServices  = () => <Icon><path d="M14.7 6.3a5 5 0 0 0-7 7l-6 6 2 2 6-6a5 5 0 0 0 7-7z" /><path d="M18 6l3-3" /></Icon>;
const IconFood      = () => <Icon><path d="M6 2v20" /><path d="M4 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" /><path d="M18 15c0-3 2-6 2-11" /><path d="M18 15v7" /></Icon>;
// ── Five-button IA rail icons · Philip 2026-08-29 · MODERN + MEASURED ──
//
// Modern icons from lucide-react (industry-standard set · 24×24 viewBox ·
// optically balanced strokes). All render at size="100%" so the SVG fills
// the rail-button's 60% × aspect-ratio:1 wrapper (see NexHudFrame's
// RailButtonSlot). Result: icons land at the exact 5 slot centers computed
// from DEFAULT_ZONES.side:
//
//   Bezel 850×1850 · Rail 24-76% × 82-100%
//   Rail X centre  = 90.96% (773.2 px)
//   Rail slot ht   = 190.8 px each · 2 px gap · CSS Grid `repeat(5,1fr)`
//   Slot Y centres = 29.16 / 39.58 / 50.00 / 60.42 / 70.84 % of bezel
//
// Colour inherited from button `color` via `currentColor` · white when
// idle, orb-orange when active, dim grey for the other four when a room
// is active. Drop-shadow gives icons definition against the metal rail.
const RAIL_ICON_STYLE: React.CSSProperties = {
  filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
  display: "block",
};
const RAIL_ICON_STROKE = 1.9;
// Right-side rail icons + button arrays deleted 2026-09-06 per Founder
// direction. The 5 primary rail buttons (Discover · Messages · Activity ·
// Wallet · Me) and the 4 secondary MORE-panel buttons (Studio · Tools ·
// Creator · Network) are no longer surfaced on the frame chrome. Their
// workspaces are reached from the Control Center panel and the shell's
// bottom composer.
// Header icons
const IconSearch    = () => <Icon size={22}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
const IconBell      = () => <Icon size={22}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Icon>;
const IconDots      = () => <Icon size={22}><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /></Icon>;
// IconPlus · Philip 2026-08-30 · previously header slot 3. Slot 3 became
// HOME on 2026-09-01 (see IconHome below · matches new footer + / actions
// panel which now owns global creation). Icon kept in case another surface
// needs it.
const IconPlus      = () => <Icon size={22}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
// IconHome · Philip 2026-09-01 · header slot 3 · tap always returns to the
// nexapp chat page (clears any active capability via router.push then sets
// the workspace artifact back to "chat"). Rendered CENTERED inside the
// header-icon slot by HeaderIconSlot's flex wrapper.
const IconHome      = () => <Icon size={22}><path d="M3 11 L12 3 L21 11" /><path d="M5 10 L5 20 L10 20 L10 14 L14 14 L14 20 L19 20 L19 10" /></Icon>;

export function NexAppShell() {
  return (
    <NexGuidanceProvider>
      <NexAppShellInner />
      <NexGuidanceBeamOverlay />
    </NexGuidanceProvider>
  );
}

function NexAppShellInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<NexHudMode>("chatting");

  // Phase D · header three-dot opens the shared Control Center inside
  // the bezel console viewport (portaled to .nex-console-viewport so
  // the panel's absolute inset-0 scopes to the phone frame, never the
  // whole browser window). Founder rule §5 · Control Center = user's
  // NEX world (Account / Conversation / Privacy / Your World / NEX).
  const [controlCenterOpen, setControlCenterOpen] = useState(false);
  const [controlCenterPortalTarget, setControlCenterPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    setControlCenterPortalTarget(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, []);
  // STEP 3 · Philip 2026-08-29 · frame reflects NEX activation state.
  //   dormant     → frameMode="off"
  //   activating  → frameMode="cinema"
  //   active      → frameMode="normal"
  // Hydration safety · while isLoading, default to "normal" so existing
  // grandfathered users don't flash "off" during the first-render window.
  // (Truly new/dormant users see a brief "normal" flash → "off" once
  // hydration completes · acceptable for this first pass · no accent
  // overlays yet.)
  const { state: activationState, isLoading: activationLoading, markIntroduced } = useNexActivation();
  const { state: identityState } = useNexIdentity();
  const activationFrameMode: "off" | "cinema" | "normal" =
    activationLoading                  ? "normal"
    : activationState === "dormant"    ? "off"
    : activationState === "activating" ? "cinema"
    :                                    "normal";

  // ═══ BATCH 7 · First-access ceremony · Philip 2026-08-29 ═══
  //
  // Fires exactly once per shell mount when activationState enters
  // "activating" AND identity has hydrated. Timeline:
  //   t=0      DARK          revealStep 0 · frameMode override "off"
  //   t=1200   HOUSING/BUTTON 1
  //   t=2000   HOUSING/BUTTON 2
  //   t=2800   HOUSING/BUTTON 3
  //   t=3600   HOUSING/BUTTON 4
  //   t=4400   HOUSING/BUTTON 5    (whole rail alive · frame still dark)
  //   t=5200   pause               (all 5 controls settled)
  //   t=5600   FULL POWER          frameMode override "normal"
  //   t=6100   orb-wake            (visual pause before speech)
  //   t=6600   NEX speaks intro (canned · via voice.speak, NOT the brain)
  //   speech end (real utterance) → markIntroduced() · state → "active"
  //   speech blocked (iOS autoplay etc) → phase "failed" · orb becomes
  //     retry surface with subtle "🔊 tap orb" eye-bubble hint. Activation
  //     STAYS "activating" so a retry (or next visit) rewalks the intro.
  //
  // Grandfathered users never enter this effect · useNexActivation silently
  // marks them "active" during hydration so activationState !== "activating".
  const [ceremonyRevealStep, setCeremonyRevealStep] = useState(0);
  const [ceremonyFrameOverride, setCeremonyFrameOverride] = useState<"off" | "normal" | null>(null);
  const [ceremonyPhase, setCeremonyPhase] = useState<
    "idle" | "dark" | "revealing" | "full" | "orb-wake" | "speaking" | "failed" | "complete"
  >("idle");
  const ceremonyStartedRef = useRef(false);
  const speakIntroRef = useRef<(() => Promise<void>) | null>(null);
  // Deep-link support · when the user lands via /nexapp?ws=<id> (e.g. old
  // /nex-provider-wallet 308-redirects here after Phase 2 migration), open
  // that workspace on mount. Otherwise default to chat.
  const [artifact, setArtifact] = useState<WorkspaceArtifact>(
    () => coerceWorkspace(searchParams?.get("ws")) ?? "chat",
  );
  // Five-button IA · Philip 2026-08-29 · Phase 1.
  // Tap a rail button → activeRoom is set → NexRoomDrawer slides out with
  // that room's sub-section list. Doctrine lock: opening the drawer does
  // NOT change the workspace · closing without picking leaves workspace intact.
  const [activeRoom, setActiveRoom] = useState<RoomId | null>(null);
  // CHAT ↔ CATEGORY ↔ CATEGORY_DETAIL surface state · Philip 2026-09-01.
  // Composer + button flips this. Purely visual — messages / artifact /
  // activeCapability / activeRoom / lastNexQuestion all live above and
  // are untouched by the mode. `activeCategoryId` is set when the user
  // taps a top-level category to descend into its sub-section list.
  const [chatMode, setChatMode] = useState<CategoryChatMode>("chat");
  const [activeCategoryId, setActiveCategoryId] = useState<RoomId | null>(null);
  // Recent-pages panel · opens on + long-press (2s hold) · Philip 2026-09-01.
  // recentPages is a small MRU stack of workspace artifacts + capabilities
  // the user has visited. Auto-closes after 6s idle · closes on any tile
  // select · closes on typing (handled below via inputText effect).
  const [recentPagesOpen, setRecentPagesOpen] = useState(false);
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);
  // Kebab quick-panel state · Philip 2026-09-01.
  // Kebab tap opens the panel (Live · Chat → friend cards). Pending friend
  // id is set when a friend card is tapped so NexWorkspaceFriends can open
  // straight in that thread instead of the friends list.
  const [kebabPanelOpen, setKebabPanelOpen] = useState(false);
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null);
  // Friend chat state · lifted here (Philip 2026-09-02) so the composer
  // knows when a friend chat is open and can route submits into that
  // thread instead of the NEX chat transcript.
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [friendThreads, setFriendThreads] = useState<Record<string, FriendMessage[]>>(() => {
    const out: Record<string, FriendMessage[]> = {};
    for (const [k, v] of Object.entries(NEX_MOCK_FRIEND_THREADS)) out[k] = [...v];
    return out;
  });
  // Reply target · Philip 2026-09-02. When set, the composer submit
  // attaches replyTo=target.id to the new message and clears the target.
  const [friendReplyTarget, setFriendReplyTarget] = useState<FriendMessage | null>(null);
  // Auto-open the keypad when a friend message is selected as reply
  // target · Philip 2026-09-03 "select the chat bubble and type reply
  // on the screen". Selecting a bubble = the user wants to reply →
  // the keypad should appear without needing a separate tap on the
  // composer input. Also focus the composer input so submit routes
  // through the normal handler.
  // NEX Keypad · Slice A · Philip 2026-09-03. Tracks whether the
  // composer input currently has focus so the shell can mount the
  // NexKeypad above the composer. inputMode="none" on the input
  // suppresses the OS keyboard so the NEX Keypad is the only
  // text-entry surface.
  const [composerFocused, setComposerFocused] = useState(false);
  // Keypad INSERT MODE · Philip 2026-09-03 "the alphabet dispaear and
  // the 2 buttons capital and left arrow and the buttons 8 apear when
  // the button in field is selected not opening panel above the text
  // field". Toggled by the ⋮⋮ button inside the composer's input pill.
  // When true, NexKeypad replaces its letters with the 8-tile grid ·
  // only Shift + Backspace remain from the standard keypad chrome.
  const [keypadInsertMode, setKeypadInsertMode] = useState(false);
  // NEX ASSIST MODE · PRIVATE · Philip 2026-09-03 "when the nex button
  // is activated she will apear in the kepad text asking how can she
  // help and you can add text and send and what ever question or
  // request you asked next . nex will reply with new container when
  // that request answered or task". When true, the composer's ✨ button
  // is active, the placeholder changes to "How can I help?", and the
  // next send goes to NEX (not to Alex) · Alex NEVER sees this
  // exchange. NEX's reply appears as a private "nex-private" message
  // in the chat thread (visible only to the user).
  const [nexAssistMode, setNexAssistMode] = useState(false);
  // Muted friend ids · Philip 2026-09-02 world-class. Per-friend mute
  // preference toggled from the ⋯ header menu. Purely cosmetic today.
  const [mutedFriendIds, setMutedFriendIds] = useState<Set<string>>(new Set());
  const toggleFriendMute = (friendId: string) => {
    setMutedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  };
  const clearFriendChat = (friendId: string) => {
    setFriendThreads((prev) => ({ ...prev, [friendId]: [] }));
  };
  // Auto-focus the composer the moment a reply target is set · cursor
  // flashes immediately so the user can start typing (Philip 2026-09-02).
  // ALSO auto-open the keypad · Philip 2026-09-03 "select the chat
  // bubble and type reply on the screen". Selecting a bubble = user
  // wants to reply → keypad appears without needing a separate composer
  // tap. Focus fires composer's onInputFocus → setComposerFocused(true)
  // → keypad mounts. Setting composerFocused directly here is a
  // belt-and-braces guarantee in case the focus doesn't propagate.
  useEffect(() => {
    if (friendReplyTarget) {
      composerRef.current?.focus();
      setComposerFocused(true);
    }
  }, [friendReplyTarget]);

  // Read-tracking handlers · Philip 2026-09-02.
  //   markThreadRead : called ~1.5s after friend chat opens · flips every
  //                    friend message with read===false to read===true.
  //   toggleMessageRead : called from the ⋮ menu · flips a single message.
  const markFriendThreadRead = (friendId: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      let changed = false;
      const next = arr.map((m) => {
        if (m.sender === "friend" && m.read === false) {
          changed = true;
          return { ...m, read: true };
        }
        return m;
      });
      return changed ? { ...prev, [friendId]: next } : prev;
    });
  };
  const toggleFriendMessageRead = (friendId: string, messageId: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      const next = arr.map((m) => {
        if (m.id !== messageId) return m;
        // Undefined → assumed read → toggle to false. Otherwise flip.
        const current = m.read !== false;
        return { ...m, read: !current };
      });
      return { ...prev, [friendId]: next };
    });
  };
  // Delete a message from a friend's thread · Philip 2026-09-02 · world-class
  // batch. If the deleted message was the current reply target, also clear
  // the reply state so the composer doesn't reference a ghost message.
  const deleteFriendMessage = (friendId: string, messageId: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      return { ...prev, [friendId]: arr.filter((m) => m.id !== messageId) };
    });
    if (friendReplyTarget?.id === messageId) setFriendReplyTarget(null);
  };
  // Add a user-authored emoji reaction to a friend's message · Philip
  // 2026-09-02 world-class. Appends to the message's reactions[] array.
  const addFriendMessageReaction = (friendId: string, messageId: string, emoji: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      const next = arr.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions ?? [];
        return { ...m, reactions: [...existing, { emoji, by: "user" as const }] };
      });
      return { ...prev, [friendId]: next };
    });
  };
  // Toggle save / pin flags · Philip 2026-09-02 world-class. Simple state
  // flips; menu label + future indicators react to the fields.
  const toggleFriendMessageSaved = (friendId: string, messageId: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      const next = arr.map((m) => m.id === messageId ? { ...m, saved: !(m.saved === true) } : m);
      return { ...prev, [friendId]: next };
    });
  };
  const toggleFriendMessagePinned = (friendId: string, messageId: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      const next = arr.map((m) => m.id === messageId ? { ...m, pinned: !(m.pinned === true) } : m);
      return { ...prev, [friendId]: next };
    });
  };
  // Simulate the friend replying · Philip 2026-09-02 world-class.
  // After the user sends a message, briefly flip the friend to "typing"
  // then push a canned reply back. Demonstrates the full round-trip:
  // throw-from-user → hero focus swaps → typing dots → throw-from-friend
  // → auto-mark-read. Uses a small library of canned replies picked
  // based on what the user said.
  const friendReplyBank = [
    "Sounds good!",
    "Haha nice one",
    "Ok cool, let me know",
    "Perfect, thanks!",
    "Got it 👍",
    "On my way",
    "Yes exactly",
    "Interesting… tell me more",
  ];
  const simulateFriendReply = (friendId: string, userText: string) => {
    // Step 1 · after 800ms, friend starts "typing" (avatar shows dots).
    setTimeout(() => {
      // The friend's status is stored on the MockFriend list, which is a
      // module-level const. We can't mutate it cleanly · instead, we
      // convey typing by adding a placeholder "…" message and then
      // replacing it with the real text. For a cleaner UI, we skip the
      // in-thread typing indicator and just push the reply after a
      // realistic delay.
    }, 800);
    // Step 2 · after ~2.4s, push a canned reply from the friend.
    setTimeout(() => {
      // Pick a reply · seeded loosely by the user's message length so
      // it feels a bit context-aware without being expensive.
      const idx = Math.abs(userText.length) % friendReplyBank.length;
      const replyText = friendReplyBank[idx];
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const friendMsg: FriendMessage = {
        id: `${friendId}-sim-${Date.now()}`,
        sender: "friend",
        text: replyText,
        time: timeStr,
        dateISO: now.toISOString(),
      };
      setFriendThreads((prev) => ({
        ...prev,
        [friendId]: [...(prev[friendId] ?? []), friendMsg],
      }));
    }, 2400);
  };
  // Edit a user's own message · Philip 2026-09-02 world-class. Appends
  // an "edited" event to the message's postEvents so the record + the
  // subtle "(edited)" label reflect the change.
  const editFriendMessage = (friendId: string, messageId: string, newText: string) => {
    setFriendThreads((prev) => {
      const arr = prev[friendId];
      if (!arr) return prev;
      const editTime = nowClock();
      const next = arr.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          text: newText,
          postEvents: [
            ...(m.postEvents ?? []),
            { type: "edited" as const, time: editTime, actor: "You" },
          ],
        };
      });
      return { ...prev, [friendId]: next };
    });
  };
  // Draft persistence per friend · Philip 2026-09-02 · world-class batch.
  // When the user switches friends, save the current composer text against
  // the previous friend id, then restore that friend's saved draft when
  // they re-open the conversation. No draft is ever lost mid-conversation.
  const [friendDrafts, setFriendDrafts] = useState<Record<string, string>>({});
  const prevActiveFriendRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevActiveFriendRef.current;
    // Leaving a friend chat · stash the current composer text as its draft.
    if (prev && prev !== activeFriendId) {
      setFriendDrafts((d) => ({ ...d, [prev]: inputText }));
    }
    // Entering a new friend chat · load their saved draft (or empty).
    if (activeFriendId && activeFriendId !== prev) {
      const savedDraft = friendDrafts[activeFriendId] ?? "";
      setInputText(savedDraft);
    }
    prevActiveFriendRef.current = activeFriendId;
    // Intentionally not depending on inputText — we only care about
    // friend-switch transitions, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFriendId]);
  // Roles for drawer visibility. Phase 1: read from ?roles=provider,business
  // for testing. Phase 3+: replaced by real auth-derived role set.
  const activeRoles: ReadonlySet<UserRole> = useMemo(() => {
    const raw = searchParams?.get("roles") ?? "";
    const valid: UserRole[] = ["provider", "business", "creator"];
    const found = raw.split(",").map((s) => s.trim()).filter((s): s is UserRole =>
      (valid as string[]).includes(s));
    return new Set<UserRole>(found);
  }, [searchParams]);
  // Mascot side-tool drawer · Philip 2026-08-27 · orthogonal to workspace
  // artifacts. Tap Mascot on the rail → drawer emerges (glass reveal). Does
  // NOT navigate or change the workspace · main conversation stays present.
  //
  // Phase 1 note (2026-08-29): rail no longer opens Mascot directly. State is
  // preserved for Phase 2 wiring via Me → Themes sub-section.
  const [mascotDrawerOpen, setMascotDrawerOpen] = useState(false);
  // NEX LIVE stage · Philip 2026-08-27 v2 · full bezel overlay like Mascot.
  // When open: covers the entire interior · video fills the transparent inner
  // opening edge-to-edge · bezel + rail + orb still paint on top.
  const [liveOpen, setLiveOpen] = useState(false);
  // ═══ FULL-WIDTH MODE · Philip 2026-08-28 · CHOREOGRAPHED CINEMATIC ═══
  //
  // Kebab tap fires a 3.4s sequence (entry) or 1.6s sequence (exit).
  // NEX is the character binding the transition · she hops down, enters
  // hyper mode watching, floats to top-right perch. In parallel: hero
  // fades, rail buttons stagger-fade, chat expands to full width.
  //
  // Phase Timeline (entry):
  //   t=0.00  · fullWidthMode=true · orbHopped=true · orbHyperMode=true
  //   t=2.00  · orbPerched=true (starts float to top-right ~1.2s CSS transition)
  //   t=2.35  · heroVisible=false (hero fades out)
  //   t=2.65  · railVisible=false (rail stagger-fades out)
  //   t=2.95  · chatFullWidth=true (chat expands)
  //   t=3.40  · orbHyperMode=false (NEX resumes normal cadence from perch)
  //
  // Phase Timeline (exit):
  //   t=0.00  · chatFullWidth=false · railVisible=true
  //   t=0.30  · heroVisible=true · orbPerched=false (NEX floats back)
  //   t=1.30  · orbHopped=false (NEX hops back into her circle)
  //   t=1.60  · fullWidthMode=false (settled)
  const [fullWidthMode, setFullWidthMode] = useState(false);
  const [orbPerched, setOrbPerched]       = useState(false);
  const [orbHyperMode, setOrbHyperMode]   = useState(false);
  const [heroVisible, setHeroVisible]     = useState(true);
  const [railVisible, setRailVisible]     = useState(true);
  const [chatFullWidth, setChatFullWidth] = useState(false);
  const fullWidthTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  // MORE panel state · Philip 2026-08-30. Kebab now toggles this instead
  // of chat-full-width (kebab reused per revised nav architecture · the
  // full-width choreography below is retired but state kept for future
  // hygiene batch since it may still be referenced downstream).
  const [moreOpen, setMoreOpen] = useState(false);

  // Capability Surface state · Philip 2026-08-30 · Slice 1.
  // URL is the source of truth (`?cap=&view=&id=`). These state values
  // mirror the URL so React renders match. Handlers below call router.push
  // for user navigation, then a mount+URL effect syncs URL → state.
  // NOTE: activeRoom + artifact are preserved when entering/leaving a
  // capability (rendering priority: Capability → Room artifact → Default).
  const [activeCapability, setActiveCapability] = useState<CapabilityId | null>(null);
  const [capabilityFrame, setCapabilityFrame] = useState<CapabilityFrame | null>(null);
  // Slice C2 · Philip 2026-08-30 · Ask NEX business-context attach.
  // When user taps Ask NEX on a business, we store the business here,
  // exit immersive, and show a small "Talking about X" pill above the
  // composer. handleComposerSubmit prepends this context (as structured
  // text) to the message sent to the chat backend so NEX can answer with
  // business awareness. Cleared after send OR when user manually dismisses.
  const [pendingBusinessContext, setPendingBusinessContext] = useState<BusinessContext | null>(null);

  function clearFullWidthTimers() {
    fullWidthTimersRef.current.forEach(clearTimeout);
    fullWidthTimersRef.current = [];
  }
  function scheduleFW(delay: number, fn: () => void) {
    fullWidthTimersRef.current.push(setTimeout(fn, delay));
  }
  // Legacy chat-full-width choreography · retired 2026-08-30 per revised
  // nav (kebab reused for MORE). Kept as a named function so it's easy to
  // resurrect if we decide to expose full-width on a different trigger.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function _legacyHandleChatFullWidthTap() {
    clearFullWidthTimers();
    if (!fullWidthMode) {
      // ENTRY sequence · Philip 2026-08-28 · pupil choreography +
      // synchronized reveal at corner arrival:
      //   Hop → looks STRAIGHT (no personality glances during the jump)
      //   Lands → looks AT the corner (destination)
      //   Floats → holds that gaze · shrinks progressively (perch scale)
      //   ARRIVED AT CORNER (t=3200) · BIG REVEAL simultaneously:
      //     · Hero fades · Rail fades · Chat text moves up 60px + spreads wider
      //     · Pupil snaps to DOWN-LEFT to look at Philip's name in chat
      //   Then hyper burst · then normal cadence at perch
      setFullWidthMode(true);
      setOrbHopped(true);
      setOrbAutoReturn(false);   // pause personality · pupil stays centred
      setOrbLookAt(null);        // ensures centre while hopping
      // t=550 · just landed · look toward the corner she's about to travel to
      scheduleFW(550, () => setOrbLookAt("up-right"));
      // t=2000 · orb travels to top-right corner along a HALF-ROUND ARC
      // (Philip 2026-08-29 · "move in half round shape up to the corner
      // position when user selects the 3 dots"). Multi-waypoint keyframe
      // curves up-then-over rather than a straight diagonal.
      scheduleFW(2000, () => {
        setOrbTransitStyle({
          animation: "nex-orb-arc-corner 1200ms cubic-bezier(0.3, 0, 0.2, 1) forwards",
        });
      });
      // t=3200 · arc completes · hand off to perched state + clear override
      scheduleFW(3200, () => {
        setOrbPerched(true);
        setOrbTransitStyle(undefined);
      });
      // t=3200 · ARRIVED · everything reveals SIMULTANEOUSLY (big WOW moment)
      scheduleFW(3200, () => {
        setHeroVisible(false);      // hero fades out
        setRailVisible(false);      // rail vanishes
        setChatFullWidth(true);     // chat moves up 60px + spreads wider
        setOrbLookAt("down-left");  // pupil looks at Philip's name below
      });
      // t=4200 · staring at Philip for 1s · release her · hyper burst
      scheduleFW(4200, () => {
        setOrbLookAt(null);
        setOrbAutoReturn(true);
        setOrbHyperMode(true);
      });
      scheduleFW(4900, () => setOrbHyperMode(false));  // settle to normal cadence
    } else {
      // EXIT sequence (1.6s snap-back)
      setChatFullWidth(false);
      setRailVisible(true);
      setOrbHyperMode(false);
      setOrbAutoReturn(false);   // pause personality during return
      setOrbLookAt("down-left"); // she looks toward where she's returning to
      scheduleFW(300, () => {
        setHeroVisible(true);
        setOrbPerched(false);    // floats back to centre
      });
      scheduleFW(1300, () => setOrbHopped(false));
      scheduleFW(1600, () => {
        setFullWidthMode(false);
        setOrbLookAt(null);
        setOrbAutoReturn(true);  // resume normal life
      });
    }
  }
  // Kebab tap · Philip 2026-08-30 · toggles the MORE secondary rail.
  // Repurposes the existing kebab affordance (rail-bottom 3-dot control
  // provided by NexHudFrame) as the entry point to the 4-button MORE
  // panel (Studio · Tools · Creator · Network). No chat/orb choreography
  // fires from this handler anymore. When a Capability Surface is active,
  // ••• also exits the capability (per locked nav architecture 2026-08-30).
  function handleKebabTap() {
    // Kebab repurposed 2026-09-01 · Philip. Old behaviour opened the MORE
    // panel (Studio / Tools / Creator / Network) — those are now reachable
    // from the + surface's 9-tile grid, so the kebab is freed up as the
    // quick-panel entry (NEX Live · Chat → friends). MORE panel logic is
    // retained for the escape flows below so a user stuck inside a
    // capability or immersive artifact still has a way out.
    if (activeCapability) {
      exitCapability();
      setMoreOpen(false);
      setKebabPanelOpen(false);
      return;
    }
    if (artifactImmersive) {
      setArtifact("chat");
      setMoreOpen(false);
      setKebabPanelOpen(false);
      return;
    }
    setMoreOpen(false);
    setKebabPanelOpen((prev) => !prev);
  }

  // ── Capability Surface handlers · Philip 2026-08-30 · Slice 1 ────────
  // URL is the source of truth. Handlers push to router; the mount+URL
  // effect below mirrors URL → state so the shell renders correctly.
  // router.push adds browser history entries so browser back walks
  // capability navigation naturally.
  function enterCapability(id: CapabilityId) {
    const def = capabilityRegistry.get(id);
    if (!def) return;
    const q = new URLSearchParams();
    q.set("cap", id);
    q.set("view", def.entryView);
    router.push(`/nexapp?${q.toString()}`);
  }
  function capabilityNavigate(view: string, params?: Record<string, string>) {
    if (!activeCapability) return;
    const q = new URLSearchParams();
    q.set("cap", activeCapability);
    q.set("view", view);
    if (params?.id) q.set("id", params.id);
    router.push(`/nexapp?${q.toString()}`);
  }
  function exitCapability() {
    // Preserve activeRoom + artifact · shell returns to whatever was underneath.
    router.push("/nexapp");
  }
  // URL → capability state sync · reactive to router-driven query changes
  // (deep-link on mount · browser back · in-app navigate). We intentionally
  // ─── Full-height PWA body lock · Philip 2026-09-02 HARD REQUIREMENT ───
  //
  // When /nexapp is mounted:
  //   1. <html> + <body> background = frame chassis #050505 so iOS
  //      safe-area zones (Dynamic Island / status bar / home indicator)
  //      render OVER a dark backdrop that matches the frame — status bar
  //      glyphs in black-translucent mode read cleanly · seamless HUD.
  //   2. <html> + <body> lock to the visual viewport with overflow:hidden
  //      so the NEX shell never document-scrolls · pull-to-refresh /
  //      rubber-band / browser-chrome show/hide can't shift the frame.
  //   3. Body position:fixed prevents mobile Safari from scrolling the
  //      body when the on-screen keyboard opens (composer stays anchored).
  //
  // All original styles are captured and restored on unmount so navigating
  // away from /nexapp doesn't leave the rest of the site locked / dark.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    const capture = {
      htmlBg:        html.style.background,
      htmlOverflow:  html.style.overflow,
      htmlHeight:    html.style.height,
      bodyBg:        body.style.background,
      bodyOverflow:  body.style.overflow,
      bodyPosition:  body.style.position,
      bodyWidth:     body.style.width,
      bodyHeight:    body.style.height,
      bodyMargin:    body.style.margin,
    };
    html.style.background = "#050505";
    html.style.overflow   = "hidden";
    html.style.height     = "100dvh";
    body.style.background = "#050505";
    body.style.overflow   = "hidden";
    body.style.position   = "fixed";
    body.style.width      = "100%";
    // Fallback chain · dvh (dynamic · adjusts with browser UI) → svh
    // (small · fits when browser chrome is visible) → 100% (last resort).
    // Setting height with a later value overrides earlier for browsers
    // that don't understand the newer unit.
    body.style.height     = "100svh";
    body.style.height     = "100dvh";
    body.style.margin     = "0";
    return () => {
      html.style.background = capture.htmlBg;
      html.style.overflow   = capture.htmlOverflow;
      html.style.height     = capture.htmlHeight;
      body.style.background = capture.bodyBg;
      body.style.overflow   = capture.bodyOverflow;
      body.style.position   = capture.bodyPosition;
      body.style.width      = capture.bodyWidth;
      body.style.height     = capture.bodyHeight;
      body.style.margin     = capture.bodyMargin;
    };
  }, []);

  // do NOT run the reverse (state → URL) as an effect · handlers above push
  // the URL directly, so this is a one-way mirror without loop risk.
  useEffect(() => {
    const capParam = searchParams?.get("cap") ?? null;
    const viewParam = searchParams?.get("view") ?? null;
    const idParam = searchParams?.get("id") ?? null;
    if (capParam && capabilityRegistry.has(capParam)) {
      const def = capabilityRegistry.get(capParam as CapabilityId)!;
      const viewId = viewParam && def.views[viewParam] ? viewParam : def.entryView;
      setActiveCapability(capParam as CapabilityId);
      setCapabilityFrame({ view: viewId, params: idParam ? { id: idParam } : undefined });
    } else if (activeCapability !== null) {
      setActiveCapability(null);
      setCapabilityFrame(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  // Mascot stage state lifted UP so the interiorHeader slot (rendered in
  // NexHudFrame at z:30 above the bezel) can access `currentMascot` and
  // render the preview bubble directly under the "Mascot" title text in
  // the same DOM node · guaranteed stacked · Philip 2026-08-27.
  const [mascotSection, setMascotSection] = useState<MascotSection>("react");
  const [mascotHeroIndex, setMascotHeroIndex] = useState(0);
  const allMascotsWithArt = useMemo(
    () => listMascots().filter((m) => m.hasArtwork),
    [],
  );
  const filteredMascots = useMemo(
    () => allMascotsWithArt.filter((m) => m.section === mascotSection),
    [allMascotsWithArt, mascotSection],
  );
  const currentMascot = filteredMascots[Math.min(mascotHeroIndex, Math.max(0, filteredMascots.length - 1))];

  // Real chat pipeline · useNexVoice hoisted here so composer + transcript sync.
  // First message from NEX · Philip 2026-08-28. Seeded so users always see a
  // proper NEX greeting on load (not empty). Seeded via useEffect (client-only)
  // so nowClock() doesn't create an SSR/hydration mismatch.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setMessages((prev) => (prev.length > 0 ? prev : [{
      id:   "nex-welcome",
      sender: "nex",
      text: "Hi. Ask me anything — food, stays, markets, or transport in your city.",
      time: nowClock(),
      // Canned greeting · NEX-authored not sourced from brain · NEX KNOWLEDGE
      // per project_nex_fact_vs_knowledge_doctrine_2026_08_28.md.
      truthClass: "ai_generated",
      truthSource: "NEX greeting",
    }]));
  }, []);
  const [inputText, setInputText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // Recent-pages history tracking · Philip 2026-09-01.
  // On every artifact / capability change, push the new destination onto
  // an MRU stack (deduped, capped at 8). Empty ("chat" with no capability)
  // is not tracked · going HOME shouldn't count as a "recent page".
  useEffect(() => {
    const label = pageLabel(activeCapability, artifact);
    const glyph = pageGlyph(activeCapability, artifact);
    if (!label) return; // chat home · nothing to track
    const id = activeCapability ? `cap:${activeCapability}` : `art:${artifact}`;
    setRecentPages((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      const kind: RecentPage["kind"] = activeCapability ? "capability" : "artifact";
      return [{ id, label, glyph, kind }, ...filtered].slice(0, 8);
    });
  }, [artifact, activeCapability]);

  // Auto-close the recent-pages panel when the user starts typing (Philip
  // 2026-09-01 · "if the user … active to type it will close").
  useEffect(() => {
    if (recentPagesOpen && inputText.length > 0) setRecentPagesOpen(false);
  }, [inputText, recentPagesOpen]);
  // Same rule for the kebab quick-panel.
  useEffect(() => {
    if (kebabPanelOpen && inputText.length > 0) setKebabPanelOpen(false);
  }, [inputText, kebabPanelOpen]);

  function nowClock() {
    const d = new Date();
    const hh = ((d.getHours() + 11) % 12) + 1;
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${String(hh).padStart(2, "0")}:${mm} ${d.getHours() < 12 ? "AM" : "PM"}`;
  }
  function newMessageId(prefix: "u" | "n") {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const voice = useNexVoice({
    language: "en",
    onPartial:   (t) => setInputText(t),
    onUserFinal: (text) => {
      setInputText("");
      // Slice C2 · Philip 2026-08-30 · sendText for typed messages may carry
      // a [BUSINESS CONTEXT] prefix (structured metadata for the backend).
      // Strip that here so the displayed user bubble and the dedupe key both
      // use the clean question, matching what handleComposerSubmit inserted.
      const clean = text.replace(/^\[BUSINESS CONTEXT\][\s\S]*?\[\/BUSINESS CONTEXT\]\n\n/, "");
      // Dedupe · Philip 2026-08-28. handleComposerSubmit already inserts the
      // user bubble immediately when text is typed + submitted, then calls
      // voice.sendText which fires onUserFinal with the SAME text · would
      // insert a second identical bubble. Skip when the last message already
      // matches (same sender + same text). Voice-mic input still works: the
      // last message when voice speaks is NEX (or empty), so insertion fires.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === "user" && last.text === clean) return prev;
        return [...prev, { id: newMessageId("u"), sender: "user", text: clean, time: nowClock() }];
      });
    },
    onNexReply: (reply) => {
      // Default truthClass 'ai_generated' (NEX KNOWLEDGE badge) for LLM
      // replies until the reply pipeline provides a specific truthClass
      // (e.g. 'confirmed_fact' when the reply is a citation from brain).
      // Philip 2026-08-28 · project_nex_fact_vs_knowledge_doctrine.
      setMessages((prev) => [...prev, {
        id: newMessageId("n"),
        sender: "nex",
        text: reply,
        time: nowClock(),
        truthClass: "ai_generated",
        truthSource: "NEX conversational response",
      }]);
    },
    onError: (msg) => setChatError(msg),
  });

  // ═══ BATCH 7 · Ceremony intro speech · Philip 2026-08-29 ═══
  //
  // Kept in a ref so both the timeline effect (t=6600) and the retry
  // handler wired to the orb (during "failed" phase) can invoke exactly
  // the same routine without re-triggering the timeline itself.
  //
  // The intro is a SCRIPTED performance · bypasses /api/nex-conv/chat.
  // Voice.speak returns durationMs · <1000 means the browser resolved
  // the utterance instantly with no audio (iOS Safari autoplay block
  // is the common cause). Per Philip 2026-08-29 · activation must stay
  // honest: only a real completed utterance calls markIntroduced().
  useEffect(() => {
    const displayName =
      identityState.status === "ready"
        ? (identityState.identity.name.trim().split(/\s+/)[0] || identityState.identity.name)
        : "there";
    const intro =
      `Hi ${displayName}, and welcome to NEX. ` +
      `Great to have you here. ` +
      `I'm here whenever you need me — to help, to chat, or just hang out. ` +
      `So... what's on your mind today? ` +
      `And don't worry about learning everything on day one. ` +
      `There's a lot here, and there's plenty more on the way. ` +
      `Once you've got the NEX roadmap mastered, you'll never look back. ` +
      `They say it's like riding a bicycle.`;
    speakIntroRef.current = async () => {
      setEyeBubble(null);
      setCeremonyPhase("speaking");
      try {
        const { durationMs } = await voice.speak(intro);
        if (durationMs >= 1000) {
          setCeremonyPhase("complete");
          setCeremonyFrameOverride(null);
          markIntroduced();
        } else {
          setCeremonyPhase("failed");
          setEyeBubble({ text: "🔊 tap orb", dwellMs: 60_000 });
        }
      } catch {
        setCeremonyPhase("failed");
        setEyeBubble({ text: "🔊 tap orb", dwellMs: 60_000 });
      }
    };
  }, [identityState, voice, markIntroduced]);

  // Ceremony timeline · fires once on entry to "activating" post-hydration.
  // In-memory ref guard prevents duplicate firing across React re-renders.
  // Grandfathered users skip because their activationState is "active" on
  // hydration (see useNexActivation grandfather effect · STEP 2).
  useEffect(() => {
    if (ceremonyStartedRef.current) return;
    if (activationLoading) return;
    if (activationState !== "activating") return;
    if (identityState.status !== "ready") return;

    ceremonyStartedRef.current = true;
    setCeremonyPhase("dark");
    setCeremonyRevealStep(0);
    setCeremonyFrameOverride("off");

    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => { setCeremonyRevealStep(1); setCeremonyPhase("revealing"); }, 1200));
    timers.push(setTimeout(() => setCeremonyRevealStep(2), 2000));
    timers.push(setTimeout(() => setCeremonyRevealStep(3), 2800));
    timers.push(setTimeout(() => setCeremonyRevealStep(4), 3600));
    timers.push(setTimeout(() => { setCeremonyRevealStep(5); setCeremonyPhase("full"); }, 4400));
    timers.push(setTimeout(() => setCeremonyFrameOverride("normal"), 5600));
    timers.push(setTimeout(() => setCeremonyPhase("orb-wake"), 6100));
    timers.push(setTimeout(() => { void speakIntroRef.current?.(); }, 6600));

    return () => timers.forEach(clearTimeout);
  }, [activationLoading, activationState, identityState]);

  // Ambient Knowledge Injector · Philip 2026-08-28. Silence-only triggering
  // (≥90s inactive AND ≥30s since last keystroke). Fires DID YOU KNOW / THEY
  // SAY frosted glass cards inline when the conversation stalls. See doctrine:
  // project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md
  useAmbientInjector({
    messages,
    isTyping: inputText.length > 0,
    isVoiceReplying: voice.state === "speaking",
    onInject: (item) => {
      setMessages((prev) => [...prev, {
        id: `amb-${item.id}`,
        sender: "nex",
        kind: "ambient",
        ambientVariant: item.variant,
        text: item.body,
        time: nowClock(),
        truthClass: item.truthClass,
        truthSource: `${item.title} · ${item.source}`,
      }]);
    },
  });

  // Voice-state override for design testing:
  //   ?voiceState=idle|listening|thinking|speaking|error → freeze on a state
  //   ?voiceDemo=true                                    → cycle every 3s
  const voiceStateOverride = searchParams?.get("voiceState");
  const voiceDemoMode      = searchParams?.get("voiceDemo") === "true";
  const [demoState, setDemoState] = useState<import("@/lib/nex-voice").NexVoiceState>("idle");
  useEffect(() => {
    if (!voiceDemoMode) return;
    const cycle: import("@/lib/nex-voice").NexVoiceState[] = ["idle", "listening", "thinking", "speaking", "error"];
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % cycle.length;
      setDemoState(cycle[i]);
    }, 3000);
    return () => clearInterval(t);
  }, [voiceDemoMode]);
  const nexState: import("@/lib/nex-voice").NexVoiceState =
    voiceDemoMode ? demoState :
    (voiceStateOverride === "idle" || voiceStateOverride === "listening" ||
     voiceStateOverride === "thinking" || voiceStateOverride === "speaking" ||
     voiceStateOverride === "error") ? voiceStateOverride
    : voice.state;

  function handleComposerSubmit() {
    const text = inputText.trim();
    if (!text) return;
    setChatError(null);
    setInputText("");
    // Business Onboarding branch · Philip 2026-09-05 M1-A.
    // When the active artifact is business-onboarding the composer submit
    // feeds acceptBusinessOnboardingReply() which advances the local
    // structured draft (localStorage: nex.business-profile.draft.v1).
    // No chat launch · no backend · no workforce touched.
    if (artifact === "business-onboarding") {
      acceptBusinessOnboardingReply(text);
      return;
    }
    // Cancel any pending typing-release timer so it can't fire mid-launch
    // and yank the orb pupil back before handleChatLaunchStart's 2s post-
    // follow finishes. Launch sequence owns the gaze from here.
    if (typingReleaseTimerRef.current) {
      clearTimeout(typingReleaseTimerRef.current);
      typingReleaseTimerRef.current = null;
    }
    // NEX ASSIST branch · Philip 2026-09-03 PRIVATE mode. When the
    // ✨ NEX button is active in the composer, submits are directed
    // to NEX (not to Alex). NEX's reply appends as a "nex-private"
    // message · rendered as a distinct orange-bordered container in
    // the chat thread, visible only to the current user. Auto-exits
    // assist mode after each send.
    if (activeFriendId && artifact === "messages-friends" && nexAssistMode) {
      const friend = NEX_MOCK_FRIENDS.find((f) => f.id === activeFriendId);
      const friendName = friend?.name.split(" ")[0] ?? "there";
      // Mock canned response for now · real NEX AI call wires later.
      const mockNexReply = `Here's a suggested reply · "Hi ${friendName}, good to catch up. How can I help?"`;
      const nexMsg: FriendMessage = {
        id: newMessageId("n"),
        sender: "nex-private",
        text: mockNexReply,
        time: nowClock(),
        dateISO: new Date().toISOString(),
      };
      setFriendThreads((prev) => ({
        ...prev,
        [activeFriendId]: [...(prev[activeFriendId] ?? []), nexMsg],
      }));
      setNexAssistMode(false);
      return;
    }
    // Friend-chat submit · Philip 2026-09-02.
    //   When a friend chat is open, route the message into that friend's
    //   thread (as sender="user" → renders as "You" with rail dot on the
    //   right side) instead of sending to NEX. Voice/backend not invoked.
    if (activeFriendId && artifact === "messages-friends") {
      // Explicit-only reply · Philip 2026-09-03 "when i just now wanted
      // you to post on her own · when i selected send · it jumped into
      // alex container · i did not swipe alex container for reply or
      // see the cursor". Reverts the earlier implicit-reply-to-latest
      // behavior: a send with NO explicit friendReplyTarget posts as a
      // solo "You container" (no replyTo), matching the locked visual
      // rule "solo user post = single container with 2px green left
      // edge, not nested inside Alex". Only an explicit swipe / bubble
      // selection creates a reply-post (double-bubble).
      const explicitTargetId = friendReplyTarget?.id;
      const msg: FriendMessage = {
        id: newMessageId("u"),
        sender: "user",
        text,
        time: nowClock(),
        // Machine-parseable timestamp so the header renders "just now"
        // then ticks to "5m ago" etc. over time (Philip 2026-09-02).
        dateISO: new Date().toISOString(),
        // Attach replyTo ONLY when explicitly selected.
        ...(explicitTargetId ? { replyTo: explicitTargetId } : {}),
      };
      setFriendThreads((prev) => ({
        ...prev,
        [activeFriendId]: [...(prev[activeFriendId] ?? []), msg],
      }));
      // Keep selection + composer + keypad exactly as they are on
      // post · Philip 2026-09-03 "i dont want you to change the
      // design when i press post". The sent message throws to the
      // end of the feed, the selected Alex bubble stays selected,
      // the nested green draft area empties (inputText cleared
      // above) and stays ready for the next reply, and the keypad
      // stays open. Do NOT clear friendReplyTarget · do NOT blur
      // the composer · do NOT setComposerFocused(false) · do NOT
      // glance("down") · the design does not change on post.
      // Clear this friend's persisted draft — the message is sent, no
      // draft to restore on next visit (Philip 2026-09-02 · world-class).
      setFriendDrafts((d) => {
        if (!(activeFriendId in d)) return d;
        const { [activeFriendId]: _drop, ...rest } = d;
        return rest;
      });

      // Simulate the friend replying · Philip 2026-09-02 world-class.
      // 800ms after user sends → friend enters typing state (avatar
      // shows dots). ~2.4s later → friend's reply throws in from the
      // left-avatar direction. Demonstrates the full round-trip.
      const capturedFriendId = activeFriendId;
      simulateFriendReply(capturedFriendId, text);
      return;
    }
    // Slice C2 · Philip 2026-08-30 · Ask NEX context attach.
    // If a pending business context is set, display shows user's clean
    // question but the backend receives a structured context block so
    // NEX can answer about that specific business. Context clears after
    // send · a follow-up question won't repeat the header unless the
    // user re-attaches from the directory.
    const ctx = pendingBusinessContext;
    const backendText = ctx
      ? `[BUSINESS CONTEXT]\nName: ${ctx.name}\nCuisine: ${ctx.cuisine}\nDistance: ${ctx.distanceKm.toFixed(1)} km\nRating: ${ctx.rating.toFixed(1)}\nStatus: ${ctx.openStatus}\n[/BUSINESS CONTEXT]\n\n${text}`
      : text;
    setMessages((prev) => [...prev, { id: newMessageId("u"), sender: "user", text, time: nowClock() }]);
    void voice.sendText(backendText, { speak: false });
    if (ctx) setPendingBusinessContext(null);
    composerRef.current?.focus();

    // Philip 2026-08-29 · composer-intent narration removed. Detect intent
    // is still available for auto-navigation, but the guide() speech bubbles
    // + beam performance are no longer fired here.
    // Philip 2026-08-30 · Slice C2 · when the message was sent with an attached
    // business context the user is asking about that specific business, so we
    // suppress category auto-nav ("dinner" keyword shouldn't jump them to the
    // food listing when they were just chatting with NEX about one restaurant).
    if (!ctx) {
      const intent = detectIntent(text);
      if (intent) {
        if (intent.target === "food") {
          setTimeout(() => setArtifact("food"), 900);
        }
        if (intent.target === "discovery") {
          setTimeout(() => setArtifact("services"), 900);
        }
      }
    }

    glance("down"); // Look toward the composer/messages after submit.

    // Orb first-flight to park · Philip 2026-09-01.
    // If this is the first submit (orb still at hero-centre), pick a random
    // flight variant, run the keyframe animation, and mark the orb as
    // parked once the flight completes. Fires ONCE per session — subsequent
    // submits leave the orb where it is.
    if (orbHomeState === "hero-center") {
      const variant = Math.floor(Math.random() * 4); // 0-3 → four different arcs
      setOrbFlightVariant(variant);
      setOrbHomeState("flying");
      // Duration matches the CSS keyframe duration (see shell style block).
      scheduleTransit(1500, () => setOrbHomeState("parked"));
    }
  }

  // Composer focus / typing → orb looks DOWN toward the input.
  // Philip 2026-09-01 · continuous typing gaze. While the user is actively
  // typing, the orb holds its gaze on the composer input area (rather than
  // wandering off after a single-keystroke glance). Each keystroke resets a
  // 550ms release timer; when typing pauses beyond that, orb returns to the
  // natural random idle gaze (personality scheduler resumes because
  // autoReturn flips back to true and lookAt clears).
  const typingReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function releaseTypingGaze() {
    if (typingReleaseTimerRef.current) {
      clearTimeout(typingReleaseTimerRef.current);
      typingReleaseTimerRef.current = null;
    }
    setOrbLookAt(null);
    setOrbAutoReturn(true);
  }
  function holdTypingGaze() {
    setOrbLookAt("down");
    setOrbAutoReturn(false);
    if (typingReleaseTimerRef.current) clearTimeout(typingReleaseTimerRef.current);
    typingReleaseTimerRef.current = setTimeout(releaseTypingGaze, 550);
  }
  function handleComposerFocus() { holdTypingGaze(); }
  function handleComposerChange(v: string) {
    setInputText(v);
    holdTypingGaze(); // Hold gaze on every keystroke · debounced release.
  }

  const themeParam = searchParams?.get("theme") ?? DEFAULT_THEME_ID;
  const themeId = NEX_HUD_THEME_REGISTRY[themeParam] ? themeParam : DEFAULT_THEME_ID;

  // Live discovery signal → contextual workspace card.
  const [discovery, setDiscovery] = useState<DiscoveryPayload | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/nexapp/latest-discovery", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as DiscoveryPayload;
        if (!cancelled) setDiscovery(data);
      } catch { /* silent */ }
    }
    poll();
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Eye look system · the orb's pupil turns toward whatever the user just
  // interacted with (Philip 2026-08-26). setLookAt fires · orb holds ~700ms ·
  // returns to centre with natural micro-drift + occasional idle glance.
  const [orbLookAt, setOrbLookAt] = useState<OrbLookDirection | null>(null);
  function glance(dir: OrbLookDirection) {
    // Deliberate acknowledgement · always look at the exact target the user
    // interacted with (Philip 2026-08-26: no adjacent-direction randomness).
    setOrbLookAt(dir);
    setTimeout(() => setOrbLookAt(null), 750);
  }

  // Orb follows launched chat messages · Philip 2026-08-28.
  //
  // Timeline (per launch):
  //   t=0     · pupil starts moving to launch direction · 1s transition
  //   t=1000  · pupil at destination · holds still watching
  //   t=2000  · pupil starts returning to centre · duration varies per sender
  //             NEX-launched: slow contemplative return (900ms)
  //             USER-launched: quick decisive return (400ms)
  //   t=2000+returnMs · reset props · personality scheduler resumes
  //
  // autoReturn=false during the sequence so the orb's internal 700ms timer
  // doesn't fire early and yank the pupil back before the hold completes.
  const [orbPupilTransitionMs, setOrbPupilTransitionMs] = useState<number | undefined>(undefined);
  const [orbAutoReturn, setOrbAutoReturn] = useState(true);
  const launchGazeTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  function handleChatLaunchStart(direction: "up-right" | "up-left") {
    // Cancel any pending timers from a prior launch (rapid-fire launches).
    launchGazeTimersRef.current.forEach(clearTimeout);
    launchGazeTimersRef.current = [];

    // Outbound · 1s follow
    setOrbPupilTransitionMs(1000);
    setOrbAutoReturn(false);
    setOrbLookAt(direction);

    // Return · different per sender (up-right = NEX msg, up-left = USER msg)
    const returnMs = direction === "up-right" ? 900 : 400;

    // At t=2000, start return with the per-sender transition
    launchGazeTimersRef.current.push(setTimeout(() => {
      setOrbPupilTransitionMs(returnMs);
      setOrbLookAt(null);
    }, 2000));

    // At t=2000+returnMs, reset · personality scheduler resumes
    launchGazeTimersRef.current.push(setTimeout(() => {
      setOrbPupilTransitionMs(undefined);
      setOrbAutoReturn(true);
      launchGazeTimersRef.current = [];
    }, 2000 + returnMs));
  }

  // ── Eye conversation state machine ─────────────────────────────────────
  // Eye is CHARACTER · voice button is the mic. Tapping eye triggers a
  // phrase + pupil looks at target + precision guidance beam fires from
  // pupil to the actual voice button (Philip 2026-08-26 guidance system).
  const [eyeConvState, setEyeConvState] = useState<EyeConversationState>(initialEyeState());
  const [eyeBubble, setEyeBubble] = useState<{ text: string; dwellMs?: number } | null>(null);
  const guidance = useGuidance();
  // Any active guidance beam (arming · firing · fading) turns the eye red.
  // Arming phase runs ~380ms BEFORE the beam is visible · that's the
  // "split second before" Philip asked for.
  const orbFlashRed = guidance.activeBeams.length > 0;

  // ── Butterfly cinematic (first-arrival · Philip 2026-08-28) ────────────
  // While active, disable orb autoReturn + hyperMode so butterfly's pupil
  // direction updates aren't fought by the personality scheduler.
  const [butterflyActive, setButterflyActive] = useState(false);
  function handleButterflyPupil(dir: OrbLookDirection | null) {
    setOrbLookAt(dir);
  }
  function handleButterflyFireBeam() {
    // Philip 2026-08-29 · beam disabled. Butterfly still visits, but NEX no
    // longer fires a laser at her. The cinematic keeps its pupil-follow
    // behavior (handleButterflyPupil above) so the butterfly is still
    // acknowledged — just without the shooting/red-eye moment.
  }
  // Unified NEX guidance intent API · speech + pupil + beam as one performance ·
  // serial queue · one guide at a time.
  const guide = useNexGuide({
    setEyeLook: setOrbLookAt,
    setBubble:  setEyeBubble,
  });
  // Double-tap detector · Philip 2026-08-28. Two taps within 300ms toggle
  // NEX's "hop down" mode (duck legs · orb dismounts DOWN out of her circle).
  // Single tap fires the normal eye conversation after the double-tap window
  // expires · adds ~300ms latency to single tap in exchange for a signature
  // double-tap gesture.
  const [orbHopped, setOrbHopped] = useState(false);
  const eyeTapDoubleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Return-home orb reset · Philip 2026-08-29.
  // Whenever the artifact becomes "chat", clear any perched/hopped/transit
  // state so the orb glides back to its hero-centre home. The existing
  // 1200ms transform transition on the orb container (NexHudFrame) makes
  // the return smooth regardless of where the orb was before.
  useEffect(() => {
    if (artifact === "chat") {
      setOrbPerched(false);
      setOrbHopped(false);
      setOrbTransitStyle(undefined);
    }
    // Only react to the artifact identity change · state setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifact]);

  // Auto orb fly-off when chat starts building up · Philip 2026-08-29 BATCH 1.
  // Uses DEDICATED off-screen animation (nex-orb-fly-offscreen) and holds
  // the orb off-screen via a persistent transit style · does NOT set
  // perched (perched = visible top-right for kebab tap). Two orb behaviors
  // are architecturally SEPARATE:
  //   · kebab tap        → arc → perched (visible top-right)
  //   · chat auto-fly    → fly-off → transit-style held off-screen
  // Reverses (returns to hero centre) when chat is back to only the seed.
  const chatFlyOffTransit: React.CSSProperties = {
    transform: "translate(220%, -20%) scale(1)",
    // Animation applies the entry, forwards fill locks final state.
    animation: "nex-orb-fly-offscreen 1200ms cubic-bezier(0.3, 0, 0.2, 1) forwards",
  };
  useEffect(() => {
    if (artifact !== "chat") return;
    const chatBuildingUp = messages.length > 1;
    const isFlyingOff = orbTransitStyle?.animation === chatFlyOffTransit.animation;
    if (chatBuildingUp && !isFlyingOff) {
      // Trigger off-screen fly-off · hold transit style (do NOT clear ·
      // do NOT set perched).
      clearTransitTimers();
      setOrbTransitStyle(chatFlyOffTransit);
    } else if (!chatBuildingUp && isFlyingOff) {
      // Back to only the seed · clear transit · orb glides home via
      // base transform transition.
      clearTransitTimers();
      setOrbTransitStyle(undefined);
    }
    // Only react to message-count / artifact change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, artifact]);

  // ── Page-transition orb choreography · Philip 2026-08-29 ──
  // When user navigates FROM chat TO another workspace, NEX:
  //   1. hops down (existing orbHopped state)
  //   2. flies off screen in a random direction (left / right / up)
  //   3. page swaps behind the fade
  //   4. re-enters at top-right corner and parks (perched)
  const [orbTransitStyle, setOrbTransitStyle] = useState<React.CSSProperties | undefined>(undefined);
  // Orb home-state · Philip 2026-09-01.
  // First-time arrival: orb sits at the CENTRE of the hero area. On first
  // successful text submit, orb dips DOWN then hovers UP to the top-right
  // PARKED slot (locked in geometry.ts). Flight path is random per submit
  // (4 CSS keyframe variants) so each parking feels alive, not mechanical.
  // After parking, orb stays at the base (park) position — this transition
  // fires ONCE per session.
  const [orbHomeState, setOrbHomeState] = useState<"hero-center" | "flying" | "parked">("hero-center");
  const [orbFlightVariant, setOrbFlightVariant] = useState<number>(0);
  const transitTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  function clearTransitTimers() {
    transitTimersRef.current.forEach(clearTimeout);
    transitTimersRef.current = [];
  }
  function scheduleTransit(delay: number, fn: () => void) {
    transitTimersRef.current.push(setTimeout(fn, delay));
  }
  function navigateWithOrb(target: WorkspaceArtifact) {
    const wasOnChat = artifact === "chat";
    const isSameTarget = target === artifact;
    // Skip the sequence when we're not leaving chat, or the target hasn't
    // changed, or the target IS chat (returning home doesn't warrant the
    // whole flight sequence).
    if (isSameTarget) return;
    if (!wasOnChat || target === "chat") {
      setArtifact(target);
      return;
    }
    clearTransitTimers();

    // Random exit direction · never the same twice in a row (approx by
    // avoiding the most-recent). Kept as a simple 3-way pick for now.
    const dirs = ["left", "right", "up"] as const;
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const exitTransform =
      dir === "left"  ? "translate(-180%, 30%) scale(0.5)" :
      dir === "right" ? "translate(180%, 30%) scale(0.5)"  :
                        "translate(20%, -220%) scale(0.5)";

    // Phase A · hop down (uses existing orbHopped)
    setOrbHopped(true);

    // Phase B · slide off screen + fade (starts ~180ms after hop)
    scheduleTransit(180, () => {
      setOrbTransitStyle({
        transform: exitTransform,
        opacity: 0,
        transition: "transform 700ms cubic-bezier(0.4, 0, 0.6, 1), opacity 700ms ease-in",
      });
    });

    // Phase C · swap page + snap orb to invisible top-right entry position
    scheduleTransit(950, () => {
      setArtifact(target);
      setOrbHopped(false);
      setOrbTransitStyle({
        transform: "translate(200%, -160%) scale(0.5)",
        opacity: 0,
        transition: "none",
      });
    });

    // Phase D · fade in + settle at parked (top-right) position
    scheduleTransit(1050, () => {
      setOrbTransitStyle({
        transform: "translate(110%, -70%) scale(1)",
        opacity: 1,
        transition: "transform 600ms cubic-bezier(0.25, 0, 0.2, 1), opacity 500ms ease-out",
      });
    });

    // Phase E · park (hand off to existing perched state, clear override)
    scheduleTransit(1650, () => {
      setOrbPerched(true);
      setOrbTransitStyle(undefined);
    });
  }

  function handleEyeTap() {
    // Second tap within the window → it's a double-tap → toggle hop
    if (eyeTapDoubleTimerRef.current) {
      clearTimeout(eyeTapDoubleTimerRef.current);
      eyeTapDoubleTimerRef.current = null;
      setOrbHopped((prev) => !prev);
      return;
    }
    // First tap · schedule the single-tap handler after the double-tap window
    eyeTapDoubleTimerRef.current = setTimeout(() => {
      eyeTapDoubleTimerRef.current = null;
      handleEyeSingleTap();
    }, 300);
  }

  function handleEyeSingleTap() {
    const { state, phrase } = reduceEyeTap(eyeConvState);
    setEyeConvState(state);
    if (!phrase) {
      // Silent window · orb doesn't even respond visually.
      setEyeBubble(null);
      return;
    }
    // Use guide() so eye-tap flows through the same coordinated timeline as
    // proactive guidance · pupil settle → beam → target pulse → return.
    // The state machine already picked the exact phrase id · pass it through
    // so the picker doesn't double-select.
    guide({ target: "eye-tap", intent: "introduce", phraseId: phrase.id });
  }
  function handleVoiceButtonUsed() {
    setEyeConvState((s) => reduceVoiceButtonUsed(s));
  }

  // Right rail · 5 canonical rooms · Philip locked 2026-08-29 (Five-Button IA
  // doctrine). Tapping a rail button OPENS THE ROOM DRAWER · it does NOT
  // change the workspace directly. Sub-section tap inside the drawer will
  // change workspace (Phase 2+). Toggle-off: tapping the active room's rail
  // button closes the drawer and returns to the underlying workspace intact.
  // Rail-button tap · Philip 2026-08-29 · SILENT open (no orb hop).
  // Philip's update: rail buttons no longer trigger the orb flight sequence.
  // NEX stays in place while the drawer opens. Arc-to-corner motion is
  // reserved for the KEBAB tap (see handleKebabTap · half-round arc up to
  // the top-right corner).
  const openRoom = (id: RoomId) => {
    // If a Capability Surface is active, primary rail tap leaves the
    // capability first · then opens the room. exitCapability() also closes
    // MORE via the URL push to /nexapp. Philip 2026-08-30 · Slice 1.
    if (activeCapability) {
      exitCapability();
    }
    setMoreOpen(false);
    setActiveRoom((cur) => (cur === id ? null : id));
  };
  // triggerOrbHop kept as a private helper in case future surfaces want the
  // hop sequence · currently unused by rail buttons.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function triggerOrbHop(_id: RoomId) {
    clearTransitTimers();
    // Random direction each tap · never all the same.
    const dirs = ["left", "right", "up"] as const;
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    const offTransform =
      dir === "left"  ? "translate(-140%, 20%) scale(0.6)" :
      dir === "right" ? "translate(140%, 20%) scale(0.6)"  :
                        "translate(15%, -180%) scale(0.6)";
    setOrbHopped(true);
    scheduleTransit(180, () => {
      setOrbTransitStyle({
        transform: offTransform,
        opacity: 0,
        transition: "transform 600ms cubic-bezier(0.4, 0, 0.6, 1), opacity 600ms ease-in",
      });
    });
    // Re-appear at top-right corner (parked) so the orb is out of the way
    // while the user reads the drawer / discovery stage.
    scheduleTransit(950, () => {
      setOrbTransitStyle({
        transform: "translate(200%, -170%) scale(0.5)",
        opacity: 0,
        transition: "none",
      });
    });
    scheduleTransit(1050, () => {
      setOrbTransitStyle({
        transform: "translate(110%, -70%) scale(1)",
        opacity: 1,
        transition: "transform 550ms cubic-bezier(0.25, 0, 0.2, 1), opacity 450ms ease-out",
      });
    });
    scheduleTransit(1600, () => {
      setOrbHopped(false);
      setOrbPerched(true);
      setOrbTransitStyle(undefined);
    });
  }
  // Philip 2026-08-29 · silent open (no guide() speech bubble). Icon-only
  // rail (no visible labels · aria-label preserved).
  // Accent behaviour: default is high-quality WHITE for all 5 icons (Philip
  // 2026-08-29). When a room is active, its button turns BLUE and the other
  // four dim to grey · reads as "the active room is the current system
  // focus, everything else is off".
  const RAIL_WHITE  = "#ffffff";
  const EXPLORE_ORB = "#fb923c"; // NEX orb core · Philip 2026-08-29 (was cyan blue)
  const RAIL_DIM    = "rgba(120, 128, 140, 0.55)";
  // Right-side rail button arrays (primary + MORE) deleted 2026-09-06
  // per Founder direction. hideRail=true on NexHudFrame keeps the frame
  // chrome clean · rightRailContent is fed an empty array so nothing
  // gets rendered even if hideRail were flipped off in the future.
  const railContent: RailButton[] = [];

  // Header icons · 2 slots (Philip 2026-09-03 · removed Search + Bell).
  // Home in slot 1 · Chat-menu (3-dots) in slot 2 · slot 3 empty.
  // The 3-dots dispatches a window event that NexFriendChatView picks up
  // to open a compact "this chat" actions panel (Profile / Mute / Clear).
  const headerIcons: HeaderIconButton[] = [
    { id: "home",   label: "Home · back to chat", icon: <IconHome />, guidanceTarget: "header-home",
      onClick: () => { router.push("/nexapp"); setArtifact("chat"); glance("up"); } },
    { id: "control-center", label: "Control Center · account & preferences", icon: <IconDots />, guidanceTarget: "header-control-center",
      onClick: () => {
        // Phase D §5 · three-dot opens the user's NEX Control Center
        // (Account / Conversation / Privacy / Your World / NEX groups).
        // The chat-actions drawer previously wired here now lives inside
        // the chat surface itself where it belongs contextually.
        setControlCenterOpen(true);
        glance("up");
      } },
  ];

  // Discovery context card removed 2026-08-28 (Philip · "remove this container
  // NEX is searching providers near Klaten"). Discovery status remains observable
  // in /nex-head-quarters/discovery for HQ · not surfaced in the chat interior.

  // ═══ BATCH 7 · Ceremony-derived render inputs · Philip 2026-08-29 ═══
  // Only produce non-default values while a ceremony is actively running.
  // "complete" and "idle" phases return the shell to its normal behavior
  // so no path outside the ceremony window is affected.
  const ceremonyActive =
    ceremonyPhase !== "idle" && ceremonyPhase !== "complete";
  // Rail-housing accent regions light up sequentially as revealStep grows.
  // Absent housings default to 0 via NexHudFrame's per-region rule (see
  // its accentRegionOpacities docstring · railHousing* default hidden).
  const ceremonyAccentOpacities = ceremonyActive
    ? (() => {
        const map: Record<string, number> = {};
        for (let i = 1; i <= ceremonyRevealStep; i++) {
          map[`railHousing${i}`] = 1;
        }
        return map;
      })()
    : undefined;
  // Rail buttons render top-to-bottom in lockstep with their housings.
  const ceremonyVisibleRailButtons = ceremonyActive ? ceremonyRevealStep : undefined;
  // frameMode override chain: LIVE mode wins (existing behavior) → then
  // ceremony override → then activation-derived default. Never lets the
  // ceremony fight liveOpen.
  const resolvedFrameMode: "off" | "cinema" | "normal" | "dim" =
    liveOpen ? "cinema" : (ceremonyFrameOverride ?? activationFrameMode);
  // Orb tap during "failed" ceremony phase retries the intro speech.
  // In every other phase, the normal handleEyeTap runs (double-tap
  // detection · single-tap conversation state machine · unchanged).
  const resolvedOrbTap =
    ceremonyPhase === "failed"
      ? () => { void speakIntroRef.current?.(); }
      : handleEyeTap;

  // ═════════════════════════════════════════════════════════════════════
  // Immersive Mode · Philip 2026-08-30 · Slice A · Persistent Identity Rule
  //
  // When the active surface declares it needs maximum content space
  // (video · directory cards · dating universe · etc.), the shell:
  //   · collapses the 5-button primary rail (hideRail)
  //   · perches the orb to top-right corner (voiceOrbPerched)
  //   · NEXT best · orb stays visible per Persistent Identity Rule
  //
  // Two sources trigger it:
  //   1. Active capability declares wants.railCollapse === true (declarative)
  //   2. Active workspace artifact is in IMMERSIVE_ARTIFACTS (hardcoded set)
  //
  // Slice A ships LIVE as first test consumer via the artifact set. Later
  // slices may extend to People (dating) and Businesses (directory).
  //
  // Rail can still be manually expanded/collapsed via kebab · this just
  // sets the default when an immersive surface takes over.
  // ═════════════════════════════════════════════════════════════════════
  // IMMERSIVE_ARTIFACTS is defined at module scope so handleKebabTap
  // (declared earlier in the component) can also reference it.
  const capabilityImmersive = capabilityRegistry.get(activeCapability)?.wants.railCollapse ?? false;
  const artifactImmersive = !activeCapability && IMMERSIVE_ARTIFACTS.has(artifact);
  const immersiveMode = capabilityImmersive || artifactImmersive;
  // Right-side rail visibility · Philip 2026-09-03 "on the right side
  // frame side there still is icons from old side buttons remove them ·
  // as footer left side + button now activates the category page".
  // The `+` mode-toggle button in the composer footer now surfaces the
  // CATEGORY worlds (which was the rail's job), so the legacy right
  // rail is redundant on the friend-chat surface. Hidden specifically
  // for messages-friends · other artifacts still get the rail if their
  // own logic wants it.
  const effectiveRailVisible = immersiveMode
    ? false
    : artifact === "messages-friends"
      ? false
      : railVisible;
  const effectiveOrbPerched  = immersiveMode ? true  : orbPerched;

  return (
    <>
    <style>{`
      /* Half-round arc · centre → VISIBLE TOP-RIGHT PARK · Philip
         2026-08-29 BATCH 1. Used by kebab (3-dots) tap ONLY. Ends at
         translate(110%, -70%) matching the perched state so the handoff
         is seamless and the orb parks visibly in the top-right of the
         phone viewport. Chat auto-fly-off is a SEPARATE mechanism (see
         nex-orb-fly-offscreen keyframe below). */
      @keyframes nex-orb-arc-corner {
        0%   { transform: translate(0%, 0%) scale(1); }
        25%  { transform: translate(15%, -55%) scale(0.94); }
        55%  { transform: translate(55%, -85%) scale(0.85); }
        80%  { transform: translate(95%, -78%) scale(0.88); }
        100% { transform: translate(110%, -70%) scale(1); }
      }
      /* Chat auto-fly-off · centre → OFF-SCREEN RIGHT · Philip 2026-08-29.
         Dedicated animation for the chat build-up trigger. Ends off-screen
         at translate(220%, -20%). Uses transit style directly (does NOT
         set perched) so it never interferes with the kebab park position. */
      @keyframes nex-orb-fly-offscreen {
        0%   { transform: translate(0%, 0%) scale(1); }
        30%  { transform: translate(50%, -50%) scale(0.9); }
        70%  { transform: translate(150%, -30%) scale(0.85); }
        100% { transform: translate(220%, -20%) scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        /* Fallback · no arc · settle straight to corner instantly */
      }
      /* Hide native scrollbars on every descendant while /nexapp is mounted.
         Philip 2026-08-30 · phone-app UI must never expose the 4px themed
         scrollbar defined globally in src/app/globals.css line 132-146. This
         style tag only renders when NexAppShell is mounted, so the override
         is naturally scoped to the /nexapp route and unmounts elsewhere.
         Content still scrolls · scrollbars are visually hidden only. */
      *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; background: transparent !important; }
      *::-webkit-scrollbar-track,
      *::-webkit-scrollbar-thumb,
      *::-webkit-scrollbar-corner { background: transparent !important; display: none !important; }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }

      /* Orb first-flight to park · Philip 2026-09-01.
         All four variants START at translate(-117%, 17px) (hero-centre
         offset from the top-right park · -117% of orb width = -28% frame ·
         viewport-adaptive) and END at translate(0, 0) (parked top-right).
         Intermediate keyframes vary so each parking feels alive · every one
         dips DOWN before rising RIGHT-UP to the top-right park slot per
         spec: "orb move down and hoover up to right parking area". */
      @keyframes nex-orb-park-flight-0 {
        0%   { transform: translate(-117%, 17px); }
        30%  { transform: translate(-92%,  55px); }
        70%  { transform: translate(-28%,  6px);  }
        100% { transform: translate(0px,   0px);  }
      }
      @keyframes nex-orb-park-flight-1 {
        0%   { transform: translate(-117%, 17px); }
        35%  { transform: translate(-100%, 68px); }
        75%  { transform: translate(-18%, -8px);  }
        100% { transform: translate(0px,   0px);  }
      }
      @keyframes nex-orb-park-flight-2 {
        0%   { transform: translate(-117%, 17px); }
        25%  { transform: translate(-88%,  50px); }
        55%  { transform: translate(-50%,  32px); }
        85%  { transform: translate(-18%,  6px);  }
        100% { transform: translate(0px,   0px);  }
      }
      @keyframes nex-orb-park-flight-3 {
        0%   { transform: translate(-117%, 17px); }
        22%  { transform: translate(-130%, 48px); }
        52%  { transform: translate(-62%,  64px); }
        78%  { transform: translate(-20%,  12px); }
        100% { transform: translate(0px,   0px);  }
      }
    `}</style>
    {/* Kebab MORE-open polish · Philip 2026-08-30 · Batch 4-D.
        Automated iPhone 13 test showed the default active state (theme
        primary orange → same orange family) was not clearly distinguishable
        from inactive. This override targets the existing .nex-kebab-dot
        class from NexHudFrame WITHOUT modifying NexHudFrame · when MORE
        is open, dots switch to canonical NEX cyan (same hue used on face-
        scan brackets + password-fallback focus rings) with a stronger
        glow. Only paints when moreOpen is true so the DOM has no extra
        rule at rest. Reduced-motion respect from NexHudFrame preserved
        (only colour + shadow overridden, not animation). */}
    {moreOpen && (
      <style>{`
        .nex-kebab-dot {
          background: #4ac9ff !important;
          box-shadow: 0 0 8px rgba(74,201,255,0.95), 0 0 16px rgba(74,201,255,0.55) !important;
        }
      `}</style>
    )}
    <NexHudFrame
      mode={mode}
      themeId={themeId}
      rightRailContent={railContent}
      headerIcons={headerIcons}
      voiceState={nexState}
      voiceOrbLookAt={orbLookAt}
      voiceOrbPupilTransitionMs={orbPupilTransitionMs}
      voiceOrbAutoReturn={butterflyActive ? false : orbAutoReturn}
      voiceOrbFlashRed={orbFlashRed}
      voiceOrbHopped={orbHopped}
      onVoiceOrbTap={resolvedOrbTap}
      eyeBubbleMessage={eyeBubble?.text ?? null}
      eyeBubbleDwellMs={eyeBubble?.dwellMs}
      onEyeBubbleDismiss={() => setEyeBubble(null)}
      hideInteriorControls={mascotDrawerOpen || liveOpen}
      // Philip 2026-09-05 · Products workspace parks the voice orb so it
      // doesn't visually compete with the product interface. Orb returns
      // automatically when the artifact changes away from "products". The
      // Product Creator inherits the same rule — dense form UI shouldn't
      // compete with a floating assistant orb. Business Home (M0) also
      // parks the orb — the calm section grid + primary conversational card
      // is itself the assistant surface here. Business Onboarding (M1-A)
      // is a chat transcript · orb hidden to avoid visual competition with
      // the message bubbles.
      voiceOrbHidden={artifact === "products" || artifact === "product-creator" || artifact === "business-home" || artifact === "business-onboarding"}
      // Frame material mode · Philip 2026-08-27. When LIVE is open we're
      // watching video · fade the orange accents so the frame recedes and
      // the content stands out. When closed → normal (full orange).
      // STEP 3 · liveOpen still forces cinema (video immersion) · otherwise
      // frame reflects NEX activation state via activationFrameMode.
      // BATCH 7 · ceremonyFrameOverride overlays activationFrameMode while
      // the intro is running (off during dark/waking · normal at full power).
      frameMode={resolvedFrameMode}
      accentRegionOpacities={ceremonyAccentOpacities}
      visibleRailButtonCount={ceremonyVisibleRailButtons}
      interiorHeader={
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            fontSize: 14.4,
            fontWeight: 600,
            letterSpacing: 1.4,
            color: "rgba(200,200,205,0.90)",
            lineHeight: 1.1,
          }}>
            Mascot
          </div>
          <div style={{
            fontSize: 9,
            fontWeight: 500,
            color: "rgba(120,120,128,0.85)",
            letterSpacing: 0.3,
            lineHeight: 1.1,
          }}>
            swipe to preview · tap to select
          </div>
        </div>
      }
      onRightKebabTap={artifact === "messages-friends" ? undefined : handleKebabTap}
      rightKebabActive={moreOpen}
      // Right-side rail (Discover · Messages · Activity · Wallet · Me + the
      // secondary Studio/Tools/Creator/Network set) permanently hidden
      // 2026-09-06 per Founder direction. The workspaces those buttons
      // opened are now reached via the Control Center and the shell's
      // bottom composer — not the frame chrome. Rail housings collapse
      // through the theme.bezel.imageSrcNoRail swap inside NexHudFrame.
      hideRail={true}
      // Surgical frame removal · Philip 2026-09-07. Strips the phone
      // chassis + inner viewport constraint so /nexapp fills the whole
      // mobile viewport. Every existing page, workspace, header icon,
      // navigation, and functionality is preserved · this only removes
      // the outer chrome. `useChromaKeyedBezel` still runs (hook-count
      // safe) so Fast Refresh will not error on hot swaps.
      frameless={true}
      voiceOrbPerched={effectiveOrbPerched}
      voiceOrbHyperMode={orbHyperMode}
      // Per-artifact bezel override removed · Philip 2026-09-02 · the new
      // master frame (public/nex/hud-frame-master.png v3) is used for
      // ALL app surfaces · no per-artifact swap needed.
      voiceOrbTransitStyle={
        // Priority order:
        //   1. Immersive artifacts (NEX Live etc) HIDE the orb entirely
        //      (Philip 2026-09-01 · "no orb on the live screen").
        //   2. Chats/contacts (messages-friends) HIDES the orb too
        //      (Philip 2026-09-01 · "remove the orb from contact page").
        //   3. Flying to park wins over navigation transit.
        //   4. Nav transit style if present.
        //   5. Hero-centre offset (before first submit).
        immersiveMode || artifact === "messages-friends"
          ? { opacity: 0, pointerEvents: "none", transition: "opacity 200ms ease" }
          : orbHomeState === "flying"
            ? { animation: `nex-orb-park-flight-${orbFlightVariant} 1500ms cubic-bezier(0.4, 0, 0.2, 1) forwards`, willChange: "transform" }
            : (orbTransitStyle ?? (orbHomeState === "hero-center"
                ? { transform: "translate(-117%, 17px)" }
                : undefined))
      }
      // Hide the theme's interior hero image when chat is active · Philip
      // 2026-08-29. The brushed-metal chat bg (rendered in overlaySlot below)
      // becomes the sole background so the orb reads clearly on top of it.
      //
      // Philip 2026-08-30 · extended to hide the hero for every immersive
      // directory artifact (Food/Hotels/Trades/Marketplace/Mobility/Rentals/
      // Services + LIVE) so they inherit the exact same background as Chat.
      // The directory content receives the dark bezel as its foundation ·
      // no competing hero photography behind the premium restaurant cards.
      heroVisible={heroVisible && artifact !== "chat" && !IMMERSIVE_ARTIFACTS.has(artifact)}
      chatFullWidth={chatFullWidth || activeFriendId !== null}
      frameOverlaySlot={
        <NexButterflyCinematic
          onPupilDirection={handleButterflyPupil}
          onFireBeam={handleButterflyFireBeam}
          onCinematicActive={setButterflyActive}
        />
      }
      overlaySlot={<>
        {/* NEX chat · full-height brushed-metal bg · Philip 2026-08-29.
            Fixed to the bezel envelope so it spans top:0 → 100dvh (behind
            header + footer chrome). z:0 · below workspace zone (z:1) so
            chat text paints on top · well below the orb (z:10) so the orb
            reads clearly. pointer-events:none · never blocks interaction. */}
        {(artifact === "chat" || artifact === "messages-friends") && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              top: 0,
              right: "max(0px, calc((100dvw - min(100dvw, calc(100dvh * 850 / 1850))) / 2))",
              width: "min(100dvw, calc(100dvh * 850 / 1850))",
              height: "100dvh",
              overflow: "hidden",
              zIndex: 0,
              pointerEvents: "none",
              backgroundImage:
                "url('https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Sep%201,%202026,%2003_20_44%20PM.png')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        )}
        {/* Discover full-viewport interface takeover · Philip 2026-08-29.
            Fires whenever the Discover rail room is active · fades through
            the chat and settles as the hero. NEX orb keeps its higher
            z-order (frame chrome) and floats on top of the transition. */}
        <NexDiscoveryStage isOpen={activeRoom === "discover"} />
        {/* Round-button satellite constellation · Philip 2026-08-30 · fires
            with Discover. Positioned inside the same bezel envelope as
            NexDiscoveryStage (same width + right offset math) · z:13 sits
            above the decorative stage (z:12) but below drawer chrome. The
            wrapper is pointer-events:none · only the satellite <button>s
            themselves accept taps. Discovery satellite no-ops for now
            because the rail tap has already opened the drawer. */}
        {activeRoom === "discover" && (
          <div
            style={{
              position: "fixed",
              top: 0,
              right: "max(0px, calc((100dvw - min(100dvw, calc(100dvh * 850 / 1850))) / 2))",
              width: "min(100dvw, calc(100dvh * 850 / 1850))",
              height: "100dvh",
              zIndex: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {/* Philip 2026-08-30 · satellites are visually present but the
                inner wrapper stays pointer-events:none so drawer sub-section
                taps (LIVE · People · etc.) aren't blocked by overlapping
                satellite buttons. Discovery satellite is no-op currently ·
                other 4 are disabled per Truth Invariant. If interactive
                satellites become desirable, swap this back and adjust
                geometry so satellites clear the drawer column. */}
            <div style={{ pointerEvents: "none" }}>
              <NexExploreSatellites onDiscoveryTap={() => { /* drawer already open · no-op */ }} />
            </div>
          </div>
        )}
        <NexLiveStage
          isOpen={liveOpen}
          onClose={() => setLiveOpen(false)}
        />
        {/* Kebab slide-panel removed 2026-08-28 · replaced by rail-toggle
            behavior (kebab now collapses/expands the right rail instead of
            opening a menu · frame swaps to imageSrcNoRail variant when
            collapsed · chat bubbles widen). */}
        <NexMascotStage
          isOpen={mascotDrawerOpen}
          onClose={() => setMascotDrawerOpen(false)}
          theme={NEX_HUD_THEME_REGISTRY[themeId]}
          selectedSection={mascotSection}
          onSectionChange={setMascotSection}
          heroIndex={mascotHeroIndex}
          onHeroIndexChange={setMascotHeroIndex}
          onPost={(payload) => {
            // Emotional postcard → chat transcript · same payload shape as
            // the drawer's onPostMascot for downstream compatibility.
            setArtifact("chat");
            setMessages((prev) => [...prev, {
              id: newMessageId("u"),
              sender: "user",
              text: "",
              mascotUrl: payload.mascot.asset,
              mascotName: payload.mascot.name,
              mascotMeaning: payload.meaning,
              mascotPersonalMessage: payload.personalMessage,
              time: nowClock(),
            }]);
          }}
        />
      </>}
      composerSlot={
        // Composer suppression removed · Philip 2026-09-01. Previously we
        // suppressed the composer when capability.wants.composer === false
        // (Studio/Tools/Creator/Network all declare that). But that hid the
        // + / input / send buttons inside those surfaces — Philip needs the
        // composer visible everywhere so users can always keep chatting AND
        // always have a way back to chat via + / send / home. The wants
        // .composer flag is now advisory only (kept in capability registrations
        // in case a future surface actually needs a bespoke footer).
        (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              {/* Slice C2 · Business context pill · Philip 2026-08-30.
                  When pendingBusinessContext is set (user tapped Ask NEX on
                  a business), a small pill hovers above the composer so the
                  user sees NEX knows what they're talking about. Tapping
                  the × dismisses the context. Structured context is
                  automatically prepended to the message the backend sees. */}
              {pendingBusinessContext && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    role="status"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px 6px 12px",
                      borderRadius: 999,
                      background: "rgba(74,201,255,0.14)",
                      border: "1px solid rgba(74,201,255,0.55)",
                      color: "rgba(245,245,245,0.98)",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: 0.2,
                      pointerEvents: "auto",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      maxWidth: "92%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <span aria-hidden style={{ opacity: 0.8 }}>Talking about</span>
                    <strong style={{ fontWeight: 600 }}>{pendingBusinessContext.name}</strong>
                    <button
                      type="button"
                      aria-label="Clear business context"
                      onClick={() => setPendingBusinessContext(null)}
                      style={{
                        appearance: "none",
                        marginLeft: 2,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(255,255,255,0.15)",
                        color: "rgba(245,245,245,0.9)",
                        fontSize: 11,
                        lineHeight: "18px",
                        cursor: "pointer",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
              {/* SELECT → CONTEXT → FOCUS · Philip 2026-09-03 Slice 1.
                  Compute replyContext for the composer whenever a specific
                  message has been selected as the reply target. Friend name
                  is looked up from NEX_MOCK_FRIENDS (mock backend today).
                  replyMode semantic changed: was "friend chat open",
                  now "reply target set" — so the green rim + the CONTEXT
                  strip appear together as the semantic "selection state". */}
              {/* BOTTOM INPUT ASSEMBLY · Philip 2026-09-03 Slice A
                  geometry correction. Composer + Keypad are ONE
                  bottom-anchored assembly: composer directly ABOVE the
                  keypad, keypad docks to the bottom of the composer
                  zone. The assembly overflows composerSlot upward when
                  the keypad is visible (composerSlot is 18% of frame ·
                  keypad is ~200px · assembly is taller than the zone
                  but that's fine because absolute-positioned children
                  overflow naturally). Result: composer sits IMMEDIATELY
                  above the keypad, keypad at the very bottom · matches
                  Philip's diagram. NOT a floating keypad in the middle
                  of the chat. */}
              <div
                style={{
                  position: "absolute",
                  // Push assembly DOWN to the frame's baseline · Philip
                  // 2026-09-03. composerSlot itself sits at
                  // bottom: calc(3.2% + safe-area) from frame bottom,
                  // so the assembly needs to cancel that 3.2% (of
                  // FRAME height, not composerSlot's own height — which
                  // is why we can't use `bottom: -3.2%` directly, as
                  // percentages on an absolute child resolve against
                  // the parent's height, and composerSlot is 18% of
                  // frame). The calc below expresses -3.2% of the
                  // rendered frame height directly. Safe-area is
                  // preserved (already accounted for in composerSlot's
                  // own bottom offset) so the keypad respects iOS home
                  // indicator clearance.
                  bottom: "calc(min(100dvh, 100dvw * 1850 / 850) * -0.032)",
                  left: 0,
                  right: 0,
                  pointerEvents: "auto",
                }}
              >
              {/* SHARED CONSOLE WRAPPER · Philip 2026-09-03 "same black
                  kepad back ground behind the imput field above the
                  kepad and the left size round and right side round of
                  the kepad back ground top rim with text imput field
                  inside". When focused: extends edge-to-edge via
                  negative margins, applies the dark keypad background
                  + rounded top corners so composer + keypad read as
                  ONE console with the input field sitting inside the
                  rounded top rim. When not focused: pure passthrough
                  (composer renders at composerSlot's inner width). */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  // Connect composer + keypad as ONE unit · gap:16
                  // exactly compensates the composer form's built-in
                  // marginBottom:-16, net visual gap = 0.
                  gap: 16,
                  ...(composerFocused ? {
                    marginLeft:  "calc(min(100dvw, 100dvh * 850 / 1850) * -0.1082)",
                    marginRight: "calc(min(100dvw, 100dvh * 850 / 1850) * -0.1059)",
                    // Fully OPAQUE background · Philip 2026-09-03 "3 dots
                    // should not see the 3 dots glowing through the keypad
                    // when keypad is open the dots are off". The previous
                    // rgba(10,10,10,0.88) + backdrop-filter blur was letting
                    // bright / glowing elements behind the wrapper (frame
                    // decorative footer artwork, pulsing chat controls) bleed
                    // through as a soft glow. Fully-opaque #0a0a0a blocks
                    // ALL bleed-through — nothing behind the wrapper is
                    // visible while the keypad is open.
                    background: "#0a0a0a",
                    borderTopLeftRadius:  20,
                    borderTopRightRadius: 20,
                    boxShadow: "0 -8px 22px rgba(0,0,0,0.45)",
                    // backdrop-filter REMOVED · no longer needed with fully
                    // opaque bg (nothing behind to blur).
                    // overflow: hidden REMOVED · Philip 2026-09-03. The
                    // 8-tile insertion panel opens via bottom: calc(100% + 8px)
                    // inside the composer (extending ABOVE the shared wrapper's
                    // top edge). overflow: hidden was clipping it invisibly.
                    // The rounded top corners still render because
                    // border-radius applies to the element's own background,
                    // independent of overflow clipping.
                  } : {}),
                }}
              >
                {/* Composer inner wrapper · Philip 2026-09-03 "we can
                    full width with text bubble". Padding removed so the
                    composer/text bubble extends edge-to-edge inside the
                    shared wrapper (matching the keypad's full-width
                    extent). Composer's internal 8px form padding
                    provides breathing room from the frame edges. */}
                <div
                  style={{
                    paddingLeft: 0,
                    paddingRight: 0,
                  }}
                >
                <NexComposer
                  ref={composerRef}
                  value={inputText}
                  onChange={handleComposerChange}
                  onSubmit={handleComposerSubmit}
                  nexState={nexState}
                  onInputFocus={() => setComposerFocused(true)}
                  onInputBlur={() => setComposerFocused(false)}
                  insertMode={keypadInsertMode}
                  onInsertModeToggle={() => setKeypadInsertMode((v) => !v)}
                  nexAssistMode={nexAssistMode}
                  onNexSuggest={() => setNexAssistMode((v) => !v)}
                  replyMode={friendReplyTarget !== null}
                replyContext={(() => {
                  if (!friendReplyTarget || !activeFriendId) return null;
                  const friend = NEX_MOCK_FRIENDS.find((f) => f.id === activeFriendId);
                  if (!friend) return null;
                  const friendName = friendReplyTarget.sender === "user"
                    ? "yourself"
                    : friend.name;
                  return {
                    friendName,
                    preview: friendReplyTarget.text ?? "",
                    onDismiss: () => setFriendReplyTarget(null),
                  };
                })()}
                // + button flips CHAT ↔ CATEGORY ↔ CATEGORY_DETAIL.
                // Tap in chat  → enter category worlds.
                // Tap in category → return to chat.
                // Tap in detail   → step back one level (detail → category).
                // Conversation (messages) preserved throughout · this is a
                // pure UI mode change, not a route or artifact switch.
                modeActive={chatMode !== "chat"}
                onAddTap={() => {
                  glance("center");
                  handleVoiceButtonUsed();
                  if (chatMode === "chat") setChatMode("category");
                  else if (chatMode === "category-detail") { setChatMode("category"); }
                  else { setChatMode("chat"); setActiveCategoryId(null); }
                }}
                onAddLongPress={() => {
                  // 2-second hold on + → open the recent-pages panel.
                  // Cancels any in-flight tap so mode doesn't also flip.
                  glance("down");
                  setRecentPagesOpen(true);
                }}
              />
                </div>
              {/* Keypad · sibling of the composer inner wrapper inside
                  the shared console. Full frame width is now provided by
                  the SHARED CONSOLE WRAPPER above (dark bg + rounded top
                  when focused), so the keypad no longer needs its own
                  negative-margin wrapper. */}
              {composerFocused && (
                <NexKeypad
                  onKeyTap={(c) => setInputText((prev) => prev + c)}
                  onBackspace={() => setInputText((prev) => prev.slice(0, -1))}
                  onEnter={handleComposerSubmit}
                  insertMode={keypadInsertMode}
                  onInsertTileTap={(tileKey) => {
                    // Always exit insert mode when a tile is tapped.
                    setKeypadInsertMode(false);
                    // Chats tile · Philip 2026-09-03 "THE CHATS BUTTON
                    // OPENS THE CONTACTS PANEL THAT WAS CONNECTED TO
                    // THE 3 DOTS IN HEADER CENTER". Fire a custom event
                    // that NexFriendChatView listens for and opens its
                    // convoMenuAnchor drawer (same drawer the removed
                    // 3-dots button used to open).
                    if (tileKey === "chats" && typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("nex:open-chats-drawer"));
                    }
                    // Products tile · Philip 2026-09-05 · opens the Products
                    // workspace. Tile key remains "shop" for backward compat;
                    // NexKeypad displays it as "Products" (label rename only).
                    if (tileKey === "shop") {
                      setArtifact("products");
                    }
                    // Other tiles (Call/Video/Camera/File/Tools/
                    // Quick Actions) are still visual stubs · real
                    // feature wiring per tile lands later.
                  }}
                />
              )}
              </div>
              </div>
            </div>
          )
      }
      onBezelButton={(id) => {
        if (id === "nex-wordmark") setArtifact("chat");
      }}
    >
      {/* Rendering priority · Philip 2026-08-30 · Slice 1:
          Capability Surface → Room artifact → Default artifact.
          When a capability is active, its interior takes precedence and
          the underlying artifact state is preserved (not cleared) so the
          user returns cleanly when they exit the capability. */}
      {activeCapability && capabilityFrame && (
        <CapabilitySurface
          activeCapability={activeCapability}
          frame={capabilityFrame}
          navigate={capabilityNavigate}
          exit={exitCapability}
        />
      )}
      {!activeCapability && (<>
      {/* Chat wrapped in a visibility gate · Philip 2026-09-01. When the
          user opens the category (+) surface we hide the chat behind it so
          no chat text bleeds through under the tiles. Kept mounted (not
          conditionally rendered) so message state / scroll position are
          preserved on back. Uses opacity + pointerEvents rather than a
          scrim — Philip explicitly does NOT want a shade screen. */}
      {artifact === "chat" && (
        <div style={{
          width: "100%",
          height: "100%",
          opacity: chatMode === "chat" ? 1 : 0,
          pointerEvents: chatMode === "chat" ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}>
          <NexWorkspaceChat messages={messages} nexState={nexState} onOrbTap={() => voice.tap()} error={chatError} wideBubbles={!railVisible} userName="Philip" variant={searchParams?.get("chat") === "bubbles" ? "bubbles" : "typographic"} onLaunchStart={handleChatLaunchStart} fullWidth={chatFullWidth} />
        </div>
      )}
      {artifact === "food"      && <NexWorkspaceExplore rollup24h={discovery?.rollup24h ?? null} onVerticalTap={() => setArtifact("chat")} />}
      {artifact === "services"  && <NexWorkspaceExplore rollup24h={discovery?.rollup24h ?? null} onVerticalTap={() => setArtifact("chat")} />}
      {artifact === "profile"   && <NexWorkspaceIdle onAskTap={() => setArtifact("chat")} greetingName="profile (coming soon)" />}
      {artifact === "wallet-balance" && <NexWorkspaceWallet />}
      {artifact === "activity-incoming-requests" && <NexWorkspaceIncomingRequests />}
      {artifact === "me-my-roles" && <NexWorkspaceMyRoles />}
      {artifact === "activity-my-requests" && <NexWorkspaceMyRequests />}
      {artifact === "me-profile" && <NexWorkspaceProfile />}
      {artifact === "discover-feed" && <NexWorkspaceFeed />}
      {/* Products workspace · Philip 2026-09-05 · reached via keypad INSERT "Products" tile.
          P0.1 (Philip 2026-09-05): Products' Add Product tile now navigates to the
          Product Creator artifact via onAddProduct callback wired through the shell. */}
      {artifact === "products" && (
        <NexWorkspaceProducts
          onBack={() => setArtifact("chat")}
          onAddProduct={() => {
            console.log("[NexAppShell] products → Add Product · swap to product-creator");
            setArtifact("product-creator");
          }}
        />
      )}
      {/* Product Creator · Philip 2026-09-05 · Add Product/Service surface · UI + localStorage draft only */}
      {artifact === "product-creator" && (
        <NexWorkspaceProductCreator
          onBack={() => {
            console.log("[NexAppShell] product-creator back · returning to products list");
            setArtifact("products");
          }}
        />
      )}
      {/* Business Home · Philip 2026-09-05 · M0 owner cockpit · section cards swap to
          existing workspaces (Products / Contacts / universal Chat) per doctrine. */}
      {artifact === "business-home" && (
        <NexWorkspaceBusinessHome
          onBack={() => {
            console.log("[NexAppShell] business-home back · returning to chat");
            setArtifact("chat");
          }}
          onSwapWorkspace={(target) => {
            console.log(`[NexAppShell] business-home → swap workspace: ${target}`);
            setArtifact(target);
          }}
          onOpenOnboarding={() => {
            console.log("[NexAppShell] business-home → open onboarding (M1-A)");
            setArtifact("business-onboarding");
          }}
        />
      )}
      {/* Business Onboarding · Philip 2026-09-05 · M1-A conversational onboarding.
          Reuses the shell-mounted composer for owner input · composer submits are
          routed to acceptBusinessOnboardingReply() at handleComposerSubmit (below). */}
      {artifact === "business-onboarding" && (
        <NexWorkspaceBusinessOnboarding
          onBack={() => {
            console.log("[NexAppShell] business-onboarding back · returning to business-home");
            setArtifact("business-home");
          }}
        />
      )}
      {/* Phase 1 · Reconciliation · Philip 2026-08-30 · Messages surfaces */}
      {artifact === "messages-friends"  && (
        <NexWorkspaceFriends
          initialFriendId={pendingFriendId}
          activeFriendId={activeFriendId}
          onActiveFriendChange={(id) => {
            setActiveFriendId(id);
            // Leaving the friend chat clears any in-flight reply target
            // so it doesn't linger into the next conversation.
            if (id === null) setFriendReplyTarget(null);
          }}
          threads={friendThreads}
          replyTarget={friendReplyTarget}
          onReplyTargetChange={setFriendReplyTarget}
          onMarkThreadRead={markFriendThreadRead}
          onToggleMessageRead={toggleFriendMessageRead}
          onDeleteMessage={deleteFriendMessage}
          onAddReaction={addFriendMessageReaction}
          onToggleSaved={toggleFriendMessageSaved}
          onTogglePinned={toggleFriendMessagePinned}
          onEditMessage={editFriendMessage}
          onToggleFriendMute={toggleFriendMute}
          mutedFriendIds={mutedFriendIds}
          onClearChat={clearFriendChat}
          isUserTyping={inputText.trim().length > 0}
          userTypingText={inputText}
        />
      )}
      {/* Contacts artifact · Philip 2026-09-05 · renders v6 chassis
          ContactsPanel (Personal + BUSINESS CONTACTS section) · tapping
          a business contact opens the existing universal NEX Chat via
          setArtifact("messages-friends") per one-universal-chat doctrine.
          myNexId + myName are placeholders for M0 · replace with real
          identity signal from useNexIdentity when the shell wires it. */}
      {artifact === "messages-contacts" && (
        <ContactsPanel
          myNexId="NEX-DEMO-0001"
          myName="Philip"
          onClose={() => setArtifact("chat")}
          language="en"
          onOpenChat={(c) => {
            // Business Contact tap → open the existing universal chat
            // surface. Personal-contact tap-to-chat is deliberately NOT
            // wired here (Philip 2026-09-05 · "preserve existing
            // behavior"). Business identity/context enrichment inside
            // the chat is a follow-up slice.
            console.log(`[ContactsPanel] onOpenChat · ${c.kind} · ${c.id} · ${c.name}`);
            setArtifact("messages-friends");
          }}
        />
      )}
      {/* Phase 2 Step 1 · Philip 2026-08-30 · Discover People (floating profiles) */}
      {artifact === "discover-people"   && <DiscoverShell inShell />}
      {/* Philip 2026-08-30 · Discover LIVE (TikTok-style prototype in shell) */}
      {artifact === "discover-live"     && <NexLiveClient inShell />}
      {/* Slice B · Philip 2026-08-30 · Discover Businesses (Food Directory · immersive)
          Slice C2 · Ask NEX now attaches business context to the composer
          (via pendingBusinessContext state) · exits immersive to chat ·
          user types their own question · handleComposerSubmit prepends the
          structured context to the backend text so NEX can answer. */}
      {artifact === "discover-businesses" && (
        <NexWorkspaceBusinesses
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      {/* Directory Surface step 3 · Philip 2026-08-30 · Hotels vertical
          registered against the shared NexDirectorySurface primitive.
          Zero UI code here · descriptor + one line renders it. Proves the
          abstraction before B-wide sweep. */}
      {artifact === "discover-hotels" && (
        <NexDirectorySurface
          vertical={hotelsVertical}
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      {/* B-wide · Philip 2026-08-30 · Trades vertical · deliberate
          architecture stress test. Provider/company entities registered
          via descriptor only. `statusLabels` descriptor evolution ships
          with this vertical ("Available now" / "Booked today" / "Fully
          booked") — no per-vertical UI file. */}
      {artifact === "discover-trades" && (
        <NexDirectorySurface
          vertical={tradesVertical}
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      {/* B-wide sweep · Philip 2026-08-30 · Marketplace / Mobility / Rentals /
          Services · descriptor-only registrations. Zero UI code per vertical.
          Directory Surface Architecture complete: seven verticals, one primitive. */}
      {artifact === "discover-marketplace" && (
        <NexDirectorySurface
          vertical={marketplaceVertical}
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      {artifact === "discover-mobility" && (
        <NexDirectorySurface
          vertical={mobilityVertical}
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      {artifact === "discover-rentals" && (
        <NexDirectorySurface
          vertical={rentalsVertical}
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      {artifact === "discover-services" && (
        <NexDirectorySurface
          vertical={servicesVertical}
          onAskNex={(business) => {
            setPendingBusinessContext(business);
            setArtifact("chat");
          }}
        />
      )}
      </>)}

      {/* Five-button IA · Room drawer · Philip 2026-08-29 · Phase 1.
          Slides over the workspace when a rail button is tapped. All
          sub-sections render "Coming soon" placeholders during Phase 1.
          Renders INSIDE NexHudFrame so it sits above workspace + is
          bezel-aware (NexSideDrawer uses fixed positioning against the
          bezel geometry, so tree location is mostly cosmetic — placing
          here keeps the drawer wrapped by the frame context). */}
      <NexRoomDrawer
        activeRoom={activeRoom}
        onClose={() => setActiveRoom(null)}
        activeRoles={activeRoles}
        onNavigate={(ws) => {
          const target = coerceWorkspace(ws);
          if (target) navigateWithOrb(target);
        }}
      />

      {/* CHAT ↔ CATEGORY ↔ CATEGORY_DETAIL surface · Philip 2026-09-01.
          Rendered as a sibling of the workspace content inside NexHudFrame
          so it sits above chat (z:15) but below the composer bezel (z:30)
          and rail buttons (z:50). Conversation (messages) is untouched —
          this is a pure UI mode change. Section select routes through the
          same navigateWithOrb path used by the room drawer, so it inherits
          the perch/hop orb choreography for free. */}
      <NexCategoryMode
        mode={chatMode}
        activeCategoryId={activeCategoryId}
        visibleRoles={Array.from(activeRoles) as UserRole[]}
        onSelectCategory={(id) => {
          setActiveCategoryId(id);
          setChatMode("category-detail");
        }}
        onSelectCapability={(id) => {
          // MORE capability tiles (Studio / Tools / Creator / Network) fire
          // enterCapability directly · matches the right-rail button
          // handlers on lines 1271-1277 · same navigation contract.
          setChatMode("chat");
          setActiveCategoryId(null);
          enterCapability(id as CapabilityId);
        }}
        onSelectSection={(section) => {
          if (section.workspace === "coming-soon") return;
          const target = coerceWorkspace(section.workspace);
          if (target) {
            setChatMode("chat");
            setActiveCategoryId(null);
            navigateWithOrb(target);
          }
        }}
        onBack={() => {
          if (chatMode === "category-detail") setChatMode("category");
          else { setChatMode("chat"); setActiveCategoryId(null); }
        }}
      />

      {/* Recent-pages panel · Philip 2026-09-01. Opens when + is held for
          2s · closes on tile select · closes on typing · auto-closes after
          6s idle · ESC closes. Landscape at bottom, 2.5% above transparent
          bottom edge, restaurant-card container style. */}
      <NexRecentPagesPanel
        open={recentPagesOpen}
        pages={recentPages}
        onSelect={(p) => {
          setRecentPagesOpen(false);
          if (p.kind === "capability") {
            enterCapability(p.id.replace(/^cap:/, "") as CapabilityId);
          } else {
            const target = coerceWorkspace(p.id.replace(/^art:/, ""));
            if (target) navigateWithOrb(target);
          }
        }}
        onClose={() => setRecentPagesOpen(false)}
      />

      {/* Kebab quick-panel · Philip 2026-09-01. Live · Chat → landscape
          friend cards → open that friend's chat directly. Same container
          style as the + recent-pages panel and business cards. */}
      <NexKebabQuickPanel
        open={kebabPanelOpen}
        onSelect={(sel) => {
          setKebabPanelOpen(false);
          if (sel.kind === "live") {
            setPendingFriendId(null);
            setActiveFriendId(null);
            navigateWithOrb("discover-live");
          } else if (sel.kind === "chat") {
            setPendingFriendId(null);
            setActiveFriendId(null);
            navigateWithOrb("messages-friends");
          } else if (sel.kind === "social") {
            // Social tile · dating floating-profiles surface (DiscoverShell)
            // via the existing discover-people artifact. Now in immersive
            // set + rendered with inShell → fills the transparent interior
            // and hides the orb (matches NEX Live treatment).
            setPendingFriendId(null);
            setActiveFriendId(null);
            navigateWithOrb("discover-people");
          } else {
            // Friend tile tapped (inline friends view) · open that thread.
            setPendingFriendId(sel.friendId);
            setActiveFriendId(sel.friendId);
            navigateWithOrb("messages-friends");
          }
        }}
        onClose={() => setKebabPanelOpen(false)}
      />

      {/* Phase D · Control Center portal — mounts inside the .nex-console-
          viewport so `absolute inset-0` scoping keeps the panel visually
          contained to the bezel phone frame. Never leaks to the desktop
          browser edges. */}
      {controlCenterPortalTarget && createPortal(
        <ControlCenterPanel
          isOpen={controlCenterOpen}
          onClose={() => setControlCenterOpen(false)}
          panelId="nex-control-center-nexapp"
          variant="glass"
        />,
        controlCenterPortalTarget,
      )}
    </NexHudFrame>
    </>
  );
}
