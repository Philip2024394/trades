// src/app/nex-native/themes/[id]/_joker-motion-data.ts
//
// Animation gallery · shared data + types.
// --------------------------------------------------------
// Originally named for the Joker theme but now the universal data
// source for the Animation gallery reached from the + menu of every
// world. Pure data + a type guard · lives in its own module (no
// "use client") so Server Components (motion/page.tsx) and Client
// Components (_motion-client.tsx, _joker-motion.tsx) can import
// without crossing the server/client boundary.
//
// Copy sealed 2026-10-06 (Animation Gallery UX pass) · user-facing
// strings written in experiential language · never developer tone.
// Guards in `_motion-client.test.ts` enforce this across future
// edits.

export type JokerMotionVariant =
  | "rain"
  | "sparks"
  | "bat"
  | "cards"
  | "lightning"
  | "bubbles"
  | "confetti"
  | "smoke"
  | "embers"
  | "glitch";

/** User-facing labels + short experiential descriptions used by the
 *  Animation gallery. The `isNew` flag surfaces a subtle NEW badge
 *  on recently-added animations so users understand the gallery
 *  keeps growing · the badge rendering is theme-aware and the flag
 *  is data-driven (never hard-coded in the page layout). */
export const JOKER_MOTION_INDEX: {
  variant: JokerMotionVariant;
  label: string;
  description: string;
  /** Mark newly-added animations · surfaces a NEW badge on the
   *  card. Keep this list short (1–2 at a time) so NEW stays
   *  meaningful. */
  isNew?: boolean;
}[] = [
  {
    variant: "rain",
    label: "Rainfall",
    description:
      "A soft rain effect that gives your chat a calm, atmospheric feel.",
  },
  {
    variant: "sparks",
    label: "Welding Sparks",
    description:
      "Bright sparks burst across the scene for an industrial, bold mood.",
  },
  {
    variant: "bat",
    label: "Flying Bat",
    description:
      "A bat sweeps across your chat for a darker, dramatic touch.",
  },
  {
    variant: "cards",
    label: "Falling Cards",
    description: "Playful cards tumble through your world.",
  },
  {
    variant: "lightning",
    label: "Lightning",
    description:
      "Occasional flashes light your chat for a high-stakes mood.",
  },
  {
    variant: "bubbles",
    label: "Rising Bubbles",
    description:
      "Soft bubbles rise through your chat for a dreamy, buoyant feel.",
  },
  {
    variant: "confetti",
    label: "Confetti",
    description:
      "Festive confetti fills your chat for a celebratory moment.",
  },
  {
    variant: "smoke",
    label: "Smoke Wisps",
    description:
      "Gentle smoke drifts across for a mysterious, cinematic air.",
  },
  {
    variant: "embers",
    label: "Rising Embers",
    description: "Warm embers rise and flicker through your world.",
    isNew: true,
  },
  {
    variant: "glitch",
    label: "Glitch",
    description: "A subtle digital shimmer for a modern, edgy feel.",
    isNew: true,
  },
];

/** Server + client safe parser · validates the `?motion=<variant>`
 *  query-string value against the sealed set. */
export function parseJokerMotion(value: unknown): JokerMotionVariant | null {
  const s = String(value ?? "").toLowerCase();
  const all = JOKER_MOTION_INDEX.map((r) => r.variant);
  return (all as string[]).includes(s) ? (s as JokerMotionVariant) : null;
}
