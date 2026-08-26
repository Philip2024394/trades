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
import { NexActivityBars } from "./NexActivityBars";
import { NexEmojiTray } from "./NexEmojiTray";
import { NexIdentityButton } from "./NexIdentityButton";
import { NexReactionFullScreen, FULL_SCREEN_DURATION_MS } from "./NexReactionFullScreen";
import { NexGrenadeAnimation, type GrenadeRect } from "./NexGrenadeAnimation";
import { useNexAction } from "@/lib/nexapp/useNexAction";
import { getAction } from "@/lib/nex-actions/registry";
import {
  getReactionByKey,
  toggleReaction,
  DEFAULT_ANIMATION,
  type MessageReactions,
  type NexBubbleAnimation,
  type NexFullScreenEffect,
} from "@/lib/nexapp/nexEmojis";
// Bottom nav pill REMOVED 2026-08-23 · Philip redirection: voice orb relocates
// into the conversation frame · four corners cover all navigation.
import { NexCommsSatellites } from "./NexCommsSatellites";
import { NexConnectionLine, type NexConnectionActivity } from "./NexConnectionLine";
import { NexCornerSlot } from "./NexCornerSlot";
import { NexWeldingSparks } from "./NexWeldingSparks";
import { NexIdentityOnboarding } from "./NexIdentityOnboarding";

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

/**
 * Props for NexAppHome.
 *
 * `chromeless` — when true, the component assumes it is rendered INSIDE the
 * HUD frame's CENTRE workspace zone. In chromeless mode we suppress the
 * pieces of chrome the HUD frame now owns (page-level bezel bg, top hero
 * banner, greeting, four corner slots, redundant bottom-floating helpers).
 * The conversation, composer, panels, mascots and voice pipeline all
 * remain live. Doctrine:
 *   project_nex_themeable_architecture_constitution_2026_08_25
 *   project_nex_workspace_terminology_addendum_2026_08_25
 */
interface NexAppHomeProps {
  chromeless?: boolean;
}

export function NexAppHome({ chromeless = false }: NexAppHomeProps = {}) {
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
  // Activity drawer · 2026-08-24 · opens via the three-dancing-bars button
  // (NexActivityBars) fixed at bottom-right. Shows friends with unread as a
  // full scrollable list · a companion access point to the round Friends
  // affordance at bottom-left (NexPendingChats) which is the collapsed dock.
  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState(false);
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

  // Reactions · aggregated per message · one entry per emoji type · toggleable.
  // Structure: Map<messageId, MessageReactions> · MessageReactions is
  // Record<emoji, {count, iReacted}>. Empty by default · added via the
  // NEX emoji tray (flip-in) or by tapping an existing chip to toggle.
  const [reactionsByMessage, setReactionsByMessage] = useState<
    Record<string, MessageReactions>
  >({});
  const [pickerForMessageId, setPickerForMessageId] = useState<string | null>(null);
  // Just-added-reaction · triggers the CSS animation on the chip that just
  // landed. Keyed by messageId · value carries the emoji + timestamp so a
  // repeat-add of the same emoji still remounts the chip (fresh animation).
  const [justAddedByMessage, setJustAddedByMessage] = useState<
    Record<string, { emoji: string; at: number }>
  >({});
  // Full-screen milestone effect · one active at a time · auto-clears after
  // its duration so the DOM overlay unmounts and particles GC.
  const [fullScreenEvent, setFullScreenEvent] = useState<
    { effect: NexFullScreenEffect; at: number } | null
  >(null);
  // Active grenade animation · one at a time. When set, the corresponding
  // bubble is hidden and the cinematic plays on the captured rect. When the
  // animation completes, the bubble stays hidden and the history line
  // (returned by the server) is inserted in its place.
  const [grenadeEvent, setGrenadeEvent] = useState<
    { messageId: string; rect: GrenadeRect; historyLine: string; mascotUrl: string; at: number } | null
  >(null);
  const [grenadedMessages, setGrenadedMessages] = useState<
    Record<string, { historyLine: string; at: number }>
  >({});
  const [grenadeError, setGrenadeError] = useState<string | null>(null);
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const nexAction = useNexAction();
  const demoSyncedRef = useRef<boolean>(false);
  const signupGrantedRef = useRef<boolean>(false);
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Identity + conversationId hoisted here (before handlePickReaction which
  // captures them) · moved from below to fix ReferenceError under Turbopack
  // where `let`-scoped React hook results are not hoisted like `var`.
  // The second `useNexIdentity` further down was collapsed into this one.
  const identity = useNexIdentity();
  const conversationId = identity.state.status === "ready"
    ? `nex:default:${identity.state.identity.internalId}`
    : "nex:default:anonymous";
  const handleToggleReaction = useCallback((messageId: string, emoji: string) => {
    setReactionsByMessage((prev) => ({
      ...prev,
      [messageId]: toggleReaction(prev[messageId] ?? {}, emoji),
    }));
  }, []);
  const handlePickReaction = useCallback(async (emoji: string) => {
    if (!pickerForMessageId) return;
    const targetId = pickerForMessageId;
    setPickerForMessageId(null);

    // Consumable path · route through the NEX Actions server (grenade et al).
    const asAction = getAction(emoji);
    if (asAction?.tier === "consumable" && asAction.id === "grenade") {
      // Guard: grenade is own-messages only. Reject client-side before we
      // waste a server round-trip. (Server still enforces this via the SQL
      // ownership check · this is just for better UX.)
      const targetMsg = messages.find((m) => m.id === targetId);
      if (!targetMsg || targetMsg.sender !== "user") {
        setGrenadeError("You can only grenade your own posts.");
        setTimeout(() => setGrenadeError(null), 4000);
        return;
      }
      const bubble = bubbleRefs.current.get(targetId);
      if (!bubble) { setGrenadeError("Bubble not found"); return; }
      const rect = bubble.getBoundingClientRect();
      const capturedRect: GrenadeRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      const result = await nexAction.invoke({
        actionId: "grenade",
        target: { kind: "message", messageId: targetId, conversationId },
      });
      if (!result.ok) {
        const err = result.error as { code: string; message?: string; reason?: string };
        const msg = String(err.message ?? "");
        setGrenadeError(
          err.code === "insufficient-sparks" ? "Not enough Sparks. Get more to grenade posts." :
          err.code === "forbidden"           ? "You can only grenade your own posts." :
          err.code === "rate-limited"        ? "Too many grenades. Slow down." :
          err.code === "unauthorised"        ? "Sign in to use Sparks." :
          /message-not-found/.test(msg)      ? "That post isn't on the server yet. Send a new one, then try grenading it." :
          /already-deleted/.test(msg)        ? "That post was already grenaded." :
          `Grenade failed (${err.code}${msg ? ": " + msg : ""}). Try again.`
        );
        setTimeout(() => setGrenadeError(null), 5000);
        return;
      }
      if (result.kind !== "message-deleted") return;
      // Server confirmed · fire the cinematic against the captured rect.
      setGrenadeEvent({
        messageId: targetId,
        rect: capturedRect,
        historyLine: result.historyLine,
        mascotUrl: asAction.mascot.imageUrl,
        at: Date.now(),
      });
      return;
    }

    // Reaction path · unchanged.
    setReactionsByMessage((prev) => ({
      ...prev,
      [targetId]: toggleReaction(prev[targetId] ?? {}, emoji),
    }));
    setJustAddedByMessage((prev) => ({ ...prev, [targetId]: { emoji, at: Date.now() } }));
    const meta = getReactionByKey(emoji);
    if (meta?.fullScreen) {
      const at = Date.now();
      setFullScreenEvent({ effect: meta.fullScreen, at });
      const duration = FULL_SCREEN_DURATION_MS[meta.fullScreen] ?? 2500;
      setTimeout(() => {
        setFullScreenEvent((cur) => (cur && cur.at === at ? null : cur));
      }, duration);
    }
  }, [pickerForMessageId, nexAction, conversationId, messages]);

  // Grenade animation completion · commit the history line into the feed.
  const handleGrenadeComplete = useCallback(() => {
    if (!grenadeEvent) return;
    setGrenadedMessages((prev) => ({
      ...prev,
      [grenadeEvent.messageId]: { historyLine: grenadeEvent.historyLine, at: grenadeEvent.at },
    }));
    setGrenadeEvent(null);
  }, [grenadeEvent]);
  // First-time identity gate (Philip 2026-08-21 · pinned
  // `project_nex_first_time_identity_onboarding`). If localStorage has
  // no identity, we render <NexIdentityOnboarding /> inside the chat
  // frame until the user completes the flow. (identity + conversationId
  // are hoisted above to run before handlePickReaction.)
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
      // Real UUID so this message is a valid grenade target on the server.
      const messageId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      setMessages((prev) => [
        ...prev,
        { id: messageId, sender: "user", text, time: nowClock() },
      ]);
      // Persist to server (async, fire-and-forget) so grenade can find it.
      if (identity.state.status === "ready") {
        const userId = identity.state.identity.internalId;
        const displayName = identity.state.identity.name;
        fetch("/api/nex-chat/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-nex-user-id": userId,
            "x-nex-user-display-name": displayName,
          },
          body: JSON.stringify({
            conversationId,
            messageId,
            content: text,
          }),
        }).catch((e) => console.warn("[nex-chat] persist failed:", e));
      }
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

  // Signup Sparks grant · fires once per identity-ready mount, server-side
  // idempotent by user_id so re-mounts / re-installs / re-logins never
  // grant twice (Philip 2026-08-25 · F3.5 non-negotiable).
  useEffect(() => {
    if (signupGrantedRef.current) return;
    if (identity.state.status !== "ready") return;
    const userId = identity.state.identity.internalId;
    signupGrantedRef.current = true;
    fetch("/api/nex-actions/wallet/signup-grant", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-nex-user-id": userId },
      body: JSON.stringify({ userId }),
    }).catch(e => console.warn("[nex-actions signup grant] fetch failed:", e));
  }, [identity.state]);

  // Demo persistence bridge · once identity is ready, take every user-sender
  // message currently in state that isn't already a UUID, rewrite it with a
  // real UUID, and POST it to the server. Runs at most once per session
  // (demoSyncedRef guard) · idempotent on the server side (chat_message_upsert
  // ON CONFLICT DO NOTHING). Purpose: user should NOT have to send a new
  // message just to demo grenade (Philip 2026-08-25 · F3.5 requirement).
  useEffect(() => {
    if (demoSyncedRef.current) return;
    if (identity.state.status !== "ready") return;
    const userId = identity.state.identity.internalId;
    const displayName = identity.state.identity.name;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const targets = messages.filter(m => m.sender === "user" && !uuidRe.test(m.id));
    if (targets.length === 0) { demoSyncedRef.current = true; return; }
    demoSyncedRef.current = true;
    // Map old id → new UUID · replay locally, then POST each.
    const idMap = new Map<string, string>();
    for (const t of targets) idMap.set(t.id, crypto.randomUUID());
    setMessages(prev => prev.map(m => idMap.has(m.id) ? { ...m, id: idMap.get(m.id)! } : m));
    for (const t of targets) {
      const newId = idMap.get(t.id)!;
      fetch("/api/nex-chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nex-user-id": userId,
          "x-nex-user-display-name": displayName,
        },
        body: JSON.stringify({ conversationId, messageId: newId, content: t.text }),
      }).catch(e => console.warn("[nex-chat demo sync] failed:", e));
    }
  }, [identity.state, messages, conversationId]);

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
        // 2026-08-25 · Philip Phase 2 · chromeless mode fills the HUD frame's
        // CENTRE workspace zone (parent-controlled height). Standalone mode
        // still owns the full mobile viewport for backwards compatibility.
        height: chromeless ? "100%" : "100dvh",
        // 2026-08-25 · Philip · single-background policy · container is
        // black fallback · the one page-level image (below) fills the
        // viewport when NOT chromeless (HUD frame paints the bezel in
        // chromeless mode).
        background: chromeless ? "transparent" : "#000000",
        color: "#F5F5F5",
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Hide scrollbars on any nested scroll container tagged with
          .nex-no-scrollbar (chat list, business carousel). We never
          show scrollbars in the NEX UI. Also defines the 3s on/off
          background-light pulse keyframe (2026-08-24 · Philip). */}
      <style>{`
        .nex-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .nex-no-scrollbar::-webkit-scrollbar { width: 0; height: 0; display: none; }
        /* ═══════ Reaction landing animations · Philip 2026-08-25 ═══════
           Each animation attaches to a chip via className. Runs once on
           mount (key change from parent triggers a remount so the CSS
           animation re-fires when the same emoji is re-added). */
        @keyframes nex-r-pop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nex-r-drop {
          0%   { transform: translateY(-40px) scale(0.7); opacity: 0; }
          70%  { transform: translateY(4px) scale(1.1); opacity: 1; }
          85%  { transform: translateY(-2px) scale(1); }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes nex-r-fadein {
          0%   { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes nex-r-ripple {
          0%   { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes nex-r-flyin {
          0%   { transform: translate(80px, -60px) scale(0.4) rotate(45deg); opacity: 0; }
          60%  { transform: translate(0, 0) scale(1.15) rotate(-10deg); opacity: 1; }
          100% { transform: translate(0, 0) scale(1) rotate(0); opacity: 1; }
        }
        @keyframes nex-r-wobble {
          0%   { transform: scale(0); opacity: 0; }
          30%  { transform: scale(1.2, 0.85); opacity: 1; }
          45%  { transform: scale(0.9, 1.15); }
          60%  { transform: scale(1.08, 0.95); }
          75%  { transform: scale(0.97, 1.03); }
          100% { transform: scale(1); }
        }
        @keyframes nex-r-glow {
          0%   { filter: drop-shadow(0 0 0 rgba(249,115,22,0)); opacity: 0; transform: scale(0.9); }
          30%  { filter: drop-shadow(0 0 14px rgba(249,115,22,0.55)); opacity: 1; transform: scale(1); }
          100% { filter: drop-shadow(0 0 3px rgba(249,115,22,0.55)); opacity: 1; transform: scale(1); }
        }
        @keyframes nex-r-flip {
          0%   { transform: perspective(400px) rotateY(-180deg) scale(0.5); opacity: 0; }
          60%  { transform: perspective(400px) rotateY(15deg) scale(1.1); opacity: 1; }
          100% { transform: perspective(400px) rotateY(0) scale(1); opacity: 1; }
        }
        @keyframes nex-r-sparkle-burst {
          0%   { transform: translate(0, 0) scale(0); opacity: 0; }
          30%  { transform: translate(calc(var(--tx) * 0.4), calc(var(--ty) * 0.4)) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.4); opacity: 0; }
        }
        .nex-r-anim-pop     { animation: nex-r-pop     0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .nex-r-anim-drop    { animation: nex-r-drop    0.65s cubic-bezier(0.5, 0, 0.5, 1.4) both; }
        .nex-r-anim-ripple  { animation: nex-r-fadein  0.35s ease-out both; }
        .nex-r-anim-flyin   { animation: nex-r-flyin   0.55s cubic-bezier(0.4, 0, 0.2, 1) both; }
        .nex-r-anim-sparkle { animation: nex-r-pop     0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .nex-r-anim-wobble  { animation: nex-r-wobble  0.8s ease-out both; }
        .nex-r-anim-glow    { animation: nex-r-glow    1.4s ease-out both; }
        .nex-r-anim-flip    { animation: nex-r-flip    0.55s cubic-bezier(0.4, 0, 0.2, 1.2) both; }
        .nex-r-ring         {
          position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid rgba(249,115,22,0.8); pointer-events: none;
          animation: nex-r-ripple 0.9s ease-out both;
        }
        .nex-r-sparkle {
          position: absolute; top: 50%; left: 50%;
          font-size: 12px; color: #F97316; pointer-events: none;
          text-shadow: 0 0 6px rgba(249,115,22,0.7);
          animation: nex-r-sparkle-burst 0.7s ease-out both;
        }
        /* ═══════ Full-screen milestone animations ═══════ */
        @keyframes nex-fs-confetti {
          0%   { transform: translateY(-40px) rotate(0);   opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes nex-fs-fw {
          0%   { transform: translate(0, 0) scale(0); opacity: 1; }
          50%  { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 1; }
          100% { transform: translate(calc(var(--tx) * 1.3), calc(var(--ty) * 1.3)) scale(0.5); opacity: 0; }
        }
        @keyframes nex-fs-heart {
          0%   { transform: translateY(0) rotate(0); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translateY(-110vh) rotate(20deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nex-r-anim-pop, .nex-r-anim-drop, .nex-r-anim-ripple, .nex-r-anim-flyin,
          .nex-r-anim-sparkle, .nex-r-anim-wobble, .nex-r-anim-glow, .nex-r-anim-flip,
          .nex-r-ring, .nex-r-sparkle { animation: none !important; }
        }
        /* nex-bg-pulse + nex-bg-crossfade keyframes removed 2026-08-25 ·
           Philip · single-background policy. */
      `}</style>

      {/* Orange pulse backlight REMOVED 2026-08-25 · Philip · single
          background policy · only the URL below remains. */}

      {/* 2026-08-25 · Philip · SINGLE BACKGROUND · reference-model applied ·
          this is the one and only page-level image. All other bg layers
          (pulse · crossfade · speaking-aura) removed. */}
      {!chromeless && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: `url("https://ik.imagekit.io/7grri5v7d/Untitledsfdf.png?updatedAt=1787575405064") center/cover no-repeat fixed`,
          }}
        />
      )}

      {/* Full-screen milestone reaction · confetti/fireworks/hearts overlay.
          Only mounted when a milestone-flavour emoji is posted. Auto-clears
          after the effect's duration (see FULL_SCREEN_DURATION_MS). */}
      {fullScreenEvent && (
        <NexReactionFullScreen key={fullScreenEvent.at} effect={fullScreenEvent.effect} />
      )}

      {/* Grenade cinematic · plays only after server confirms deletion. */}
      {grenadeEvent && (
        <NexGrenadeAnimation
          key={grenadeEvent.at}
          rect={grenadeEvent.rect}
          mascotUrl={grenadeEvent.mascotUrl}
          reducedMotion={reducedMotion}
          onComplete={handleGrenadeComplete}
        />
      )}

      {/* Grenade failure toast · shows when server rejects the action. */}
      {grenadeError && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: "rgba(0,0,0,0.92)",
            border: `1px solid ${NEX.orange}`,
            borderRadius: 999,
            padding: "10px 18px",
            fontSize: 12,
            color: NEX.text,
            boxShadow: `0 6px 20px ${NEX.orangeGlowLo}`,
          }}
        >
          {grenadeError}
        </div>
      )}

      {/* Crossfade second background REMOVED 2026-08-25 · Philip · single
          background policy. */}

      {/* Aurora Dots REMOVED 2026-08-25 · Philip · single-background policy. */}

      {/* 2026-08-24 · Philip · Speaking-state aura. When NEX is speaking the
          ambient layer adds Philip's ImageKit asset as a soft additive overlay
          so the whole background reacts to NEX talking. Fades in over 240 ms
          when speaking starts, fades out over 480 ms when NEX stops. Sits
          above the artwork (z:1) and dots but below content (z:2) so speech
          reactivity reads as part of the background, not a UI badge. */}
      {/* NEX-speaking aura background REMOVED 2026-08-25 · Philip · single
          background policy · voice-state feedback lives on the orb + mic. */}

      {/* ─── Header: hero banner (logo + tagline + arcs, one asset) ───
          Suppressed in chromeless mode — HUD frame's TOP zone hosts the hero. */}
      {!chromeless && (
        <header style={headerStyle}>
          <img
            src="https://ik.imagekit.io/7grri5v7d/ChatGPT%20Image%20Aug%2024,%202026,%2011_20_05%20PM.png"
            alt="NEX · Ask. Discover. Connect."
            width={2027}
            height={776}
            style={heroImageStyle}
          />
        </header>
      )}

      {/* Greeting restored 2026-08-25 · Philip · reference model calls it back.
          Silver "AskNex Or Chat With Friends" · orange "Hi Boss,"
          Suppressed in chromeless mode · greeting relocates to HUD hero overlay. */}
      {!chromeless && (
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
      )}

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
        {/* Fog moved to PAGE LEVEL (top/bottom of viewport) 2026-08-25 ·
            Philip · atmospheric fog now rolls down from the phone header
            and up from the phone footer, not from the chat frame edges. */}

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

        {/* Four corner slots · suppressed in chromeless mode because their
            functions relocate to the HUD frame's bezel affordances (NEX
            wordmark TL · person cam-1 TR · Directory + Contacts to bottom
            dock). Internal state + handlers stay live so events dispatched
            by the HUD shell can still toggle the same panels. */}
        {!chromeless && (
          <>
            <NexCornerSlot kind="nex" position="top-left"
              // Tap NEX → NEX posts a canned entry-point greeting into
              // the chat (also closes any open corner panel).
              onTap={onNexCornerTap}
            />
            <NexCornerSlot kind="person" position="top-right"
              entityLabel={identity.state.status === "ready"
                ? (identity.state.identity.name?.trim()?.[0]?.toUpperCase() ?? "")
                : undefined
              }
            />
            <NexCornerSlot kind="directory" position="bottom-left"
              active={nexMode === "explore"}
              onTap={handleExploreCornerTap}
            />
            <NexCornerSlot kind="people" position="bottom-right"
              active={cornerPanel === "people"}
              onTap={handleContactsCornerTap}
            />
          </>
        )}

        {/* Connection line + ember overlay · sits on the frame's top
            border between the NEX and PERSON corners. Ember direction =
            who's producing (user typing/speaking → toward NEX · NEX
            thinking/speaking → toward user). Idle = quiet frame border. */}
        <NexConnectionLine activity={connectionActivity} />

        {/* 2026-08-24 PM · Philip · voice particle field REMOVED from the
            chat frame top border (was a 280×100 canvas rendering pixel
            particles reactive to nexState). Voice state now signalled
            purely through NexConnectionLine + orb glow. */}

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
                // Chat content ↔ emoji tray · 3D flip container. The chat
                // frame stays in place · only the interior flips when the
                // NEX reaction picker opens for a specific message.
                <div style={flipContainerStyle}>
                  <motion.div
                    style={{ ...flipFaceStyle, pointerEvents: pickerForMessageId ? "none" : "auto" }}
                    animate={{ rotateY: pickerForMessageId ? -180 : 0 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <div ref={scrollRef} className="nex-no-scrollbar" style={messageListStyle}>
                      {messages.map((m) => {
                        const grenaded = grenadedMessages[m.id];
                        if (grenaded) {
                          return (
                            <div
                              key={`grenaded-${m.id}`}
                              style={{
                                fontSize: 11,
                                color: NEX.textFaint,
                                textAlign: "center" as const,
                                padding: "6px 0",
                                letterSpacing: 0.2,
                              }}
                            >
                              {grenaded.historyLine}
                            </div>
                          );
                        }
                        // Hide the bubble during its own grenade animation
                        // so the ghost in the cinematic doesn't fight it.
                        if (grenadeEvent?.messageId === m.id) return null;
                        return (
                          <MessageBubble
                            key={m.id}
                            message={m}
                            reactions={reactionsByMessage[m.id] ?? {}}
                            justAdded={justAddedByMessage[m.id]}
                            onToggleReaction={handleToggleReaction}
                            onOpenPicker={setPickerForMessageId}
                            bubbleRef={(el) => {
                              if (el) bubbleRefs.current.set(m.id, el);
                              else bubbleRefs.current.delete(m.id);
                            }}
                          />
                        );
                      })}
                      {nexState === "thinking" && <TypingIndicator />}
                    </div>
                  </motion.div>
                  <motion.div
                    style={{ ...flipFaceStyle, pointerEvents: pickerForMessageId ? "auto" : "none" }}
                    animate={{ rotateY: pickerForMessageId ? 0 : 180 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <NexEmojiTray
                      onSelect={handlePickReaction}
                      onClose={() => setPickerForMessageId(null)}
                      activeEmojis={new Set(
                        pickerForMessageId
                          ? Object.values(reactionsByMessage[pickerForMessageId] ?? {})
                              .filter((r) => r.iReacted)
                              .map((r) => r.emoji)
                          : []
                      )}
                    />
                  </motion.div>
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

        {/* Voice orb RESTORED 2026-08-25 · Philip · reference model. Big glowing
            NEX identity orb sits centered above the always-visible composer.
            Composer's mic button ALSO stays wired for redundancy. */}
        {identity.state.status === "ready" && (
          <div
            style={centeredOrbStyle}
            onPointerDown={handleOrbPointerDown}
            onPointerUp={handleOrbPointerUp}
            onPointerCancel={handleOrbPointerCancel}
            onPointerLeave={handleOrbPointerCancel}
          >
            <NexIdentityButton nexState={nexState} onTap={handleOrbClick} />
          </div>
        )}
      </div>

      {/* Full-viewport particle wrap removed 2026-08-24 · Philip · voice
          particles now render as a small canvas centered on the chat frame's
          top border line (see the OrangeParticleField mount inside
          conversationFrame above). */}

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
            isOpen={true}
            inputRef={inputRef}
            value={inputText}
            onChange={setInputText}
            onSubmit={onTextSubmit}
            onClose={handleCommsClose}
            nexState={nexState}
            onMicClick={handleOrbClick}
            onMicPointerDown={handleOrbPointerDown}
            onMicPointerUp={handleOrbPointerUp}
            onMicPointerCancel={handleOrbPointerCancel}
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

          {/* Pending friend chats + three-dancing-bars activity button ·
              suppressed in chromeless mode because they occupy fixed bottom
              corners that collide with the HUD frame's bottom dock. Both
              functions relocate to bezel affordances / dock in Phase 2B. */}
          {!chromeless && (
            <>
              <NexPendingChats
                activeFriendId={activeFriendId}
                onSelectFriend={handleFriendSelect}
              />
              <NexActivityBars
                onOpen={() => setIsActivityDrawerOpen(true)}
                isOpen={isActivityDrawerOpen}
              />
            </>
          )}
          <NexSideDrawer
            isOpen={isActivityDrawerOpen}
            onClose={() => setIsActivityDrawerOpen(false)}
            title="Activity"
          >
            <NexActivityDrawerBody
              onSelectFriend={(id) => {
                setIsActivityDrawerOpen(false);
                handleFriendSelect(id);
              }}
            />
          </NexSideDrawer>
        </>
      )}
    </div>
  );
}

// ── Activity drawer body ──────────────────────────────────────────────
// Renders NEX_MOCK_FRIENDS filtered to unread > 0 as a scrollable list.
// Companion to the collapsed round-friends dock at bottom-left · this drawer
// is the alternate access point via the three-dancing-bars button. Real
// messenger backend lands later · mock only for now.

function NexActivityDrawerBody({
  onSelectFriend,
}: {
  onSelectFriend: (id: string) => void;
}) {
  const withUnread = NEX_MOCK_FRIENDS.filter((f) => (f.unread ?? 0) > 0);

  if (withUnread.length === 0) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: NEX.textFaint }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: NEX.text, marginBottom: 6 }}>
          You&apos;re all caught up
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          No unread messages · NEX will surface new activity here as it arrives.
        </div>
      </div>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {withUnread.map((f) => {
        const thread = NEX_MOCK_FRIEND_THREADS[f.id] ?? [];
        const lastMsg = thread[thread.length - 1];
        return (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onSelectFriend(f.id)}
              style={{
                appearance: "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: 12,
                background: NEX.bgSurface,
                border: `1px solid ${NEX.borderMuted}`,
                borderRadius: 12,
                color: NEX.text,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 40, height: 40, minWidth: 40,
                  borderRadius: "50%",
                  background: f.color,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {f.initial}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: NEX.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </span>
                  {lastMsg && (
                    <span style={{ fontSize: 11, color: NEX.textFaint, flexShrink: 0 }}>
                      {lastMsg.time}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: NEX.textMuted, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                  {lastMsg?.text ?? "New message"}
                </span>
              </span>
              <span
                aria-label={`${f.unread} unread`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 22,
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 999,
                  background: NEX.orange,
                  color: "#0a0a0a",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {f.unread}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
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

// Message bubble · full-width card with header (profile · name · time) +
// body + emoji reaction picker at bottom-right (Philip 2026-08-24 PM spec).
// Palette:
//   frame bg          #1F1F1F (charcoal, set on conversationFrameStyle)
//   bubble bg         #262626 (elevated 1 step lighter)
//   bubble border     rgba(white, 6%) whisper edge
//   body text         NEX.text  #F5F5F5
//   name (NEX)        NEX.orange (identity signal)
//   name (You)        NEX.text (neutral · you are the anchor)
//   time              NEX.textFaint
// Both bubbles are full width and visually identical apart from the header —
// NEX has the NE·X mark + orange name · user has their initial + "You".
//
// Reactions are aggregated · one entry per emoji type · Discord/WhatsApp style
// (Philip 2026-08-25). State lives in the PARENT (NexAppHome) so the emoji
// picker — which occupies the whole chat area via a 3D flip — can inject
// reactions into any specific message and toggle logic stays centralised.
// Tap own chip = removes your reaction · tap other chip = adds you.

function MessageBubble({
  message,
  reactions,
  justAdded,
  onToggleReaction,
  onOpenPicker,
  bubbleRef,
}: {
  message: Message;
  reactions: MessageReactions;
  justAdded?: { emoji: string; at: number };
  onToggleReaction: (messageId: string, emoji: string) => void;
  onOpenPicker: (messageId: string) => void;
  bubbleRef?: (el: HTMLDivElement | null) => void;
}) {
  const isUser = message.sender === "user";
  const identity = useNexIdentity();
  const userInitial = identity.state.status === "ready"
    ? identity.state.identity.name.trim().charAt(0).toUpperCase() || "Y"
    : "Y";
  const reactionEntries = Object.values(reactions);

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={bubbleRef}
        style={{
          // Frosted-glass bubble · Philip 2026-08-25 · reference model applied.
          // rgba(0,0,0,0.42) + backdrop-blur lets the world-map + orange radar
          // page background bleed through subtly, matching the "bubbles float
          // on ambient background · no chat rim" design language.
          position: "relative",
          overflow: "hidden",
          background: "rgba(0, 0, 0, 0.42)",
          backdropFilter: "blur(18px) saturate(1.2)",
          WebkitBackdropFilter: "blur(18px) saturate(1.2)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          borderRadius: 16,
          padding: "10px 14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Header: profile · name · time */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isUser ? (
            <div
              aria-hidden
              style={{
                width: 26, height: 26, borderRadius: "50%",
                background: `linear-gradient(180deg, ${NEX.orange} 0%, rgba(249,115,22,0.7) 100%)`,
                color: "#0a0a0a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
              }}
            >
              {userInitial}
            </div>
          ) : (
            <span
              aria-hidden
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: NEX.text,
                lineHeight: 1,
              }}
            >
              <span>NE</span>
              <span style={{ color: NEX.orange, marginLeft: 1 }}>X</span>
            </span>
          )}
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: isUser ? NEX.text : NEX.orange,
            letterSpacing: 0.1,
          }}>
            {isUser ? "You" : ""}
          </span>
          <span style={{ fontSize: 11, color: NEX.textFaint }}>· {message.time}</span>
          {isUser && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: NEX.textFaint }}>✓</span>
          )}
        </div>

        {/* Body */}
        <div style={{ fontSize: 14, lineHeight: 1.45, color: NEX.text }}>
          {message.text}
        </div>

        {/* Footer: reactions row (3× · no badge · no count) · picker trigger
            moved to the bespoke NEX page-peel corner at bottom-right. */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", minHeight: reactionEntries.length ? 24 : 0, paddingRight: 34 }}>
          {reactionEntries.map((r) => {
            const meta = getReactionByKey(r.emoji);
            // Animation gate: is this the emoji that was just added?
            const isJustAdded = justAdded?.emoji === r.emoji;
            const anim: NexBubbleAnimation = meta?.animation ?? DEFAULT_ANIMATION;
            // Keying with the timestamp forces React to remount the chip on
            // each re-add, so the CSS animation replays from frame 0.
            const chipKey = isJustAdded ? `${r.emoji}-${justAdded!.at}` : r.emoji;
            const showRing = isJustAdded && anim === "ripple";
            const showSparkles = isJustAdded && anim === "sparkle";
            return (
              <span key={chipKey} style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
                <button
                  type="button"
                  onClick={() => onToggleReaction(message.id, r.emoji)}
                  aria-label={`${meta?.label ?? r.emoji}${r.iReacted ? " · you reacted" : ""}`}
                  className={isJustAdded ? `nex-r-anim-${anim}` : undefined}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "block",
                    lineHeight: 0,
                    filter: r.iReacted
                      ? `drop-shadow(0 0 6px ${NEX.orangeGlow}) drop-shadow(0 2px 4px rgba(0,0,0,0.4))`
                      : "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
                    transition: isJustAdded ? "none" : "transform 160ms ease, filter 160ms ease",
                    transform: r.iReacted && !isJustAdded ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {meta?.imageUrl ? (
                    <img
                      src={meta.imageUrl}
                      alt=""
                      draggable={false}
                      style={{ width: 48, height: 48, objectFit: "contain", display: "block" }}
                    />
                  ) : (
                    <span style={{ fontSize: 42, lineHeight: 1 }}>{r.emoji}</span>
                  )}
                </button>
                {showRing && <span className="nex-r-ring" />}
                {showSparkles && [
                  { tx:  22, ty: -22 }, { tx: -22, ty: -22 },
                  { tx:  28, ty:   0 }, { tx: -28, ty:   0 },
                  { tx:  10, ty: -28 }, { tx: -10, ty: -28 },
                ].map((s, i) => (
                  <span
                    key={i}
                    className="nex-r-sparkle"
                    style={{ ["--tx" as string]: `${s.tx}px`, ["--ty" as string]: `${s.ty}px` }}
                  >
                    ✦
                  </span>
                ))}
              </span>
            );
          })}
        </div>

        {/* NEX page-peel corner · replaces the generic 😊. A folded triangular
            corner at bottom-right of the bubble · NEX mascot peeks through
            the revealed area · tap anywhere in the peel opens the emoji tray.
            Sits INSIDE the bubble (position:relative parent) so it's clipped
            to the bubble's rounded corner naturally. */}
        <NexPeelCorner
          onClick={() => onOpenPicker(message.id)}
          mascotUrl="https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdf-removebg-preview.png"
        />
      </div>

      {message.sender === "nex" && message.cards && message.cards.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <BusinessCarousel cards={message.cards} />
        </div>
      )}
    </div>
  );
}

// NEX page-peel corner · bespoke replacement for the generic 😊 button.
// A folded triangular corner at bottom-right of the bubble reveals a small
// NEX mascot peeking through. Tapping anywhere in the peel area opens the
// emoji tray (parent flips the chat interior to show the tray).
//
// CSS anatomy:
//   · Absolutely positioned 34×34 square at bottom-right of the bubble.
//   · Bubble's overflow:hidden clips the peel's outer bottom-right corner
//     into the same rounded curve as the bubble edge · so the revealed area
//     inherits the bubble's rounded corner naturally.
//   · Mascot image (clipped to the bottom-right triangle via clip-path) sits
//     in the revealed area.
//   · Fold flap (top-left triangle via clip-path) sits over it with a dark
//     gradient · a diagonal shadow along the fold line signals depth.
function NexPeelCorner({ onClick, mascotUrl }: { onClick: () => void; mascotUrl: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="React with NEX"
      style={{
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 34,
        height: 34,
        padding: 0,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "block",
        zIndex: 2,
      }}
    >
      {/* Revealed area · dark backing + mascot · bottom-right triangle */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          background: "linear-gradient(135deg, rgba(20,20,20,0) 48%, rgba(20,20,20,0.9) 52%)",
        }}
      />
      <img
        aria-hidden
        src={mascotUrl}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          bottom: 1,
          right: 1,
          width: 22,
          height: 22,
          objectFit: "contain",
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          pointerEvents: "none",
        }}
      />
      {/* Fold flap · top-left triangle · gradient + drop shadow give paper depth */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
          background: "linear-gradient(135deg, rgba(30,30,30,0.98) 0%, rgba(8,8,8,0.98) 100%)",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
        }}
      />
      {/* Diagonal fold-line highlight · a subtle warm streak where the paper creases */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 48,
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.55) 50%, transparent 100%)",
          transform: "translate(-50%, -50%) rotate(-45deg)",
          filter: "blur(0.5px)",
          pointerEvents: "none",
        }}
      />
    </button>
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
    // Cyber Aurora · typing dots signal LIVE/ACTIVE (NEX is thinking) so
    // they use the electric-cyan accent, not the brand orange.
    background: NEX.cyan,
    display: "inline-block",
    animation: `nex-dot 1.2s ${delayMs}ms infinite ease-in-out`,
    opacity: 0.85,
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
  nexState,
  onMicClick,
  onMicPointerDown,
  onMicPointerUp,
  onMicPointerCancel,
}: {
  isOpen: boolean;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  nexState?: NexState;
  onMicClick?: () => void;
  onMicPointerDown?: (e: React.PointerEvent) => void;
  onMicPointerUp?: (e: React.PointerEvent) => void;
  onMicPointerCancel?: (e: React.PointerEvent) => void;
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
          // 2026-08-25 · Philip · composer sits BETWEEN the bottom-left
          // (Explore) and bottom-right (Contacts) corner buttons. Corners
          // are 46 px wide sitting on the chat frame (marginLeft 26 · offset
          // -8), so their outer edges land ~64 px from screen edges. Composer
          // starts ~72 px in on each side to clear them with breathing room.
          left: 72,
          right: 72,
          zIndex: 21,
          pointerEvents: isOpen ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
        data-comms-dock-open={isOpen ? "true" : undefined}
      >
        {/* Mic · Philip Variant C 2026-08-25 · voice orb replaced by this
            in-composer button. Tap = trigger voice · reuses the same orb
            click/pointer handlers so the entire voice pipeline is preserved.
            Colour reflects nexState so listening/thinking/speaking are
            visible even without the standalone orb. */}
        <button
          type="button"
          aria-label={nexState === "listening" ? "Listening" : nexState === "thinking" ? "Thinking" : nexState === "speaking" ? "Speaking" : "Ask NEX by voice"}
          onClick={onMicClick}
          onPointerDown={onMicPointerDown}
          onPointerUp={onMicPointerUp}
          onPointerCancel={onMicPointerCancel}
          onPointerLeave={onMicPointerCancel}
          style={{
            ...attachBtnStyle,
            background:
              nexState === "listening" ? "rgba(249,115,22,0.28)" :
              nexState === "thinking"  ? "rgba(168,85,247,0.28)" :
              nexState === "speaking"  ? "rgba(34,211,238,0.28)"  :
              "rgba(249,115,22,0.12)",
            border: `1px solid ${
              nexState === "listening" ? NEX.orange :
              nexState === "thinking"  ? NEX.violet :
              nexState === "speaking"  ? NEX.cyan    :
              "rgba(249,115,22,0.35)"
            }`,
            boxShadow:
              nexState === "listening" ? `0 0 12px ${NEX.orangeGlow}` :
              nexState === "thinking"  ? `0 0 12px ${NEX.violetGlow}` :
              nexState === "speaking"  ? `0 0 12px ${NEX.cyanGlow}`   :
              "none",
            transition: "background 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={NEX.orange} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8"  y1="23" x2="16" y2="23" />
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

const headerStyle: React.CSSProperties = {
  position: "relative",
  // 2026-08-24 · Philip · GUARANTEE clearance for iPhone Dynamic Island /
  // notch / earpiece / front-camera cutout so the hero logo is never cut.
  // `calc(env(safe-area-inset-top) + 12px)` ADDS a fixed 12 px on top of
  // whatever safe-area the device reports · desktop (safe-area=0) → 12 px
  // breathing room · iPhone (safe-area=44 px+) → 56 px total clearance
  // above the Dynamic Island. Never use `max(...)` alone here — that only
  // sets a MINIMUM and can still leave the logo touching the cutout on
  // devices that report a smaller-than-hardware safe-area.
  paddingTop: "calc(env(safe-area-inset-top) + 12px)",
  paddingBottom: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  zIndex: 2,
};

// Hero banner asset · single image (NEX chrome wordmark + AskNex.app plate).
// 2026-08-21 −25% · 2026-08-23 −20% (vertical space discipline) · 2026-08-24
// PM +20% back per Philip · new logo is a tighter 2.61:1 aspect (was 3:1) so
// enlarging keeps it recognisable without eating the conversation frame.
const heroImageStyle: React.CSSProperties = {
  display: "block",
  width: "min(50%, 175px)",
  height: "auto",
  maxHeight: 65,
  objectFit: "contain",
  filter: `drop-shadow(0 4px 18px ${NEX.orangeGlowLo})`,
};

// Greeting styles restored 2026-08-25 · Philip · reference model calls the
// greeting back. Silver "AskNex Or Chat With Friends" over orange "Hi Boss,"
const greetingWrapStyle: React.CSSProperties = {
  padding: "0 22px 4px",
  marginTop: -4,
  zIndex: 2,
  position: "relative",
};
const helloStyle: React.CSSProperties = {
  color: NEX.orange,
  fontSize: 15,
  fontWeight: 500,
  marginBottom: 2,
  letterSpacing: -0.1,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const askStyle: React.CSSProperties = {
  color: "transparent",
  background: "linear-gradient(180deg, #F5F5F5 0%, #D8D8D8 22%, #8E8E8E 50%, #C6C6C6 78%, #ECECEC 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35))",
  fontSize: 19,
  fontWeight: 700,
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
  // 2026-08-25 · Philip Variant B + extend · greeting removed (~60px), top
  // margin trimmed 12 → 4, bottom clearance trimmed navHeight+6 → navHeight−10
  // so the chat frame extends further toward the nav pill (composer + orb
  // still clear the frame · they sit at bottom: -14 relative to the frame).
  marginTop: 4,
  // Lateral margin 26 · corner buttons keep ~3 px screen-edge breathing room.
  marginLeft: 26,
  marginRight: 26,
  marginBottom: NEX.navHeight - 10,
  // Slightly tighter internal padding · was 18/12/34 · now 12/12/28.
  padding: "12px 12px 28px",
  // 2026-08-25 · Philip · reference model applied · chat frame is now an
  // INVISIBLE shell · no border · no fill · no halo. Bubbles float directly
  // on the page's world-map + orange radar background (frosted-glass
  // material inside each bubble handles legibility). Corners still anchor
  // to this shell so their layout math is unchanged.
  background: "transparent",
  border: "none",
  borderRadius: 24,
  boxShadow: "none",
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  zIndex: 2,
};

// secondBgStyle removed 2026-08-25 · Philip · single-background policy.

// 3D flip container · the chat interior lives here. Front face = message
// list, back face = NEX emoji tray. Perspective on parent + backface hidden
// on children so only the face pointing at the camera is visible during the
// half-second flip.
const flipContainerStyle: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  perspective: 1400,
  transformStyle: "preserve-3d",
};

const flipFaceStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  transformStyle: "preserve-3d",
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
// Voice orb centered above the composer · sits between the two bottom
// corner buttons · translate(-50%) centres horizontally · restored
// 2026-08-25 · Philip · reference model.
const centeredOrbStyle: React.CSSProperties = {
  position: "absolute",
  left: "50%",
  bottom: -22,
  transform: "translateX(-50%)",
  zIndex: 3,
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

