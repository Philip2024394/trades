// src/app/nex-native/themes/[id]/_joker-motion-data.ts
//
// Joker motion · shared data + types · sealed 2026-10-01.
// --------------------------------------------------------
// Pure data + a type guard · lives in its own module (no "use client")
// so both Server Components (page.tsx, motion/page.tsx) and Client
// Components (_viewer.tsx, _joker-motion.tsx) can import without
// crossing the server/client boundary. The animated React components
// still live in _joker-motion.tsx behind "use client".

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

/** Founder-facing labels + short descriptions. Used by the gallery
 *  index page so the founder can pick without opening every URL. */
export const JOKER_MOTION_INDEX: {
  variant: JokerMotionVariant;
  label: string;
  description: string;
}[] = [
  {
    variant: "rain",
    label: "Rain",
    description:
      "Vertical translucent streaks fall the length of the screen · toxic green tint · reads calm/moody.",
  },
  {
    variant: "sparks",
    label: "Welding Sparks",
    description:
      "Orange sparks emit from behind the header and fall with gravity · brief flash on release · reads industrial/dangerous.",
  },
  {
    variant: "bat",
    label: "Flying Bat",
    description:
      "A single silhouette bat swoops across the screen on a loop · uneven arc + wing flap · reads gothic/theatrical.",
  },
  {
    variant: "cards",
    label: "Falling Cards",
    description:
      "Miniature joker cards tumble down with rotation · reads playful/mischievous.",
  },
  {
    variant: "lightning",
    label: "Lightning",
    description:
      "Full-screen flash every 6-9s + jagged bolt visible for ~180ms · reads dramatic/high-stakes.",
  },
  {
    variant: "bubbles",
    label: "Toxic Bubbles",
    description:
      "Green bubbles rise from below the composer + pop near the top · reads poison/potion.",
  },
  {
    variant: "confetti",
    label: "Confetti Chaos",
    description:
      "Coloured rectangles drift down + spin · reads Joker's theatricality/riot.",
  },
  {
    variant: "smoke",
    label: "Smoke Wisps",
    description:
      "Dark radial-gradient blobs drift sideways across the screen · reads mysterious/covert.",
  },
  {
    variant: "embers",
    label: "Rising Embers",
    description:
      "Small glowing dots rise from below the composer + flicker · reads smouldering/warm.",
  },
  {
    variant: "glitch",
    label: "CRT Glitch",
    description:
      "Scanline sweep every 5-8s + brief RGB shift on the chat surface · reads digital/broken-mirror.",
  },
];

/** Server + client safe parser · validates the `?motion=<variant>`
 *  query-string value against the sealed set. */
export function parseJokerMotion(value: unknown): JokerMotionVariant | null {
  const s = String(value ?? "").toLowerCase();
  const all = JOKER_MOTION_INDEX.map((r) => r.variant);
  return (all as string[]).includes(s) ? (s as JokerMotionVariant) : null;
}
