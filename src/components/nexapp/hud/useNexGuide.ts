// useNexGuide · unified NEX guidance intent API.
//
// Doctrine (Philip 2026-08-26): NEX should never fire the beam just because
// a button exists. Speech · pupil · beam are ONE coordinated performance ·
// intent-driven, not scattered fireBeam() calls.
//
// Usage:
//   const guide = useNexGuide({ setEyeLook, setBubble, fireBeam });
//   guide({ target: "discovery", intent: "introduce" });
//   guide({ target: "voice-button", intent: "redirect", phraseId: "eye_intro_002" });
//
// The hook owns a serial queue · one guide at a time · finishes before the
// next begins. Each guide is a timeline:
//   t=0     · pupil begins moving toward target
//   t=380   · pupil settled · beam fires
//   t=380+  · target pulse
//   t=~1300 · beam fades
//   t=~1550 · pupil returns to centre naturally
//   t=~1800 · queue advances to next guide

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGuidance, type GuidanceTargetId } from "./NexGuidance";
import type { OrbLookDirection } from "../NexVoiceOrb";
import { pickPhrase } from "./pickPhrase";
import {
  TARGET_TO_BEAM,
  type NexIntent,
  type NexTarget,
} from "./nexPersonality";
import { PHRASE_LIBRARY } from "./phraseLibrary";

export interface GuideOptions {
  /** UI element or concept NEX is talking about. */
  target: NexTarget;
  /** What NEX is trying to do with this utterance. */
  intent?: NexIntent;
  /** Force a specific phrase id (skip the picker). */
  phraseId?: string;
  /** Override pupil look direction. Default = phrase's look. */
  look?: OrbLookDirection;
  /** Skip the beam even if the phrase requires it. */
  suppressBeam?: boolean;
  /**
   * Probability (0-1) that this guide is silent · just the animation, no
   * speech, no beam. Philip 2026-08-27: high-frequency UI events like
   * drawer opens shouldn't produce voice EVERY time. Default 0 (always speak).
   * Recommended for drawers: 0.35 (~1 in 3 activations is silent).
   */
  silenceProbability?: number;
}

interface GuideDeps {
  setEyeLook: (dir: OrbLookDirection | null) => void;
  setBubble:  (bubble: { text: string; dwellMs?: number } | null) => void;
}

// Timing (matches the beam's own default: 380ms arm · 900ms dwell · 250ms fade).
const PUPIL_SETTLE_MS   = 380;   // pupil moves to target
const BEAM_DWELL_MS     = 900;   // beam visible + target pulse
const BEAM_FADE_MS      = 250;   // beam fades
const PUPIL_RETURN_MS   = 300;   // gap before pupil returns to centre
const GUIDE_TOTAL_MS    = PUPIL_SETTLE_MS + BEAM_DWELL_MS + BEAM_FADE_MS + PUPIL_RETURN_MS;

export function useNexGuide(deps: GuideDeps) {
  const guidance = useGuidance();
  const queueRef = useRef<GuideOptions[]>([]);
  const runningRef = useRef<boolean>(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) { runningRef.current = false; return; }
    runningRef.current = true;

    // Silence roll · high-frequency events (drawer opens, etc.) should not
    // produce voice EVERY time. Philip 2026-08-27: "sometimes no voice — just
    // the animation." Roll before phrase pick so we don't consume memory.
    if (next.silenceProbability && next.silenceProbability > 0 && Math.random() < next.silenceProbability) {
      runNext();
      return;
    }

    // Resolve phrase (picker · dedupe · memory · tone mix).
    const phrase = next.phraseId
      ? PHRASE_LIBRARY.find((p) => p.id === next.phraseId) ?? null
      : pickPhrase(next.target, { intent: next.intent ?? "introduce" });

    if (!phrase) {
      // Nothing to say · skip this guide immediately.
      runNext();
      return;
    }

    // Timeline:
    // t=0             · pupil moves + bubble appears (bubble stays through beam)
    deps.setBubble({ text: phrase.text, dwellMs: phrase.dwellMs ?? (BEAM_DWELL_MS + PUPIL_SETTLE_MS + 800) });
    const lookDir = (next.look ?? phrase.look ?? "center") as OrbLookDirection;
    deps.setEyeLook(lookDir);

    // t=PUPIL_SETTLE_MS · beam fires (if the phrase asks for it).
    const beamTarget: GuidanceTargetId | undefined =
      next.suppressBeam ? undefined :
      phrase.beamTarget ?? (phrase.requiresBeam ? TARGET_TO_BEAM[phrase.target] : undefined);

    if (beamTarget) {
      const t1 = setTimeout(() => {
        guidance.fireBeam(beamTarget, { fireDelayMs: 0, dwellMs: BEAM_DWELL_MS });
      }, PUPIL_SETTLE_MS);
      timersRef.current.push(t1);
    }

    // t=PUPIL_SETTLE_MS + BEAM_DWELL_MS + BEAM_FADE_MS · release pupil.
    const t2 = setTimeout(() => {
      deps.setEyeLook(null);
    }, PUPIL_SETTLE_MS + BEAM_DWELL_MS + BEAM_FADE_MS);
    timersRef.current.push(t2);

    // t=GUIDE_TOTAL_MS · advance queue.
    const t3 = setTimeout(() => {
      runNext();
    }, GUIDE_TOTAL_MS);
    timersRef.current.push(t3);
  }, [deps, guidance]);

  const guide = useCallback((opts: GuideOptions) => {
    queueRef.current.push(opts);
    if (!runningRef.current) runNext();
  }, [runNext]);

  // Cancel any in-flight timers on unmount so we don't call setState after.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  return guide;
}
