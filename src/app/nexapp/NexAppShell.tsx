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
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, MessageSquare, Activity as ActivityIcon, Wallet as WalletIcon, CircleUser, Package, Wrench, Palette, Users } from "lucide-react";
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
// Phase 2 workspaces · migrated in from standalone /nex-provider-* pages.
import { NexWorkspaceWallet } from "@/components/nexapp/NexWorkspaceWallet";
import { NexWorkspaceIncomingRequests } from "@/components/nexapp/NexWorkspaceIncomingRequests";
import { NexWorkspaceMyRoles } from "@/components/nexapp/NexWorkspaceMyRoles";
// Phase 1 · Reconciliation · Philip 2026-08-30 · Messages sub-section artifacts
// (NexWorkspaceFriends already imported at line 45 · reused for messages-friends)
import { ContactsShell } from "@/components/nex-app/contacts/ContactsShell";
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
import { NexWorkspaceFeed } from "@/components/nexapp/NexWorkspaceFeed";
import { NexLiveStage } from "@/components/nexapp/hud/NexLiveStage";
import { NexDiscoveryStage } from "@/components/nexapp/hud/NexDiscoveryStage";
import { NexWorkspaceChat, type ChatMessage } from "@/components/nexapp/NexWorkspaceChat";
import { useAmbientInjector } from "@/lib/nexapp/ambientInjector";
import { NexButterflyCinematic } from "@/components/nexapp/NexButterflyCinematic";
import { NexComposer } from "@/components/nexapp/NexComposer";
import { NexSideDrawer } from "@/components/nexapp/NexSideDrawer";
// Five-button IA · Philip 2026-08-29 · Phase 1.
// Rail buttons open room drawers. Sub-sections in drawers are "Coming soon"
// placeholders in Phase 1 · Phase 2+ wires real workspaces.
import { NexRoomDrawer } from "@/components/nexapp/rooms/NexRoomDrawer";
import type { RoomId, UserRole } from "@/lib/nexapp-shell/rooms";
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
  | "discover-services";           // NexDirectorySurface + servicesVertical · immersive
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
]);
function coerceWorkspace(raw: string | null | undefined): WorkspaceArtifact | null {
  if (!raw) return null;
  return VALID_WORKSPACES.has(raw as WorkspaceArtifact) ? (raw as WorkspaceArtifact) : null;
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
const IconDiscover  = () => <Compass       size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconMessages  = () => <MessageSquare size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconActivity  = () => <ActivityIcon  size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconWallet    = () => <WalletIcon    size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconMe        = () => <CircleUser    size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
// MORE panel secondary rail icons · Philip 2026-08-30. Rendered inside the
// same 5-slot rail area as primary; kebab toggles between the two arrays.
const IconStudio    = () => <Package       size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconTools     = () => <Wrench        size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconCreator   = () => <Palette       size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
const IconNetwork   = () => <Users         size="100%" strokeWidth={RAIL_ICON_STROKE} style={RAIL_ICON_STYLE} />;
// Header icons
const IconSearch    = () => <Icon size={22}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
const IconBell      = () => <Icon size={22}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Icon>;
const IconDots      = () => <Icon size={22}><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /></Icon>;
// IconPlus · Philip 2026-08-30 · header slot 3 becomes CREATE (global
// creation quick-actions) · IconDots released for reuse as the MORE panel
// opener at the bottom of the primary rail in Batch 4.
const IconPlus      = () => <Icon size={22}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;

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
    if (activeCapability) {
      // Kebab tap inside a capability = leave BOTH the capability AND MORE.
      // There's no capability left to visit within MORE from this exit
      // gesture, so we collapse the secondary rail too.
      exitCapability();
      setMoreOpen(false);
      return;
    }
    // Philip 2026-08-30 · Slice B fix. When an IMMERSIVE artifact is active
    // (rail collapsed · orb perched), the kebab is the user's only visible
    // affordance for navigation. Interpret the tap as "get me out of here"
    // — return to default chat which restores the rail + orb. Without this
    // the user is stranded inside the immersive artifact with no way to
    // reach another rail room.
    if (artifactImmersive) {
      setArtifact("chat");
      setMoreOpen(false);
      return;
    }
    setMoreOpen((prev) => !prev);
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
  const composerRef = useRef<HTMLInputElement | null>(null);

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
  }

  // Composer focus / typing → orb looks DOWN toward the input.
  function handleComposerFocus() { glance("down"); }
  function handleComposerChange(v: string) {
    setInputText(v);
    if (v.length === 1) glance("down"); // First keystroke → glance
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
  const railAccent = (id: RoomId): string =>
    activeRoom === null      ? RAIL_WHITE           // idle · pure white
    : activeRoom === id      ? EXPLORE_ORB          // active button · orb orange
    :                          RAIL_DIM;            // other buttons · dim grey
  const rail: RailButton[] = [
    // Label "Discover" per Philip 2026-08-30 · matches doctrine + revised
    // navigation architecture. Was briefly "Explore" 2026-08-29 · reverted.
    // id stays "discover" internally so room registry + doctrine references
    // remain intact.
    { id: "discover", label: "Discover", icon: <IconDiscover />, active: activeRoom === "discover", guidanceTarget: "rail-discover", accentOverride: railAccent("discover"), onClick: () => openRoom("discover") },
    { id: "messages", label: "Messages", icon: <IconMessages />, active: activeRoom === "messages", guidanceTarget: "rail-messages", accentOverride: railAccent("messages"), onClick: () => openRoom("messages") },
    { id: "activity", label: "Activity", icon: <IconActivity />, active: activeRoom === "activity", guidanceTarget: "rail-activity", accentOverride: railAccent("activity"), onClick: () => openRoom("activity") },
    { id: "wallet",   label: "Wallet",   icon: <IconWallet />,   active: activeRoom === "wallet",   guidanceTarget: "rail-wallet",   accentOverride: railAccent("wallet"),   onClick: () => openRoom("wallet") },
    { id: "me",       label: "Me",       icon: <IconMe />,       active: activeRoom === "me",       guidanceTarget: "rail-me",       accentOverride: railAccent("me"),       onClick: () => openRoom("me") },
  ];

  // MORE secondary rail · Philip 2026-08-30. When the kebab is tapped, the
  // primary rail contents swap for this 4-button set (Studio · Tools · Creator
  // · Network). Rail geometry, slot count, kebab position and every other
  // frame chrome affordance stay identical · only the rendered contents change.
  // Navigation closes the panel so the user lands cleanly on the destination.
  function goMore(path: string) {
    setMoreOpen(false);
    router.push(path);
  }
  const toolsActive   = activeCapability === "tools";
  const studioActive  = activeCapability === "studio";
  const networkActive = activeCapability === "network";
  const creatorActive = activeCapability === "creator";
  const moreRail: RailButton[] = [
    // Slice 4 · Studio migrated to Capability Surface (hybrid · no auto-eject
    // to /studio sign-in prompt). Philip 2026-08-30.
    { id: "studio",  label: "Studio",  icon: <IconStudio />,  active: studioActive,  accentOverride: studioActive  ? "#4ac9ff" : undefined, onClick: () => enterCapability("studio") },
    // Slice 1 · Tools shell-native · MORE rail stays open · cyan active accent.
    { id: "tools",   label: "Tools",   icon: <IconTools />,   active: toolsActive,   accentOverride: toolsActive   ? "#4ac9ff" : undefined, onClick: () => enterCapability("tools") },
    // Slice 2 · Creator migrated to Capability Surface (7 round-button tools).
    { id: "creator", label: "Creator", icon: <IconCreator />, active: creatorActive, accentOverride: creatorActive ? "#4ac9ff" : undefined, onClick: () => enterCapability("creator") },
    // Slice 3 · Network migrated to Capability Surface (round-button tiles).
    { id: "network", label: "Network", icon: <IconNetwork />, active: networkActive, accentOverride: networkActive ? "#4ac9ff" : undefined, onClick: () => enterCapability("network") },
  ];
  const railContent = moreOpen ? moreRail : rail;

  // Header icons · 3 slots · Philip 2026-08-30 (revised nav architecture).
  // Final model: Search · Notifications · Create (physical order preserved
  // from prior "Search / Bell / Menu" layout). Handlers still stubbed to
  // glance("up") · Batch 5 wires Universal Search overlay + Notifications
  // inbox + Create quick-actions menu.
  const headerIcons: HeaderIconButton[] = [
    { id: "search", label: "Search",        icon: <IconSearch />, guidanceTarget: "header-search", onClick: () => glance("up") },
    { id: "alerts", label: "Notifications", icon: <IconBell />,   guidanceTarget: "header-alerts", onClick: () => glance("up") },
    { id: "create", label: "Create",        icon: <IconPlus />,   guidanceTarget: "header-create", onClick: () => glance("up") },
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
  const effectiveRailVisible = immersiveMode ? false : railVisible;
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
      onRightKebabTap={handleKebabTap}
      rightKebabActive={moreOpen}
      hideRail={!effectiveRailVisible}
      voiceOrbPerched={effectiveOrbPerched}
      voiceOrbHyperMode={orbHyperMode}
      voiceOrbTransitStyle={orbTransitStyle}
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
      chatFullWidth={chatFullWidth}
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
        {artifact === "chat" && (
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
                "url('https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Aug%2029,%202026,%2011_18_17%20AM.png')",
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
        // Composer suppression · Philip 2026-08-30 · Slice 1. If the active
        // capability declares wants.composer === false, we render null into
        // the composer slot. The NexHudFrame composer wrapper still occupies
        // its reserved bottom position (small documented cost · avoids
        // touching NexHudFrame structure per guardrails). A future proper
        // hideComposer prop can reclaim that space.
        (activeCapability && capabilityRegistry.get(activeCapability)?.wants.composer === false)
          ? null
          : (
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
              <NexComposer
                ref={composerRef}
                value={inputText}
                onChange={handleComposerChange}
                onSubmit={handleComposerSubmit}
                nexState={nexState}
                onMicTap={() => { glance("center"); handleVoiceButtonUsed(); voice.tap(); }}
              />
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
      {artifact === "chat"      && <NexWorkspaceChat messages={messages} nexState={nexState} onOrbTap={() => voice.tap()} error={chatError} wideBubbles={!railVisible} userName="Philip" variant={searchParams?.get("chat") === "bubbles" ? "bubbles" : "typographic"} onLaunchStart={handleChatLaunchStart} fullWidth={chatFullWidth} />}
      {artifact === "food"      && <NexWorkspaceExplore rollup24h={discovery?.rollup24h ?? null} onVerticalTap={() => setArtifact("chat")} />}
      {artifact === "services"  && <NexWorkspaceExplore rollup24h={discovery?.rollup24h ?? null} onVerticalTap={() => setArtifact("chat")} />}
      {artifact === "profile"   && <NexWorkspaceIdle onAskTap={() => setArtifact("chat")} greetingName="profile (coming soon)" />}
      {artifact === "wallet-balance" && <NexWorkspaceWallet />}
      {artifact === "activity-incoming-requests" && <NexWorkspaceIncomingRequests />}
      {artifact === "me-my-roles" && <NexWorkspaceMyRoles />}
      {artifact === "activity-my-requests" && <NexWorkspaceMyRequests />}
      {artifact === "me-profile" && <NexWorkspaceProfile />}
      {artifact === "discover-feed" && <NexWorkspaceFeed />}
      {/* Phase 1 · Reconciliation · Philip 2026-08-30 · Messages surfaces */}
      {artifact === "messages-friends"  && <NexWorkspaceFriends />}
      {artifact === "messages-contacts" && <ContactsShell />}
      {/* Phase 2 Step 1 · Philip 2026-08-30 · Discover People (floating profiles) */}
      {artifact === "discover-people"   && <DiscoverShell />}
      {/* Philip 2026-08-30 · Discover LIVE (TikTok-style prototype in shell) */}
      {artifact === "discover-live"     && <NexLiveClient />}
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
    </NexHudFrame>
    </>
  );
}
