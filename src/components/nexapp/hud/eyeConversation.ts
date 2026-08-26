// NEX EYE CONVERSATION · state machine + phrase library.
//
// Doctrine (Philip 2026-08-26):
//   · Eye is CHARACTER · not the mic button
//   · Users may tap the eye expecting voice → NEX responds as a character,
//     points the pupil toward the actual voice button, teaches by gesture
//   · Escalation ladder · avoids repetition · cooldown resets
//   · Not a random-phrase rotator · behavior-group aware
//
// Response groups:
//   L0 helpful_first   · warm, welcoming, offers direction
//   L1 helpful_repeat  · different phrasing, still helpful
//   L2 playful         · adds humour, still helpful
//   L3 firm            · direct, still polite
//   L4 quiet_notice    · announces temporary quiet
//   L5 silent          · returns null (no bubble · pure quiet)
//
// After a cooldown period the level relaxes back toward 0 gradually.
// A successful voice-button press hard-resets to 0 (user has learned).

import type { OrbLookDirection } from "../NexVoiceOrb";
import { pickPhrase } from "./pickPhrase";
import type { NexIntent } from "./nexPersonality";

export type EyeConversationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface EyeConversationPhrase {
  id: string;
  text: string;
  /** Where the pupil should look while this phrase is displayed. */
  look?: OrbLookDirection;
  /** Milliseconds the bubble stays visible before fading. */
  dwellMs?: number;
}

// ── PHRASE BANK ────────────────────────────────────────────────────────────
// Grouped by escalation level. Each phrase carries an id (dedupe key), text,
// and optional look direction. Default look is "down" toward the composer.

export const PHRASES_L0_HELPFUL_FIRST: EyeConversationPhrase[] = [
  { id: "L0-1",  text: "I'd love to hear you. The voice button is down here.",  look: "down"      },
  { id: "L0-2",  text: "Tap the orange wave below to talk to me.",              look: "down"      },
  { id: "L0-3",  text: "My ears are down at the bottom. Try the mic there.",    look: "down"      },
  { id: "L0-4",  text: "Speak to me through the voice button below.",           look: "down"      },
  { id: "L0-5",  text: "Press and hold the microphone at the bottom to talk.",  look: "down"      },
  { id: "L0-6",  text: "The little wave down there — that's how you reach me.", look: "down"      },
  { id: "L0-7",  text: "Ready when you are. Use the voice button below.",       look: "down"      },
  { id: "L0-8",  text: "I can hear through the mic at the bottom of the screen.", look: "down"    },
  { id: "L0-9",  text: "Tap the orange voice icon — I'll be listening.",        look: "down"      },
  { id: "L0-10", text: "Down here 👇 the wave button opens my ears.",           look: "down"      },
];

export const PHRASES_L1_HELPFUL_REPEAT: EyeConversationPhrase[] = [
  { id: "L1-1",  text: "Yes — still the button at the bottom, not my eye.",             look: "down" },
  { id: "L1-2",  text: "I'm here, but I hear you through the mic below.",               look: "down" },
  { id: "L1-3",  text: "Give the orange voice button a tap and I'll listen.",            look: "down" },
  { id: "L1-4",  text: "The eye watches. The mic below listens. Try the mic.",           look: "down" },
  { id: "L1-5",  text: "Try the wave icon at the bottom — that's my microphone.",        look: "down" },
  { id: "L1-6",  text: "Tap the mic down there whenever you're ready.",                  look: "down" },
  { id: "L1-7",  text: "The bottom button is how you talk to me.",                       look: "down" },
  { id: "L1-8",  text: "One more tap — but on the voice button below this time.",        look: "down" },
];

export const PHRASES_L2_PLAYFUL: EyeConversationPhrase[] = [
  { id: "L2-1", text: "You found my eye! But my ears are down at the bottom.",           look: "down" },
  { id: "L2-2", text: "I see you tapping 😄 — the voice button is where I hear.",       look: "down" },
  { id: "L2-3", text: "Nice try! Give the mic below a tap instead.",                     look: "down" },
  { id: "L2-4", text: "The eye is decorative — the bottom mic is functional 😉",         look: "down" },
  { id: "L2-5", text: "I like the attention, but the mic is down there.",                look: "down" },
  { id: "L2-6", text: "Every eye tap makes me smile — but the mic is below.",            look: "down" },
];

export const PHRASES_L3_FIRM: EyeConversationPhrase[] = [
  { id: "L3-1", text: "The voice button is at the bottom. I'll wait for you there.",          look: "down" },
  { id: "L3-2", text: "I really can't hear through my eye. Use the mic below.",               look: "down" },
  { id: "L3-3", text: "Please try the voice button — I'm here whenever you're ready.",        look: "down" },
  { id: "L3-4", text: "If you'd like to talk, the bottom voice button is the only way in.",  look: "down" },
];

export const PHRASES_L4_QUIET_NOTICE: EyeConversationPhrase[] = [
  { id: "L4-1", text: "I'll rest for a moment. Tap the voice button when you'd like to talk.", look: "down", dwellMs: 4000 },
  { id: "L4-2", text: "Going quiet for a bit. The mic below still works whenever you need me.", look: "down", dwellMs: 4000 },
];

export interface EyeConversationState {
  tapCount: number;                    // total taps this session
  recentTaps: number[];                // ms timestamps of recent taps (last 60s window)
  level: EyeConversationLevel;         // current escalation level
  lastPhraseIds: string[];             // last few phrase ids used (dedupe)
  voiceButtonUsed: boolean;            // has the user pressed the mic at least once
  silentUntil: number | null;          // ms epoch · null when not silent
}

export function initialState(): EyeConversationState {
  return {
    tapCount:        0,
    recentTaps:      [],
    level:           0,
    lastPhraseIds:   [],
    voiceButtonUsed: false,
    silentUntil:     null,
  };
}

// Tune these to change the escalation feel.
const RAPID_WINDOW_MS       = 4000;   // taps within this window count as "rapid"
const RAPID_TAP_LEVEL_UP    = 3;      // this many rapid taps → escalate
const SILENT_DURATION_MS    = 20_000; // how long L5 silence lasts
const RELAX_AFTER_MS        = 30_000; // no taps for this long → level -1
const HARD_RESET_AFTER_MS   = 5 * 60_000; // 5min silent → back to L0

// Legacy local pickPhrase + bankForLevel · retained for backwards compat
// with any test that still imports these. The real selection now runs
// through pickPhrase from ./pickPhrase which reads the master library.
function bankForLevel(level: EyeConversationLevel): EyeConversationPhrase[] {
  switch (level) {
    case 0: return PHRASES_L0_HELPFUL_FIRST;
    case 1: return PHRASES_L1_HELPFUL_REPEAT;
    case 2: return PHRASES_L2_PLAYFUL;
    case 3: return PHRASES_L3_FIRM;
    case 4: return PHRASES_L4_QUIET_NOTICE;
    case 5: return [];
  }
}
void bankForLevel; // preserve export shape · suppress unused warning

export interface EyeTapResult {
  state:  EyeConversationState;
  /** Phrase to display, or null when NEX is deliberately silent. */
  phrase: EyeConversationPhrase | null;
}

// Escalation-level → intent used by the personality picker.
function intentForLevel(level: EyeConversationLevel): NexIntent {
  switch (level) {
    case 0: return "introduce";
    case 1: return "explain";
    case 2: return "playful";
    case 3: return "firm";
    case 4: return "quiet-notice";
    case 5: return "quiet-notice"; // shouldn't reach here (returns null)
  }
}

/** Advance the state machine in response to an eye tap. */
export function onEyeTap(prev: EyeConversationState, now: number = Date.now()): EyeTapResult {
  // Silent window active · stay silent · don't escalate.
  if (prev.silentUntil && now < prev.silentUntil) {
    return {
      state: { ...prev, tapCount: prev.tapCount + 1, recentTaps: [...prev.recentTaps, now].slice(-10) },
      phrase: null,
    };
  }

  // Silence just expired · deterministic post-silence reset to L1
  // (Philip 2026-08-26: prevent hammer-wait-hammer cycle).
  const clearedSilent: EyeConversationState = prev.silentUntil && now >= prev.silentUntil
    ? { ...prev, silentUntil: null, level: 1 }
    : prev;

  const recentTaps = [...clearedSilent.recentTaps, now].filter((t) => now - t <= RAPID_WINDOW_MS);
  const isRapid    = recentTaps.length >= RAPID_TAP_LEVEL_UP;

  // Escalate: +1 per tap · +2 if rapid.
  const level: EyeConversationLevel = Math.min(5, clearedSilent.level + (isRapid ? 2 : 1)) as EyeConversationLevel;

  const silentUntil  = level === 5 ? now + SILENT_DURATION_MS : clearedSilent.silentUntil;
  const displayLevel = level === 5 ? 4 : level;

  // Route through the personality picker · returns a metadata-rich phrase.
  const richPhrase = pickPhrase("eye-tap", { intent: intentForLevel(displayLevel as EyeConversationLevel) });
  // Adapt to the local phrase shape (keeps existing consumers stable).
  const phrase: EyeConversationPhrase | null = richPhrase ? {
    id:      richPhrase.id,
    text:    richPhrase.text,
    look:    richPhrase.look,
    dwellMs: richPhrase.dwellMs,
  } : null;

  const lastPhraseIds = phrase
    ? [...clearedSilent.lastPhraseIds, phrase.id].slice(-6)
    : clearedSilent.lastPhraseIds;

  return {
    state: {
      tapCount:        clearedSilent.tapCount + 1,
      recentTaps,
      level,
      lastPhraseIds,
      voiceButtonUsed: clearedSilent.voiceButtonUsed,
      silentUntil,
    },
    phrase,
  };
}

/** User successfully used the voice button · hard-reset escalation. */
export function onVoiceButtonUsed(prev: EyeConversationState): EyeConversationState {
  return {
    ...prev,
    level:           0,
    recentTaps:      [],
    silentUntil:     null,
    voiceButtonUsed: true,
  };
}

/** Time-based relaxation · call periodically or on next tap. */
export function relax(prev: EyeConversationState, now: number = Date.now()): EyeConversationState {
  const lastTapAt = prev.recentTaps[prev.recentTaps.length - 1] ?? 0;
  const idle      = now - lastTapAt;
  if (idle >= HARD_RESET_AFTER_MS) return { ...prev, level: 0, recentTaps: [], silentUntil: null };
  if (idle >= RELAX_AFTER_MS && prev.level > 0) {
    return { ...prev, level: Math.max(0, prev.level - 1) as EyeConversationLevel };
  }
  return prev;
}
