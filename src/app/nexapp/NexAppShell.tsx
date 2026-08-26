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

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { NexContextCard, type ContextCardTone } from "@/components/nexapp/NexContextCard";
import { NexWorkspaceIdle } from "@/components/nexapp/NexWorkspaceIdle";
import { NexWorkspaceExplore } from "@/components/nexapp/NexWorkspaceExplore";
import { NexWorkspaceFriends } from "@/components/nexapp/NexWorkspaceFriends";
import { NexWorkspaceChat, type ChatMessage } from "@/components/nexapp/NexWorkspaceChat";
import { NexComposer } from "@/components/nexapp/NexComposer";
import { NexSideDrawer } from "@/components/nexapp/NexSideDrawer";
import { NexMascotDrawerContent } from "@/components/nexapp/hud/NexMascotDrawerContent";
import { useNexVoice } from "@/lib/nex-voice";

// Which artifact currently fills the workspace zone. Rail switches these.
// Note: "favorites" was retired 2026-08-27 · replaced by the Mascot side tool
// which opens a drawer (not a workspace change) · see mascotDrawerOpen state.
type WorkspaceArtifact =
  | "chat"       // default · conversation transcript
  | "profile"    // user profile view
  | "history"    // past sessions / discovery history
  | "services"   // NEX services / verticals list
  | "food";      // food discovery vertical

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
  transport:     "drivers",
  unknown:       "businesses",
};

function humanAgo(secs: number): string {
  if (secs < 90) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)} min ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

function cardFromDiscovery(latest: LatestDiscovery | null, rollup: DiscoveryPayload["rollup24h"]) {
  if (!latest) {
    return {
      tone: "found" as ContextCardTone,
      icon: <span style={{ fontSize: 14 }}>◉</span>,
      primary: "NEX workforce is live across Indonesia",
      secondary: rollup && rollup.recordsNew > 0
        ? `${rollup.recordsNew} new records · 24h`
        : "Tap a rail button to explore",
    };
  }
  const vertLabel = VERTICAL_LABEL[latest.vertical] ?? "businesses";
  const cityBit = latest.city ? ` near ${latest.city}` : "";
  const ago = humanAgo(latest.secondsAgo);
  switch (latest.cycleOutcome) {
    case "PRODUCTIVE":
    case "PARTIAL":
      return { tone: "found" as ContextCardTone, icon: <span style={{ fontSize: 14 }}>🔎</span>,
        primary: `NEX found ${latest.recordsNew} new ${vertLabel}${cityBit}`, secondary: `${ago}` };
    case "ALL_DEDUPED":
      return { tone: "in-progress" as ContextCardTone, icon: <span style={{ fontSize: 14 }}>↻</span>,
        primary: `NEX is searching ${vertLabel}${cityBit}`, secondary: `${latest.recordsProcessed} candidates · ${ago}` };
    case "PROVIDER_EMPTY":
      return { tone: "in-progress" as ContextCardTone, icon: <span style={{ fontSize: 14 }}>…</span>,
        primary: `NEX is exploring new ${vertLabel}${cityBit}`, secondary: `${ago}` };
    case "PROVIDER_ERROR":
      return { tone: "attention" as ContextCardTone, icon: <span style={{ fontSize: 14 }}>!</span>,
        primary: `NEX had trouble reaching a data source`, secondary: `Retrying · ${ago}` };
    default:
      return { tone: "in-progress" as ContextCardTone, icon: <span style={{ fontSize: 14 }}>◐</span>,
        primary: `NEX is working on ${vertLabel}${cityBit}`, secondary: `Latest cycle ${ago}` };
  }
}

// ── Icon primitives ────────────────────────────────────────────────────────
const Icon = ({ children, size = 22 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
const IconServices  = () => <Icon><path d="M14.7 6.3a5 5 0 0 0-7 7l-6 6 2 2 6-6a5 5 0 0 0 7-7z" /><path d="M18 6l3-3" /></Icon>;
const IconFood      = () => <Icon><path d="M6 2v20" /><path d="M4 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" /><path d="M18 15c0-3 2-6 2-11" /><path d="M18 15v7" /></Icon>;
// Header icons
const IconSearch    = () => <Icon size={22}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>;
const IconBell      = () => <Icon size={22}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Icon>;
const IconDots      = () => <Icon size={22}><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /></Icon>;

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
  const [artifact, setArtifact] = useState<WorkspaceArtifact>("chat");
  // Mascot side-tool drawer · Philip 2026-08-27 · orthogonal to workspace
  // artifacts. Tap Mascot on the rail → drawer emerges (glass reveal). Does
  // NOT navigate or change the workspace · main conversation stays present.
  const [mascotDrawerOpen, setMascotDrawerOpen] = useState(false);

  // Real chat pipeline · useNexVoice hoisted here so composer + transcript sync.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
      setMessages((prev) => [...prev, { id: newMessageId("u"), sender: "user", text, time: nowClock() }]);
    },
    onNexReply: (reply) => {
      setMessages((prev) => [...prev, { id: newMessageId("n"), sender: "nex", text: reply, time: nowClock() }]);
    },
    onError: (msg) => setChatError(msg),
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
    setMessages((prev) => [...prev, { id: newMessageId("u"), sender: "user", text, time: nowClock() }]);
    void voice.sendText(text, { speak: false });
    composerRef.current?.focus();

    // ── CONTEXTUAL GUIDANCE PERFORMANCE (Philip 2026-08-26 P1 proof) ──
    // Detect what the user is asking about → fire coordinated NEX guidance
    // in parallel with the brain reply. Speech (bubble) · pupil · beam ·
    // target pulse · optional auto-navigation · optional follow-up guide.
    const intent = detectIntent(text);
    if (intent) {
      // First guide · point at the rail vertical (or wherever the target lives).
      guide({ target: intent.target, intent: intent.intent });

      // Auto-navigate to the matching artifact so the follow-up guide lands
      // on the right workspace. Timed to arrive just as the first beam fades.
      if (intent.target === "food") {
        setTimeout(() => setArtifact("food"), 900);
      }
      if (intent.target === "discovery") {
        setTimeout(() => setArtifact("services"), 900);
      }

      // Follow-up guide (e.g. food-card) · fires after the first guide + a
      // small settle window for the new artifact to mount + register targets.
      if (intent.followUp) {
        const fu = intent.followUp;
        setTimeout(() => guide({ target: fu.target, intent: fu.intent }), 2400);
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

  // ── Eye conversation state machine ─────────────────────────────────────
  // Eye is CHARACTER · voice button is the mic. Tapping eye triggers a
  // phrase + pupil looks at target + precision guidance beam fires from
  // pupil to the actual voice button (Philip 2026-08-26 guidance system).
  const [eyeConvState, setEyeConvState] = useState<EyeConversationState>(initialEyeState());
  const [eyeBubble, setEyeBubble] = useState<{ text: string; dwellMs?: number } | null>(null);
  const guidance = useGuidance();
  // Unified NEX guidance intent API · speech + pupil + beam as one performance ·
  // serial queue · one guide at a time.
  const guide = useNexGuide({
    setEyeLook: setOrbLookAt,
    setBubble:  setEyeBubble,
  });
  function handleEyeTap() {
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

  // Right rail · 5 labelled slots. Tap triggers contextual guidance + swaps
  // workspace artifact. NEX speaks about the target while pointing at it.
  //
  // 2026-08-27 · Philip · Mascot replaces the "Favorites" placeholder slot.
  // Mascot is a SIDE TOOL (opens a drawer) · not a workspace navigator.
  // Tapping toggles mascotDrawerOpen; the main conversation stays present.
  const rail: RailButton[] = [
    { id: "profile",   label: "Profile",   icon: <IconProfile />,  active: artifact === "profile",   guidanceTarget: "rail-profile",   onClick: () => { guide({ target: "profile",   intent: "introduce" }); setArtifact("profile"); } },
    { id: "mascot",    label: "Mascot",    icon: <IconMascot />,   active: mascotDrawerOpen,         guidanceTarget: "rail-mascot",    onClick: () => {
      const opening = !mascotDrawerOpen;
      setMascotDrawerOpen(opening);
      // NEX reacts on OPEN only · not on close · with silence 35% of the
      // time so heavy users don't hear a phrase every activation. The picker
      // handles familiarity escalation (introduce → familiar → micro).
      if (opening) guide({ target: "mascot-drawer", intent: "introduce", silenceProbability: 0.35 });
    } },
    { id: "history",   label: "History",   icon: <IconClock />,    active: artifact === "history",   guidanceTarget: "rail-history",   onClick: () => { guide({ target: "history",   intent: "introduce" }); setArtifact("history"); } },
    { id: "services",  label: "Services",  icon: <IconServices />, active: artifact === "services",  guidanceTarget: "rail-services",  onClick: () => { guide({ target: "services",  intent: "introduce" }); setArtifact("services"); } },
    { id: "food",      label: "Food",      icon: <IconFood />,     active: artifact === "food",      guidanceTarget: "rail-food",      onClick: () => { guide({ target: "food",      intent: "introduce" }); setArtifact("food"); } },
  ];

  // Header icons · 3 slots · tap makes orb glance up.
  // NOTE (Philip 2026-08-26): header taps now trigger contextual NEX guidance
  // via the unified guide() API instead of a raw glance. NEX speaks about
  // what the user just tapped · pupil moves · beam points · target pulses.
  const headerIcons: HeaderIconButton[] = [
    { id: "search", label: "Search",        icon: <IconSearch />, guidanceTarget: "header-search", onClick: () => guide({ target: "search",        intent: "introduce" }) },
    { id: "alerts", label: "Notifications", icon: <IconBell />,   guidanceTarget: "header-alerts", onClick: () => guide({ target: "notifications", intent: "introduce" }) },
    { id: "menu",   label: "Menu",          icon: <IconDots />,   guidanceTarget: "header-menu",   onClick: () => guide({ target: "discovery",     intent: "introduce" }) },
  ];

  const contextCard = (() => {
    const c = cardFromDiscovery(discovery?.latest ?? null, discovery?.rollup24h ?? null);
    return (
      <NexContextCard
        tone={c.tone}
        icon={c.icon}
        primary={c.primary}
        secondary={c.secondary}
        cta={{ label: "View", onClick: () => router.push("/nex-head-quarters/discovery") }}
      />
    );
  })();

  return (
    <NexHudFrame
      mode={mode}
      themeId={themeId}
      rightRailContent={rail}
      headerIcons={headerIcons}
      contextSlot={contextCard}
      voiceState={nexState}
      voiceOrbLookAt={orbLookAt}
      onVoiceOrbTap={handleEyeTap}
      eyeBubbleMessage={eyeBubble?.text ?? null}
      eyeBubbleDwellMs={eyeBubble?.dwellMs}
      onEyeBubbleDismiss={() => setEyeBubble(null)}
      overlaySlot={
        <NexSideDrawer
          isOpen={mascotDrawerOpen}
          onClose={() => setMascotDrawerOpen(false)}
          title="Mascots"
          hideDefaultHeader
        >
          <NexMascotDrawerContent
            theme={NEX_HUD_THEME_REGISTRY[themeId]}
            onClose={() => setMascotDrawerOpen(false)}
            onSelected={() => { /* keep drawer open · doctrine §11.5 */ }}
            onPostMascot={(m) => {
              // Post the mascot into the chat transcript · green button in
              // the detail overlay. Optional caption stays empty · the image
              // itself is the message. Also switches artifact to chat so the
              // posted mascot is immediately visible.
              setArtifact("chat");
              setMessages((prev) => [...prev, {
                id: newMessageId("u"),
                sender: "user",
                text: "",
                mascotUrl: m.asset,
                mascotName: m.name,
                time: nowClock(),
              }]);
            }}
          />
        </NexSideDrawer>
      }
      composerSlot={
        <NexComposer
          ref={composerRef}
          value={inputText}
          onChange={handleComposerChange}
          onSubmit={handleComposerSubmit}
          nexState={nexState}
          onMicTap={() => { glance("center"); handleVoiceButtonUsed(); voice.tap(); }}
        />
      }
      onBezelButton={(id) => {
        if (id === "nex-wordmark") setArtifact("chat");
      }}
    >
      {artifact === "chat"      && <NexWorkspaceChat messages={messages} nexState={nexState} onOrbTap={() => voice.tap()} error={chatError} />}
      {artifact === "food"      && <NexWorkspaceExplore rollup24h={discovery?.rollup24h ?? null} onVerticalTap={() => setArtifact("chat")} />}
      {artifact === "services"  && <NexWorkspaceExplore rollup24h={discovery?.rollup24h ?? null} onVerticalTap={() => setArtifact("chat")} />}
      {artifact === "history"   && <NexWorkspaceFriends />}
      {artifact === "profile"   && <NexWorkspaceIdle onAskTap={() => setArtifact("chat")} greetingName="profile (coming soon)" />}
    </NexHudFrame>
  );
}
