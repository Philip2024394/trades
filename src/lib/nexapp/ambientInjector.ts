// src/lib/nexapp/ambientInjector.ts
//
// NEX Ambient Knowledge Injector · Phase 1 · Philip 2026-08-28.
//
// Silence-only triggering. Fires when the conversation has genuinely stalled
// AND user might appreciate NEX filling the pause. Never spam. Never counter-
// based. See project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md.
//
// Contract:
//   useAmbientInjector({ messages, onInject, isTyping, isVoiceReplying, disabled })
//   → returns { pool: AmbientItem[], stats }
//
// The hook:
//   · Fetches the pool once on mount (/api/nex/ambient-knowledge)
//   · Watches messages array to compute "last activity" timestamp
//   · Every 5s checks trigger conditions; if all pass, picks best-matched
//     unused entry and calls onInject with variant + item
//   · Tracks session state (shown IDs, injection count, last injection time)

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AmbientVariant = "did_you_know" | "they_say";

export type AmbientItem = {
  id: string;
  title: string;
  body: string;
  source: string;
  truthClass:
    | "confirmed_fact"
    | "academic_reference"
    | "traditional_folk"
    | "spiritual_belief"
    | "unconfirmed"
    | "ai_generated";
  topicKey?: string | null;
  /** Which variant this item belongs to (derived from truthClass at fetch). */
  variant: AmbientVariant;
};

export interface UseAmbientInjectorArgs {
  /** All chat messages · watched for timestamps + topic extraction. */
  messages: Array<{ id: string; sender: "user" | "nex"; text: string }>;
  /** Fires when the injector decides to inject a card. */
  onInject: (item: AmbientItem) => void;
  /** True while the composer has content or user is actively typing. */
  isTyping?: boolean;
  /** True while NEX is speaking a voice reply (never inject during). */
  isVoiceReplying?: boolean;
  /** Allows external kill switch. */
  disabled?: boolean;
}

// ── Timing constants (constitutional · project_nex_ambient_...) ─────────
const SILENCE_MS_TO_TRIGGER = 90_000;      // 90s of no activity
const KEYSTROKE_QUIET_MS    = 30_000;      // 30s since last keystroke
const SESSION_START_GRACE_MS = 60_000;     // 60s at session start · no fire
const INJECTION_COOLDOWN_MS  = 5 * 60_000; // 5 min between injections
const DISMISS_PENALTY_MS     = 10 * 60_000; // +10 min after dismissal
const MAX_INJECTIONS_PER_SESSION = 3;
const CHECK_INTERVAL_MS = 5_000;           // scheduler tick

export function useAmbientInjector({
  messages,
  onInject,
  isTyping = false,
  isVoiceReplying = false,
  disabled = false,
}: UseAmbientInjectorArgs) {
  const [pool, setPool] = useState<AmbientItem[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const injectionCountRef = useRef(0);
  const lastInjectionAtRef = useRef(0);
  const dismissedPenaltyUntilRef = useRef(0);
  const lastKeystrokeAtRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const lastVariantRef = useRef<AmbientVariant | null>(null);
  // Philip 2026-08-29 · after ONE injection, freeze the injector until the
  // user posts a new chat message. Prevents multiple DYK cards stacking
  // without the user replying · doctrine: "the user must post chat and
  // continue or chat becomes freeze".
  const awaitingUserReplyRef = useRef(false);
  const lastUserMessageCountRef = useRef(0);

  // Track keystrokes globally · augments the isTyping prop.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = () => { lastKeystrokeAtRef.current = Date.now(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch pool once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/nex/ambient-knowledge?limit=60")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.ok || !Array.isArray(data.pool)) return;
        const withVariant: AmbientItem[] = data.pool.map((p: Omit<AmbientItem, "variant">) => ({
          ...p,
          variant: variantFromTruthClass(p.truthClass),
        }));
        setPool(withVariant);
      })
      .catch(() => { /* silent · injector simply won't fire */ });
    return () => { cancelled = true; };
  }, []);

  const lastActivityAt = useMemo(() => {
    if (messages.length === 0) return sessionStartRef.current;
    return Date.now();
  }, [messages.length]);

  // Reset activity timestamp whenever messages change.
  const lastActivityRef = useRef(lastActivityAt);
  useEffect(() => {
    lastActivityRef.current = Date.now();

    // Philip 2026-08-29 · unfreeze the injector when a NEW user message
    // arrives (compare count to previous snapshot). Injector re-arms so
    // the next silence window can post another DYK card.
    const userMessageCount = messages.filter((m) => m.sender === "user").length;
    if (userMessageCount > lastUserMessageCountRef.current) {
      awaitingUserReplyRef.current = false;
    }
    lastUserMessageCountRef.current = userMessageCount;
  }, [messages]);

  // Scheduler tick.
  const trigger = useCallback(() => {
    if (disabled) return;
    if (pool.length === 0) return;
    if (isTyping || isVoiceReplying) return;

    const now = Date.now();
    if (now - sessionStartRef.current < SESSION_START_GRACE_MS) return;
    if (now - lastActivityRef.current < SILENCE_MS_TO_TRIGGER) return;
    if (now - lastKeystrokeAtRef.current < KEYSTROKE_QUIET_MS) return;
    if (now < dismissedPenaltyUntilRef.current) return;
    if (injectionCountRef.current >= MAX_INJECTIONS_PER_SESSION) return;
    if (now - lastInjectionAtRef.current < INJECTION_COOLDOWN_MS) return;
    // Philip 2026-08-29 · after 1 card injected · block until user posts
    // a new message. Prevents card stacking · doctrine: "the user must
    // post chat and continue or chat becomes freeze".
    if (awaitingUserReplyRef.current) return;

    // Pick best-matched unused entry · prefer alternate variant · topic match.
    const preferredVariant: AmbientVariant | null =
      lastVariantRef.current === "did_you_know" ? "they_say"
      : lastVariantRef.current === "they_say"   ? "did_you_know"
      : null;

    const recentText = messages.slice(-6).map((m) => m.text.toLowerCase()).join(" ");
    const scored = pool
      .filter((p) => !shownIdsRef.current.has(p.id))
      .map((p) => {
        const topicMatch = p.topicKey && recentText.includes(p.topicKey.replace(/^[^-]+-/, "").replace(/-/g, " "))
          ? 5 : 0;
        const titleMatch = recentText.includes(p.title.toLowerCase().split(/\s+/)[0]) ? 3 : 0;
        const variantPref = preferredVariant && p.variant === preferredVariant ? 2 : 0;
        return { p, score: topicMatch + titleMatch + variantPref + Math.random() };
      })
      .sort((a, b) => b.score - a.score);

    const pick = scored[0]?.p;
    if (!pick) return;

    shownIdsRef.current.add(pick.id);
    injectionCountRef.current += 1;
    lastInjectionAtRef.current = now;
    lastVariantRef.current = pick.variant;
    // Freeze until the user replies · Philip 2026-08-29
    awaitingUserReplyRef.current = true;
    onInject(pick);
  }, [pool, disabled, isTyping, isVoiceReplying, messages, onInject]);

  useEffect(() => {
    if (disabled) return;
    const t = setInterval(trigger, CHECK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [trigger, disabled]);

  const notifyDismissed = useCallback(() => {
    dismissedPenaltyUntilRef.current = Date.now() + DISMISS_PENALTY_MS;
  }, []);

  return {
    pool,
    notifyDismissed,
    stats: {
      poolSize: pool.length,
      shown: shownIdsRef.current.size,
      injections: injectionCountRef.current,
      cap: MAX_INJECTIONS_PER_SESSION,
    },
  };
}

function variantFromTruthClass(t: AmbientItem["truthClass"]): AmbientVariant {
  if (t === "confirmed_fact" || t === "academic_reference") return "did_you_know";
  return "they_say";
}
