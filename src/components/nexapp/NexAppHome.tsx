// NEX home · main client shell.
//
// Orchestrates:
//   · header (hero banner + ambient glow)
//   · greeting (name-personalised · one-line hard cap)
//   · conversation frame with 4 FUNCTIONAL corner slots (Priority 4 reframe):
//       top-left  = NEX       (identity constant · tap posts entry-greeting)
//       top-right = PERSON    (current entity · you-initial / partner in P4+)
//       bot-left  = DIRECTORY (opens Discover wheel in the centre)
//       bot-right = CONTACTS  (opens Contacts panel in the centre)
//   · connection line + running-glow overlay on the frame's top border
//   · centre content · onboarding OR corner-panel OR message list
//   · text input bar (attach · text · send)
//   · reactive orange particle field
//   · bottom nav with central NEX identity button (voice tap dispatcher)
//   · 4-state animation (idle · listening · thinking · speaking)
//
// Voice/STT/TTS lives in the shared useNexVoice hook (single voice
// pipeline · pinned feedback_nex_voice_pipeline_architecture). This
// component only renders + subscribes to events — no voice logic here.
//
// Full architectural spec: pinned
// `project_nex_four_corners_functional_model_2026_08_21`.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { NEX } from "@/lib/nexapp/tokens";
import {
  DEMO_CARDS,
  INITIAL_CONVERSATION,
  type Message,
} from "@/lib/nexapp/mockData";
import { useNexVoice, type NexVoiceState, type NexVoiceLanguage } from "@/lib/nex-voice";
import { useNexIdentity } from "@/lib/nex-identity";
import { useVirtualKeyboard } from "@/lib/nexapp/useVirtualKeyboard";
import { BusinessCarousel } from "./BusinessCarousel";
import { ContactsPanel } from "./ContactsPanel";
import { DirectoryPanel } from "./DirectoryPanel";
import { FoodDirectoryPanel } from "./FoodDirectoryPanel";
import { NexDirectoryCards } from "./NexDirectoryCards";
import { NexExploreBackground } from "./NexExploreBackground";
import { NexExploreSatellites } from "./NexExploreSatellites";
import { NexFriendChatView } from "./NexFriendChatView";
import {
  NexPendingChats,
  NEX_MOCK_FRIENDS,
  NEX_MOCK_FRIEND_THREADS,
  type FriendMessage,
} from "./NexPendingChats";
import { NexSideDrawer } from "./NexSideDrawer";
// Bottom nav pill REMOVED 2026-08-23 · Philip redirection: voice orb relocates
// into the conversation frame · four corners cover all navigation.
import { NexCommsSatellites } from "./NexCommsSatellites";
import { NexConnectionLine, type NexConnectionActivity } from "./NexConnectionLine";
import { NexCornerSlot } from "./NexCornerSlot";
import { NexIdentityButton } from "./NexIdentityButton";
import { NexWeldingSparks } from "./NexWeldingSparks";
import { NexIdentityOnboarding } from "./NexIdentityOnboarding";
import { OrangeParticleField } from "./OrangeParticleField";

// The nexapp UI only cares about these four states — 'error' from the hook
// is treated as 'idle' visually (silent recovery, matches prior behaviour).
export type NexState = "idle" | "listening" | "thinking" | "speaking";

function toNexState(s: NexVoiceState): NexState {
  return s === "error" ? "idle" : s;
}

function nowClock(): string {
  const d = new Date();
  const hh = ((d.getHours() + 11) % 12) + 1;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const suffix = d.getHours() < 12 ? "AM" : "PM";
  return `${String(hh).padStart(2, "0")}:${mm} ${suffix}`;
}

export function NexAppHome() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_CONVERSATION);
  const [inputText, setInputText] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // NEX Radial Mode-Controller · Phase A (2026-08-23 · Philip greenlit).
  // Doctrine: project_nex_communication_hub_final_direction_2026_08_23.
  // Central NEX orb is the mode controller. Phase A wires the minimum:
  // "idle" (nothing extra) ↔ "communication" (composer visible). Explore
  // and future modes ("explore" | "personalize" | "create") accepted by
  // the enum but not yet reachable — Phase C onward will wire them.
  const [nexMode, setNexMode] = useState<
    "idle" | "explore" | "communication" | "personalize" | "create"
  >("idle");
  // Discovery drawer (2026-08-23 amendment). Opened by tapping the
  // Discovery satellite inside Explore mode. Doctrine:
  // project_nex_communication_hub_final_direction_2026_08_23 ·
  // "Discovery Drawer".
  const [isDiscoveryDrawerOpen, setIsDiscoveryDrawerOpen] = useState(false);
  // Pending friend chats (2026-08-23 · Philip refinement · mock only).
  // activeFriendId drives the friend-chat view inside the conversation
  // frame; friendThreads holds the mock message state per friend so
  // typing a reply appends to the correct thread.
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [friendThreads, setFriendThreads] = useState<Record<string, FriendMessage[]>>(
    NEX_MOCK_FRIEND_THREADS,
  );
  // Priority 4 · Four Corners Functional Model (opened Philip 2026-08-21).
  // Corner activations render INTO the chat area, never navigate away —
  // per pinned `project_nex_four_corners_functional_model_2026_08_21`.
  //   `null`            → normal conversation view
  //   `directory`       → Directory wheel
  //   `people`          → Contacts panel
  //   `food-directory`  → Food Yogyakarta panel (first Specialist Skin
  //                       of the Universal Listings Engine · pinned
  //                       `project_nex_food_discovery_yogyakarta_v1`)
  const [cornerPanel, setCornerPanel] = useState<
    null | "directory" | "people" | "food-directory"
  >(null);
  // First-time identity gate (Philip 2026-08-21 · pinned
  // `project_nex_first_time_identity_onboarding`). If localStorage has
  // no identity, we render <NexIdentityOnboarding /> inside the chat
  // frame until the user completes the flow.
  const identity = useNexIdentity();
  // ⚠️ DEV OVERRIDE (Philip 2026-08-21) · force English throughout the
  // session regardless of country choice or brain-detected language.
  // Remove this block + restore the identity-driven initial + brain-
  // adoption effect to re-enable multilingual behaviour.
  //
  // What this overrides:
  //   · identity.conversationLanguage → ignored (was: Indonesia→id, else→en)
  //   · useNexVoice onLanguageChange   → ignored (brain-adoption disabled below)
  //   · Greeting + prompt copy         → always English strings
  //
  // Keeps working (not overridden):
  //   · Onboarding country picker (still stores country in identity)
  //   · Language plumbing in useNexVoice · providers · brain (all still
  //     accept and honour language arguments if unhardcoded)
  const FORCE_DEV_LANGUAGE_EN = true;

  const initialLang: NexVoiceLanguage = FORCE_DEV_LANGUAGE_EN
    ? "en"
    : identity.state.status === "ready"
      ? identity.state.identity.conversationLanguage
      : "en";
  const [language, setLanguageState] = useState<NexVoiceLanguage>(initialLang);
  // Keep language in sync with the identity once it hydrates from
  // localStorage — UNLESS dev override is on.
  useEffect(() => {
    if (FORCE_DEV_LANGUAGE_EN) return;
    if (identity.state.status === "ready") {
      const idLang = identity.state.identity.conversationLanguage;
      if (idLang !== language) setLanguageState(idLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.state.status]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedCategoryRef = useRef<string | null>(null);
  selectedCategoryRef.current = selectedCategory;
  // Snapshot ref so onNexReply can read the last user message without
  // re-registering the callback on every message change.
  const messagesRef = useRef<Message[]>(INITIAL_CONVERSATION);
  messagesRef.current = messages;

  // Single voice pipeline · shared with /nex-voice-demo. This component
  // owns the message list + language toggle; the hook owns provider/state/
  // STT/POST/TTS and adopts language from the brain per turn.
  const voice = useNexVoice({
    language,
    // Brain adoption disabled while dev override forces English.
    onLanguageChange: (lang) => { if (!FORCE_DEV_LANGUAGE_EN) setLanguageState(lang); },
    // Prefix category slug into the outbound message so downstream brain
    // can bias search — same behaviour as before, moved to the callback.
    preprocessMessage: (text) =>
      selectedCategoryRef.current ? `[${selectedCategoryRef.current}] ${text}` : text,
    onPartial: (t) => setInputText(t),
    onUserFinal: (text) => {
      // Optimistic user bubble as soon as we know the final text.
      setInputText("");
      setMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}`, sender: "user", text, time: nowClock() },
      ]);
    },
    onNexReply: (reply) => {
      // Attach the mock supplier carousel when the message context suggests
      // a shopping/supplier surface — matches the reference-image behaviour
      // without needing a real Listings backend.
      const lastUser = messagesRef.current[messagesRef.current.length - 1]?.text ?? "";
      const shouldShowCards =
        /supplier|shop|store|near you|tile|plumber|near me/i.test(reply + " " + lastUser);
      setMessages((prev) => [
        ...prev,
        {
          id: `n-${Date.now()}`,
          sender: "nex",
          text: reply,
          time: nowClock(),
          cards: shouldShowCards ? DEMO_CARDS : undefined,
        },
      ]);
    },
    fallbackApiDown:
      "I'm having trouble reaching the team right now. Give me a moment and try again.",
    onError: (msg) => setVoiceError(msg),
  });

  const nexState = toNexState(voice.state);

  // ── Connection line activity signal ─────────────────────────
  // Direction of travel = who is currently producing. Fires WHILE
  // COMPOSING (not just after send). Pinned doctrine:
  // `project_nex_identity_connection_line_2026_08_21`.
  //
  // TYPING-IDLE DEBOUNCE (Philip 2026-08-21): if the user stops typing
  // for 2 seconds, the ember stops — even if there's still text in the
  // input. Any keystroke or deletion resets the timer.
  const [activelyTyping, setActivelyTyping] = useState(false);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typingIdleTimerRef.current) {
      clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (inputText.trim().length === 0) {
      setActivelyTyping(false);
      return;
    }
    setActivelyTyping(true);
    typingIdleTimerRef.current = setTimeout(() => setActivelyTyping(false), 2000);
    return () => {
      if (typingIdleTimerRef.current) {
        clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
    };
  }, [inputText]);

  //   listening      → user is speaking (from the person side)
  //   thinking/speak → NEX is generating/delivering (from the NEX side)
  //   activelyTyping → user is typing right now (2s idle debounce above)
  const connectionActivity: NexConnectionActivity =
    voice.state === "listening" ? "person-composing" :
    voice.state === "thinking" || voice.state === "speaking" ? "nex-generating" :
    activelyTyping ? "person-composing" :
    "idle";

  // Auto-scroll on new messages · but keep initial view at the TOP so
  // the first turn (bathroom tiles + business cards) is what the visitor
  // sees on load. Only scroll to bottom when the user grows the thread.
  const initialCountRef = useRef(messages.length);
  useEffect(() => {
    if (!scrollRef.current) return;
    if (messages.length > initialCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages]);

  // Central identity-button tap · one-tap dispatcher.
  //   idle       → begin listening
  //   listening  → end mic (auto-sends whatever was captured)
  //   thinking   → cancel in-flight
  //   speaking   → cancel TTS (barge-in)
  // If the runtime doesn't support voice, focus the text input as a fallback.
  const onIdentityTap = useCallback(() => {
    // Clear any stale error so the retry is visually clean.
    setVoiceError(null);
    if (!voice.isSupported) {
      setVoiceError("Voice not available in this browser. Try Chrome or Edge.");
      inputRef.current?.focus();
      return;
    }
    voice.tap();
  }, [voice]);

  // Central orb TAP handler · Radial Mode-Controller Phase A+C (2026-08-23).
  // Doctrine: project_nex_communication_hub_final_direction_2026_08_23.
  // Tap the centre NEX → enter Communication mode (composer + keyboard).
  // Also clears any open corner panel (Directory/Contacts) so the composer
  // replaces the panel instead of stacking. MUST focus synchronously so
  // mobile browsers accept the focus() call and open the software keyboard.
  const handleOrbTap = useCallback(() => {
    setNexMode("communication");
    setCornerPanel(null);
    setActiveFriendId(null);
    inputRef.current?.focus();
  }, []);

  // ── Phase E · Hold-to-speak (2026-08-23) ────────────────────────────
  // Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
  // "Hold NEX → voice listening · orb IS the voice surface".
  //   · pointerdown starts a 220 ms hold timer.
  //   · If pointer released before 220 ms → treated as a TAP · handleOrbTap
  //     opens Communication mode. The tap fires from the native click event
  //     (which follows pointerup synchronously) so mobile focus() still
  //     works for opening the software keyboard.
  //   · If timer fires (≥ 220 ms held) → wasHoldRef = true · onIdentityTap
  //     runs the existing voice pipeline (idle → listening).
  //   · Release after hold → onIdentityTap again (listening → submit).
  //   · Pointer leave / cancel mid-hold → onIdentityTap cancels cleanly.
  //   · Click handler consumes the trailing click when a hold happened so
  //     it doesn't also fire the Communication-mode tap behaviour.
  const HOLD_THRESHOLD_MS = 220;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHoldRef = useRef(false);

  const handleOrbPointerDown = useCallback(() => {
    wasHoldRef.current = false;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      wasHoldRef.current = true;
      holdTimerRef.current = null;
      // Enter voice listening (idle → listening) via the existing pipeline.
      onIdentityTap();
    }, HOLD_THRESHOLD_MS);
  }, [onIdentityTap]);

  const handleOrbPointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (wasHoldRef.current) {
      // Release after hold → end mic (auto-submits captured speech).
      // wasHoldRef stays true here so the trailing native click can consume it.
      onIdentityTap();
    }
  }, [onIdentityTap]);

  const handleOrbClick = useCallback(() => {
    if (wasHoldRef.current) {
      // Trailing click after a hold gesture — swallow so we don't also fire
      // the tap-to-Communication behaviour.
      wasHoldRef.current = false;
      return;
    }
    handleOrbTap();
  }, [handleOrbTap]);

  const handleOrbPointerCancel = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (wasHoldRef.current) {
      // Pointer left the orb or was interrupted mid-hold → end voice
      // cleanly. The trailing click (if any) will consume the wasHold flag.
      onIdentityTap();
    }
  }, [onIdentityTap]);

  // Explore corner tap · Phase C (2026-08-23). Toggles nexMode
  // explore ↔ idle and keeps the existing DirectoryPanel visible while in
  // Explore mode (doctrine: "existing radial visual style reused, not
  // reinvented"). CategoryConstellation continues to serve as the visual
  // surface — this handler just coordinates it with the mode controller.
  const handleExploreCornerTap = useCallback(() => {
    setActiveFriendId(null);
    if (nexMode === "explore") {
      setNexMode("idle");
      setCornerPanel(null);
    } else {
      setNexMode("explore");
      setCornerPanel("directory");
    }
  }, [nexMode]);

  // Contacts corner tap · Phase C (2026-08-23). Contacts is NOT a NEX
  // mode (doctrine: "Contacts corner unchanged"), but opening/closing it
  // must exit any in-progress mode cleanly so the panel replaces the
  // composer/explore surface.
  const handleContactsCornerTap = useCallback(() => {
    setActiveFriendId(null);
    setCornerPanel((prev) => (prev === "people" ? null : "people"));
    setNexMode((prev) => (prev === "idle" ? prev : "idle"));
  }, []);

  // Comms dock close (blur + backdrop tap) · Phase C guard (2026-08-23).
  // Only resets to idle if we are STILL in communication mode. Prevents
  // the 150 ms blur setTimeout from stomping on a legitimate transition
  // to another mode (e.g. user taps Explore corner while composer is open
  // → nexMode becomes "explore" → blur fires later → without this guard
  // the mode would revert to "idle" and dismiss the Explore panel).
  const handleCommsClose = useCallback(() => {
    setNexMode((prev) => (prev === "communication" ? "idle" : prev));
  }, []);

  // Directory panel close (X button) · Phase C (2026-08-23). Mirrors the
  // Explore corner toggle so closing via the panel's X returns nexMode to
  // idle in lockstep with cornerPanel.
  const handleDirectoryClose = useCallback(() => {
    setCornerPanel(null);
    setNexMode((prev) => (prev === "explore" ? "idle" : prev));
  }, []);

  // Friend chat handlers · 2026-08-23 (Philip refinement).
  // Selecting a friend from NexPendingChats opens the composer, closes
  // any panel/mode conflict, focuses the input for typing. Close returns
  // the frame to the NEX conversation.
  const handleFriendSelect = useCallback((friendId: string) => {
    setActiveFriendId(friendId);
    setCornerPanel(null);
    setNexMode("communication");
    // Focus asynchronously so the composer has mounted before we ask
    // for focus (the composer is always mounted but a fresh selection
    // may benefit from a rAF tick to settle the layout).
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleFriendClose = useCallback(() => {
    setActiveFriendId(null);
  }, []);

  const onTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputText.trim();
      if (!text) return;
      // If a friend chat is active, the message goes to that friend's
      // mock thread instead of NEX (2026-08-23 Philip refinement).
      if (activeFriendId) {
        setFriendThreads((prev) => ({
          ...prev,
          [activeFriendId]: [
            ...(prev[activeFriendId] ?? []),
            { id: `u-${Date.now()}`, sender: "user", text, time: nowClock() },
          ],
        }));
        setInputText("");
        return;
      }
      // Text turns are silent — chat UI reads the reply, no TTS.
      void voice.sendText(text, { speak: false });
    },
    [inputText, voice, activeFriendId],
  );

  // (The old `onCategoryTap` handler was removed 2026-08-21 when the
  // four-corner reframe replaced the 4 category-shortcut buttons with
  // NEX / PERSON / DIRECTORY / PEOPLE. Category selection now flows
  // through the DirectoryPanel · see `setSelectedCategory` passed there.)

  // Top-left NEX corner tap → NEX posts an entry-point greeting into
  // the current chat. Canned message (not a brain call) — this is an
  // explicit UI invitation, "hey NEX, I want your attention." Behaves
  // like a "raise NEX's hand" affordance without going through STT/API.
  //
  // Philip 2026-08-21:
  //   · SOLO (user ↔ NEX):        "Hey — how can I help?"
  //   · MULTI (user ↔ other user): "Hey — yes, where are we at, how can I help?"
  // Multi-user variant is deferred until NEX-to-NEX chat lands
  // (pinned `project_nex_four_corners_functional_model` Priority 4+ ·
  // pinned `project_nex_identity_connection_line`). Once a "current
  // conversation partner" exists in state, switch the copy accordingly.
  const onNexCornerTap = useCallback(() => {
    // Close any open corner panel so the new NEX message is visible.
    setCornerPanel(null);
    // Append the canned greeting as a NEX message bubble.
    const greeting = "Hey — how can I help?";
    setMessages((prev) => [
      ...prev,
      {
        id: `n-nex-tap-${Date.now()}`,
        sender: "nex",
        text: greeting,
        time: nowClock(),
      },
    ]);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        // Constrain to exact viewport so the frame can flex correctly
        // and doesn't overflow the screen. Messages inside the frame
        // scroll (see messageListStyle).
        height: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hide scrollbars on any nested scroll container tagged with
          .nex-no-scrollbar (chat list, business carousel). We never
          show scrollbars in the NEX UI. */}
      <style>{`
        .nex-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .nex-no-scrollbar::-webkit-scrollbar { width: 0; height: 0; display: none; }
      `}</style>

      {/* Ambient orange radial glow at the top · sits behind the arc. */}
      <div style={ambientGlowStyle} aria-hidden />

      {/* ─── Header: hero banner (logo + tagline + arcs, one asset) ─── */}
      <header style={headerStyle}>
        <img
          src="https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2021,%202026,%2001_19_24%20AM.png"
          alt="NEX · Ask. Discover. Connect."
          width={2172}
          height={724}
          style={heroImageStyle}
        />
      </header>

      {/* ─── Greeting ───────────────────────────────────────────── */}
      {/* Greets by name once identity is known. Language of the greeting
          follows the active session language — HINT from country initially,
          adapts thereafter from speech. NO visible EN/ID control on the
          user surface per pinned `project_nex_should_know_not_ask`.
          Subtitle is HARD-CAPPED to one line via nowrap + ellipsis
          (Philip 2026-08-21: *"we must make sure that we never have 2
          lines under Hi boss — always short 1 line max for mobile screen"*).
          Indonesian copy shortened to match English length so ellipsis
          rarely triggers. */}
      <div style={greetingWrapStyle}>
        <div style={helloStyle}>
          {identity.state.status === "ready"
            ? (language === "id" ? `Halo ${identity.state.identity.name},` : `Hi ${identity.state.identity.name},`)
            : (language === "id" ? "Halo," : "Hi there,")}
        </div>
        <div style={askStyle}>
          {language === "id" ? "Tanya NEX atau ngobrol dengan teman" : "AskNex Or Chat With Friends"}
        </div>
      </div>

      {/* ─── Conversation frame · four functional corners anchored to it ─
           Priority 4 corner reframe (Philip 2026-08-21):
             top-left  = NEX       (identity constant · tap posts greeting)
             top-right = PERSON    (you · initial from identity)
             bot-left  = DIRECTORY (opens Discover wheel in centre)
             bot-right = CONTACTS  (opens Contacts panel in centre · renamed
                                    from PEOPLE 2026-08-21 · full cards/groups
                                    UI = Priority 4+ per pinned doctrine)
           Corner activations are STATES rendered in the centre chat area,
           never navigate away. Per pinned Four Corners Functional Model. */}
      <div style={conversationFrameStyle}>
        {/* Explore mode background image · fills the frame edge-to-edge
            (up to the rounded rim) · fades in/out on mode change. Behind
            all other frame content (z-index 0). Doctrine:
            project_nex_communication_hub_final_direction_2026_08_23 ·
            Explore mode · Philip 2026-08-23. */}
        <AnimatePresence>
          {cornerPanel === "directory" && (
            <motion.div
              key="explore-bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 24,
                zIndex: 0,
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <NexExploreBackground />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Welding sparks · overlay for Explore mode · sparks emit from
            the frame's top rim and fall through the scene. Doctrine ·
            Philip 2026-08-23 refinement. */}
        {cornerPanel === "directory" && <NexWeldingSparks />}

        <NexCornerSlot kind="nex" position="top-left"
          // Tap NEX → NEX posts a canned entry-point greeting into
          // the chat (also closes any open corner panel). See
          // `onNexCornerTap` for the multi-user variant note.
          onTap={onNexCornerTap}
        />
        <NexCornerSlot kind="person" position="top-right"
          entityLabel={identity.state.status === "ready"
            ? (identity.state.identity.name?.trim()?.[0]?.toUpperCase() ?? "")
            : undefined
          }
          // No-op for now · in NEX-to-NEX chat (Priority 4+) this will
          // open the current conversation partner's profile action sheet.
        />
        {/* Bottom-left = EXPLORE (Phase C · 2026-08-23 · relabeled from
            "Discover"). Tap wires through the mode controller so nexMode
            becomes "explore" and the existing DirectoryPanel/
            CategoryConstellation surface (unchanged) renders as the
            visual radial. `active` derives from nexMode for semantic
            correctness. */}
        <NexCornerSlot kind="directory" position="bottom-left"
          active={nexMode === "explore"}
          onTap={handleExploreCornerTap}
        />
        {/* Bottom-right = CONTACTS (Philip 2026-08-21 rename from
            "People" → "Contacts"). Internal state key stays `people`
            for now — full Contacts UI (cards · groups · unread · block)
            arrives at Priority 4+ per pinned doctrine. */}
        <NexCornerSlot kind="people" position="bottom-right"
          active={cornerPanel === "people"}
          onTap={handleContactsCornerTap}
        />

        {/* Connection line + ember overlay · sits on the frame's top
            border between the NEX and PERSON corners. Ember direction =
            who's producing (user typing/speaking → toward NEX · NEX
            thinking/speaking → toward user). Idle = quiet frame border. */}
        <NexConnectionLine activity={connectionActivity} />

        {/* First-time onboarding gate · pinned
            `project_nex_first_time_identity_onboarding_2026_08_21`. When
            no identity in localStorage, the chat area is replaced by the
            onboarding component. Orb + NEX identity remain visible around
            it (per pinned `project_nex_is_the_constant_world_changes`). */}
        {identity.state.status === "onboarding" ? (
          <NexIdentityOnboarding
            onComplete={(id) => {
              identity.save(id);
              // Also flip the session language to the country's initial
              // hint immediately so the greeting + first turn come up
              // in the right language.
              setLanguageState(id.conversationLanguage);
              voice.setLanguage(id.conversationLanguage);
            }}
          />
        ) : (
          // Radial Mode-Controller · Phase D (2026-08-23) · mode transitions.
          // Doctrine: project_nex_communication_hub_final_direction_2026_08_23 ·
          // "Center NEX stays anchored throughout · duration 250–400 ms ·
          // restrained · not bouncy · this becomes a signature NEX interaction."
          // AnimatePresence mode="wait" runs exit fully before enter so the
          // transition reads as sequential contract → expand. Total ~380 ms
          // (160 exit + 220 enter). Orb stays anchored (rendered outside this
          // presence, unchanged). Scroll auto-scroll effect fires after render
          // so message-list ref reattaches cleanly on remount.
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={cornerPanel ?? (activeFriendId ? `friend:${activeFriendId}` : "messages")}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                duration: cornerPanel === null ? 0.22 : 0.22,
                ease: [0.4, 0, 0.2, 1],
              }}
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {cornerPanel === "directory" ? (
                // 2026-08-23 amendment · Philip: Explore mode radial replaced
                // with 5 action satellites (Emoji · Call · Discovery · Video ·
                // Camera). Discovery opens the right-side Discovery Drawer.
                // DirectoryPanel/CategoryConstellation retained in the
                // codebase (imports kept below for future reuse in other
                // surfaces) but no longer rendered in Explore mode.
                <NexExploreSatellites onDiscoveryTap={() => setIsDiscoveryDrawerOpen(true)} />
              ) : cornerPanel === "food-directory" ? (
                <FoodDirectoryPanel
                  language={language}
                  onClose={() => setCornerPanel(null)}
                />
              ) : cornerPanel === "people" && identity.state.status === "ready" ? (
                <ContactsPanel
                  myNexId={identity.state.identity.publicNexId}
                  myName={identity.state.identity.name}
                  onClose={() => setCornerPanel(null)}
                  language={language}
                />
              ) : activeFriendId ? (
                (() => {
                  const friend = NEX_MOCK_FRIENDS.find((f) => f.id === activeFriendId);
                  if (!friend) return null;
                  return (
                    <NexFriendChatView
                      friend={friend}
                      messages={friendThreads[activeFriendId] ?? []}
                      onClose={handleFriendClose}
                    />
                  );
                })()
              ) : (
                // Scrollable message list · scrollbars hidden via .nex-no-scrollbar
                <div ref={scrollRef} className="nex-no-scrollbar" style={messageListStyle}>
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                  {nexState === "thinking" && <TypingIndicator />}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Voice status · surfaces mic-denied / unsupported-browser / etc. */}
        {voiceError && (
          <div
            role="status"
            style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "rgba(249, 115, 22, 0.10)",
              border: `1px solid ${NEX.orangeSoft}`,
              borderRadius: 12,
              color: NEX.orange,
              fontSize: 12,
              lineHeight: 1.4,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span style={{ flex: 1 }}>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              aria-label="Dismiss"
              style={{
                background: "transparent",
                border: "none",
                color: NEX.orange,
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* NEX Input Dock · Phase 2a (2026-08-23) · centre voice orb relocated
            into the conversation frame at bottom-centre, between the Directory
            and Contacts corner buttons. The permanent floating pill + bottom
            nav pill are BOTH GONE. Tap opens NexCommsDock (Phase 2b). */}
        {identity.state.status === "ready" && (
          <div
            style={centeredOrbStyle}
            onPointerDown={handleOrbPointerDown}
            onPointerUp={handleOrbPointerUp}
            onPointerCancel={handleOrbPointerCancel}
            onPointerLeave={handleOrbPointerCancel}
          >
            {/* onTap uses the native click event (fires after pointerup) so
                mobile focus() lands inside a real user-gesture handler. Hold
                detection is on pointer events; handleOrbClick consumes the
                trailing click when a hold gesture completed. */}
            <NexIdentityButton nexState={nexState} onTap={handleOrbClick} />
          </div>
        )}
      </div>

      {/* ─── Reactive orange particle floor ─────────────────────── */}
      <div style={particleWrapStyle} aria-hidden>
        <OrangeParticleField nexState={nexState} />
      </div>

      {/* Bottom nav pill REMOVED (2026-08-23) · voice orb relocated · four
          corners cover navigation (Discover / Contacts / Person / NEX). */}

      {/* Radial Mode-Controller · Phase A composer + Phase B satellites
          (2026-08-23). Doctrine:
          project_nex_communication_hub_final_direction_2026_08_23.
          NexCommsDock is always mounted so the orb tap can synchronously
          focus the input to open the mobile keyboard. Satellites (File ·
          Camera · Emoji/GIF · Call · Video) mount/unmount with Communication
          mode and appear as a semicircular arc above the composer,
          following the keyboard via useVirtualKeyboard. All satellites
          are placeholder no-ops until Phase H wires real infrastructure. */}
      {identity.state.status === "ready" && (
        <>
          <NexCommsSatellites isOpen={nexMode === "communication"} />
          <NexCommsDock
            isOpen={nexMode === "communication"}
            inputRef={inputRef}
            value={inputText}
            onChange={setInputText}
            onSubmit={onTextSubmit}
            onClose={handleCommsClose}
          />
          {/* Discovery Drawer · opens via the Discovery satellite in
              Explore mode. 60% viewport width · right side · scrollable
              directory landscape cards. Doctrine:
              project_nex_communication_hub_final_direction_2026_08_23 ·
              "Discovery Drawer". */}
          <NexSideDrawer
            isOpen={isDiscoveryDrawerOpen}
            onClose={() => setIsDiscoveryDrawerOpen(false)}
            title="Discover"
          >
            <NexDirectoryCards onNavigate={() => setIsDiscoveryDrawerOpen(false)} />
          </NexSideDrawer>

          {/* Pending friend chats · fixed bottom-left · mock avatars for
              friends who have sent messages awaiting a reply. Tapping
              opens the friend's mock thread + composer for typing.
              (2026-08-23 · Philip refinement.) */}
          <NexPendingChats
            activeFriendId={activeFriendId}
            onSelectFriend={handleFriendSelect}
          />
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Inline sub-components (kept in one file for locality of visual style).
// ═══════════════════════════════════════════════════════════════

// (The `CategoryShortcutButton` + `CategoryIcon` inline components were
// removed 2026-08-21 when Priority 4 opened the four-corner reframe.
// Category icons now live in `DirectoryPanel.tsx`, the corner slots in
// `NexCornerSlot.tsx`. See pinned
// `project_nex_four_corners_functional_model_2026_08_21`.)

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "85%" }}>
        {!isUser && (
          <div
            style={{
              width: 32, height: 32, minWidth: 32,
              borderRadius: "50%",
              background: NEX.bgSurface,
              border: `1px solid ${NEX.borderMuted}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
            }}
          >
            <span>NE</span>
            <span style={{ color: NEX.orange, marginLeft: 1 }}>X</span>
          </div>
        )}
        <div
          style={{
            background: NEX.bgSurfaceHi,
            borderRadius: 16,
            padding: "10px 14px",
            fontSize: 14,
            lineHeight: 1.45,
            color: NEX.text,
            border: `1px solid ${NEX.borderMuted}`,
          }}
        >
          {message.text}
          <div style={{ fontSize: 10, color: NEX.textFaint, marginTop: 6, textAlign: isUser ? "right" : "left" }}>
            {message.time}
            {isUser && <span style={{ marginLeft: 4, color: NEX.textFaint }}>✓</span>}
          </div>
        </div>
      </div>
      {message.sender === "nex" && message.cards && message.cards.length > 0 && (
        <div style={{ marginTop: 10, marginLeft: 40, marginRight: -12, alignSelf: "stretch" }}>
          <BusinessCarousel cards={message.cards} />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 40 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <span style={dotAnim(0)} />
        <span style={dotAnim(160)} />
        <span style={dotAnim(320)} />
      </div>
      <span style={{ fontSize: 11, color: NEX.textFaint }}>NEX is thinking…</span>
    </div>
  );
}

function dotAnim(delayMs: number): React.CSSProperties {
  return {
    width: 6, height: 6, borderRadius: "50%",
    background: NEX.orange,
    display: "inline-block",
    animation: `nex-dot 1.2s ${delayMs}ms infinite ease-in-out`,
    opacity: 0.8,
  };
}

// NEX Communication Dock · Phase 2b (2026-08-23).
// Doctrine: project_nex_input_dock_interaction_model_2026_08_23
//   · Idle: centre voice orb IS the entry point; this dock is INVISIBLE.
//   · Tap orb: dock slides up from below + native keyboard rises + dock
//     positions itself above the keyboard via useVirtualKeyboard.
//   · Dismiss keyboard / tap outside / input blur: dock slides back down
//     + orb returns to idle position.
// Always mounted so the orb's tap handler can synchronously focus the
// input (mobile browsers require focus() in the same interaction stack
// to open the software keyboard).
function NexCommsDock({
  isOpen,
  inputRef,
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const { keyboardHeight, isKeyboardOpen } = useVirtualKeyboard();
  const canSend = value.trim().length > 0;

  // Close on input blur, with a small delay so tapping the send button
  // (which briefly steals focus) doesn't close the dock immediately.
  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        onClose();
      }
    }, 150);
  }, [inputRef, onClose]);

  // Refocus input after submit so dock stays open for the next message.
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      onSubmit(e);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onSubmit, inputRef],
  );

  return (
    <>
      {/* Invisible backdrop · captures taps outside the dock while open. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 20,
          background: "transparent",
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* Dock · slides up from below when isOpen · lifts with keyboard. */}
      <motion.form
        onSubmit={handleSubmit}
        initial={false}
        animate={{
          y: isOpen ? 0 : 120,
          opacity: isOpen ? 1 : 0,
          bottom: isOpen && isKeyboardOpen ? keyboardHeight + 12 : 22,
        }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        style={{
          ...inputBarStyle,
          position: "fixed",
          left: 22,
          right: 22,
          zIndex: 21,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
        data-comms-dock-open={isOpen ? "true" : undefined}
      >
        {/* Attachment · placeholder for compose-extras (pinned doctrine · Phase 3+). */}
        <button
          type="button"
          aria-label="Attach (coming soon)"
          aria-hidden
          tabIndex={-1}
          disabled
          style={{ ...attachBtnStyle, opacity: 0.35, cursor: "default" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NEX.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.5V7a5 5 0 0 0-10 0v10a3 3 0 0 0 6 0V9a1 1 0 0 0-2 0v8" />
          </svg>
        </button>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Type to NEX…"
          style={inputStyle}
        />

        <button
          type="submit"
          aria-label="Send message"
          disabled={!canSend}
          style={{
            ...sendBtnStyle,
            background: canSend ? NEX.orange : "rgba(255,255,255,0.08)",
            color: canSend ? "#fff" : "rgba(255,255,255,0.35)",
            cursor: canSend ? "pointer" : "not-allowed",
            boxShadow: canSend
              ? `0 4px 14px rgba(0,0,0,0.4), 0 0 12px ${NEX.orangeGlowLo}`
              : "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4Z" />
          </svg>
        </button>
      </motion.form>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles (inline · prototype-friendly · single-file locality of vision).
// ═══════════════════════════════════════════════════════════════

const ambientGlowStyle: React.CSSProperties = {
  position: "absolute",
  top: -140,
  left: "50%",
  transform: "translateX(-50%)",
  width: 480,
  height: 380,
  background: `radial-gradient(circle at 50% 55%, ${NEX.orangeGlowLo} 0%, transparent 60%)`,
  pointerEvents: "none",
  zIndex: 0,
};

const headerStyle: React.CSSProperties = {
  position: "relative",
  paddingTop: "max(env(safe-area-inset-top), 12px)",
  paddingBottom: 2,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  zIndex: 2,
};

// Hero banner asset · single image replaces the previous
// logo + tagline + arc composition. Reduced 25% (2026-08-21) then further
// reduced ~20% (2026-08-23) per NEX UI refinement doctrine to reclaim
// vertical space for the conversation. Identity remains recognisable —
// only the vertical footprint is trimmed.
const heroImageStyle: React.CSSProperties = {
  display: "block",
  width: "min(60%, 210px)",
  height: "auto",
  maxHeight: 72,
  objectFit: "contain",
  filter: `drop-shadow(0 4px 18px ${NEX.orangeGlowLo})`,
};

// Greeting shifted UP (Philip 2026-08-21: "move Hi boss up little to
// increase the chat window height") — top padding reduced from 14→4,
// bottom padding reduced from 8→4. Frees ~14px for the conversation
// frame below.
const greetingWrapStyle: React.CSSProperties = {
  padding: "4px 22px 4px",
  zIndex: 2,
  position: "relative",
};

const helloStyle: React.CSSProperties = {
  color: NEX.orange,
  fontSize: 16,
  fontWeight: 500,
  marginBottom: 2,
  letterSpacing: -0.1,
  whiteSpace: "nowrap",     // "Hi Alex," must never wrap
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// Subtitle · HARD ONE-LINE cap (Philip 2026-08-21). Any copy that
// exceeds the container width is ellipsised rather than wrapped — a
// two-line greeting compresses the chat area on mobile and reads busy.
// Font size 20px (reduced from 26) so it never dominates the greeting.
// Current copy: "AskNex Or Chat With Friends" (English) ·
// "Tanya NEX atau ngobrol dengan teman" (Indonesian, active when the
// English-only dev override is lifted). Both fit at 20px without
// triggering ellipsis on a 375px+ viewport.
const askStyle: React.CSSProperties = {
  color: NEX.text,
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: -0.3,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

// (The EN/ID toggle style block was removed 2026-08-21 per pinned
// `project_nex_should_know_not_ask` — NEX must not expose language
// controls on the user surface. Language now derives from country at
// onboarding + adapts from speech per turn — see NexIdentityOnboarding
// and useNexVoice `onLanguageChange`.)

const conversationFrameStyle: React.CSSProperties = {
  position: "relative",
  // Compact top margin (Philip 2026-08-21: chat window should be taller).
  // Reduced 18→12 to complement the smaller corner buttons and the
  // moved-up greeting. Total vertical space reclaimed for the chat area:
  // ~10px from greeting padding + ~6px here + ~12px from smaller corner
  // buttons overlap = ~28px more usable chat height on mobile.
  // Using longhand margin properties throughout to avoid React's
  // "shorthand + longhand" style warning (previous version mixed
  // `margin` shorthand with `marginBottom` longhand).
  marginTop: 12,
  marginLeft: 22,
  marginRight: 22,
  // NEX Input Dock redirection 2026-08-23 · bottom nav REMOVED, but the chat
  // window bottom stays at its previous position (Philip: "do not extend the
  // chat window"). The area BELOW the frame (~106 px) is now clean empty
  // space where the nav pill used to be, showing the orange particles through.
  // The corners and centre voice orb protrude at the frame's bottom edge as
  // before — they now hang over that empty space instead of over the nav pill.
  marginBottom: NEX.navHeight + 14,
  // padding-bottom keeps the message list clear of the Directory/Contacts
  // corner buttons + centre voice orb which straddle the frame's bottom.
  padding: "18px 12px 34px",
  borderRadius: 24,
  border: `1px solid ${NEX.border}`,
  background: `linear-gradient(180deg, #0a0a0a 0%, #060606 100%)`,
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  zIndex: 2,
};

const messageListStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 2,
  paddingLeft: 2,
  // 2026-08-23 redirection · no more permanent input pill overlapping the
  // frame bottom. Kept 40 px so the centre voice orb (which now protrudes
  // into the frame's bottom-centre) doesn't crowd the last chat bubble.
  paddingBottom: 40,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  scrollBehavior: "smooth",
};

const inputBarStyle: React.CSSProperties = {
  // 2026-08-23 composer refinement: pill dropped down to sit ON THE SAME LINE
  // as the Directory (bottom-left) + Contacts (bottom-right) corner buttons.
  // Corners are at `bottom: -14` with `left/right: -12` protruding from the
  // frame. Input matches `bottom: -14` and clears the corners by ~6 px on
  // each side (46 corner width + -12 outer offset = corner inner edge at
  // frame-edge + 34 · input at frame-edge + 40 gives comfortable spacing).
  position: "absolute",
  bottom: -14,
  left: 40,
  right: 40,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: NEX.bgSurfaceHi,
  border: `1px solid ${NEX.borderMuted}`,
  borderRadius: 999,
  padding: "6px 6px 6px 14px",
  zIndex: 2,
};

const attachBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: NEX.textMuted,
  cursor: "pointer",
  padding: 4,
  display: "flex",
  alignItems: "center",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: NEX.text,
  fontSize: 14,
  padding: "6px 0",
  minWidth: 0,
};

// Send-button style (replaces the earlier micBtnStyle · 2026-08-21 ·
// text-input voice affordance removed; central NEX orb is the sole
// voice entry point per Philip's design correction).
const sendBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  transition: "background 200ms ease, box-shadow 200ms ease, color 200ms ease",
  userSelect: "none",
  touchAction: "manipulation",
};

// Centre voice orb positioning · inside the conversation frame at bottom-centre,
// between the Directory and Contacts corner buttons. 2026-08-23 Phase 2a.
// Uses `bottom: -22` (matches the pill-sink value from the earlier voice-orb
// refinement) so the orb visually sits at the same vertical band as the
// corner buttons (which are at `bottom: -14, height: 46` → visual centre ~9 px
// inside the frame). translate(-50%) centres horizontally.
const centeredOrbStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: -22,
  transform: "translateX(-50%)",
  zIndex: 3,
  // Phase E · hold-to-speak · prevent the browser from turning a hold
  // gesture into a scroll or text-selection. Applied only to the orb
  // wrapper so the rest of the app scrolls normally.
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

const particleWrapStyle: React.CSSProperties = {
  position: "absolute",
  // Radial-cloud particle field (2026-08-23 · NEX UI refinement).
  // Previously a rectangular band above the nav pill that read as a
  // "square orange sheet." Now full-viewport so the RADIAL cloud can
  // fade naturally in every direction from its bottom-centre focal
  // point (where the voice orb sits). The particle field itself renders
  // strong near the focal point and dissolves into black at the edges —
  // no visible rectangular boundary because the container's edges are
  // simply where the invisible-particle threshold is reached.
  inset: 0,
  zIndex: 1,
  pointerEvents: "none",
};
