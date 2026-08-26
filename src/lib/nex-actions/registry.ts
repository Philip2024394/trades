// NEX Actions · declarative catalog · F1 (2026-08-25).
//
// This file is the SINGLE SOURCE OF TRUTH for what mascots exist in NEX.
// Every mascot is one row. Rows are declarative — no functions, no handlers,
// no imports from wallet/, runtime/, or handlers/.
//
// PR REVIEW RULE (Philip 2026-08-25 · locked):
//   · A PR that adds an `import` from `./handlers/` or `./runtime/` or
//     `./wallet/` into this file MUST be rejected.
//   · A PR that adds a function to a NexAction row (`gate: () =>`,
//     `handler: () =>`) MUST be rejected.
//   · A PR that hard-codes currency amounts (GBP · IDR) MUST be rejected —
//     Sparks are the only economic unit visible here.
//
// This keeps the registry a compile-time-safe catalog forever. Growth is
// linear: adding a mascot = adding a row + implementing its handlerKey.

import type { NexAction } from "./types";

// Placeholder image URL used until Philip's 70-mascot upload arrives. The
// registry entry stays committed with this URL and the mascot expression;
// swapping in the real URL is a one-line change per mascot when they ship.
const TBD = "https://ik.imagekit.io/7grri5v7d/mascot-placeholder.png";

export const NEX_ACTIONS: readonly NexAction[] = [
  // ═══════════════════════════════════════════════════════════════════
  // TIER 1 · REACTIONS · 10 mascots for launch
  // Client-fast · aggregated per bubble · one per user per message.
  // All share handlerKey "toggle-reaction" (differentiated by action.id).
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "nex-laugh",
    tier: "reaction",
    section: "react",
    // Upgraded 2026-08-25 to the tears-of-laughter mascot · brand-consistent
    // (N logo hoodie · matches the event series).
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwweweweweedfdf-removebg-preview.png",
      label: "Laughing",
      expression: "laugh",
    },
    handlerKey: "toggle-reaction",
    animation: "sparkle",
    audit: "normal",
  },
  {
    id: "nex-approve",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfd-removebg-preview.png",
      label: "Thumbs Up",
      expression: "approve",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  // Boss reaction upgraded 2026-08-25 to the king-on-throne mascot ·
  // more cinematic than the arms-crossed hoodie.
  {
    id: "nex-boss",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsdsddd-removebg-preview.png?updatedAt=1787602212211",
      label: "Boss",
      expression: "boss",
    },
    handlerKey: "toggle-reaction",
    animation: "flip",
    audit: "normal",
  },
  // ── 7 additional Tier-1 reactions · wired 2026-08-25 (Philip approved) ─
  {
    id: "nex-love",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsd-removebg-preview.png?updatedAt=1787603348003",
      label: "Love",
      expression: "romantic",
    },
    handlerKey: "toggle-reaction",
    animation: "glow",
    fullScreen: "hearts",
    audit: "normal",
  },
  {
    id: "nex-thinking",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd-removebg-preview%20(1).png?updatedAt=1787601772554",
      label: "Thinking",
      expression: "confused",
    },
    handlerKey: "toggle-reaction",
    animation: "ripple",
    audit: "normal",
  },
  {
    id: "nex-wow",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsdsddddsd-removebg-preview.png?updatedAt=1787602313292",
      label: "Wow",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flyin",
    audit: "normal",
  },
  {
    id: "nex-mindblown",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsdsdd-removebg-preview.png?updatedAt=1787602113187",
      label: "Mind Blown",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "wobble",
    audit: "normal",
  },
  {
    id: "nex-cool",
    tier: "reaction",
    section: "react",
    // Upgraded 2026-08-25 to the sunglasses + sun + thumbs-up N-branded
    // mascot · brighter/more approachable than the earlier cigar variant.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwweweweweedf.png",
      label: "Cool",
      expression: "cozy",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  {
    id: "nex-shush",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsd-removebg-preview.png?updatedAt=1787601996037",
      label: "Shush",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "ripple",
    audit: "normal",
  },
  {
    id: "nex-vibing",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcvee-removebg-preview.png?updatedAt=1787602673414",
      label: "Vibing",
      expression: "cozy",
    },
    handlerKey: "toggle-reaction",
    animation: "sparkle",
    audit: "normal",
  },
  {
    id: "nex-sad",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsd-removebg-preview.png?updatedAt=1787603182722",
      label: "Sad",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "nex-chill",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssd-removebg-preview%20(1).png?updatedAt=1787603330312",
      label: "Chill",
      expression: "cozy",
    },
    handlerKey: "toggle-reaction",
    animation: "glow",
    audit: "normal",
  },
  {
    id: "nex-stealth",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsddd-removebg-preview.png?updatedAt=1787601642161",
      label: "Stealth",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flip",
    audit: "normal",
  },
  {
    id: "react-meh",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfd-removebg-preview%20(1).png?updatedAt=1787603530192",
      label: "Meh",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "react-ugh",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsd-removebg-preview.png?updatedAt=1787603172202",
      label: "Ugh",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "wobble",
    audit: "normal",
  },
  {
    id: "react-zipped",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsdsddddsdsdsd-removebg-preview.png?updatedAt=1787602702149",
      label: "Zipped",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  {
    id: "react-bye",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsdsddddsd-removebg-preview.png?updatedAt=1787602322764",
      label: "Bye",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  {
    id: "react-rage",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4-removebg-preview.png?updatedAt=1787601836353",
      label: "Rage",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "react-angry",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdf-removebg-preview.png?updatedAt=1787601422692",
      label: "Angry",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "react-smug",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdf-removebg-preview.png?updatedAt=1787601403918",
      label: "Smug",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  {
    id: "react-nope",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdf-removebg-preview.png?updatedAt=1787600941398",
      label: "Nope",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flip",
    audit: "normal",
  },
  {
    id: "react-bored",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdf-removebg-preview.png?updatedAt=1787600863400",
      label: "Bored",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "react-lol",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfd-removebg-preview.png?updatedAt=1787600850923",
      label: "Lol",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "sparkle",
    fullScreen: "confetti",
    audit: "normal",
  },
  {
    id: "react-you",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdf-removebg-preview.png?updatedAt=1787600709798",
      label: "You",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flyin",
    audit: "normal",
  },
  {
    id: "react-lounge",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddf-removebg-preview.png?updatedAt=1787600648149",
      label: "Lounge",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "glow",
    audit: "normal",
  },
  {
    id: "react-not-mine",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsd-removebg-preview.png?updatedAt=1787600586615",
      label: "Not Mine",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  {
    id: "react-hmm",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdf-removebg-preview.png?updatedAt=1787600469078",
      label: "Hmm",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "ripple",
    audit: "normal",
  },
  {
    id: "react-devil",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsd-removebg-preview.png?updatedAt=1787600379001",
      label: "Devil",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "sparkle",
    audit: "normal",
  },
  {
    id: "react-serious",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsd-removebg-preview.png?updatedAt=1787600326477",
      label: "Serious",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flip",
    audit: "normal",
  },
  {
    id: "react-scream",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsd-removebg-preview.png?updatedAt=1787600240792",
      label: "Scream",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flyin",
    audit: "normal",
  },
  {
    id: "react-money",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdf-removebg-preview.png?updatedAt=1787599668954",
      label: "Money",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "sparkle",
    audit: "normal",
  },
  {
    id: "react-mug",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddf-removebg-preview.png?updatedAt=1787599646865",
      label: "Mug",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "glow",
    audit: "normal",
  },
  {
    id: "react-crying",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfd-removebg-preview.png?updatedAt=1787599575881",
      label: "Crying",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "react-adore",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredf-removebg-preview.png?updatedAt=1787599513063",
      label: "Adore",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "glow",
    audit: "normal",
  },
  {
    id: "react-facepalm",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwerere-removebg-preview.png?updatedAt=1787599435369",
      label: "Facepalm",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "drop",
    audit: "normal",
  },
  {
    id: "react-warning",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwer-removebg-preview.png?updatedAt=1787599362722",
      label: "Warning",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "ripple",
    audit: "normal",
  },
  {
    id: "react-furious",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdf-removebg-preview.png?updatedAt=1787599299696",
      label: "Furious",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "wobble",
    audit: "normal",
  },
  {
    id: "react-nope2",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdf-removebg-preview.png?updatedAt=1787599232034",
      label: "Nope",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flip",
    audit: "normal",
  },
  {
    id: "react-peace",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdf-removebg-preview.png?updatedAt=1787599130205",
      label: "Peace",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "sparkle",
    audit: "normal",
  },
  {
    id: "react-kiss",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdf-removebg-preview.png?updatedAt=1787599046947",
      label: "Kiss",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "glow",
    fullScreen: "hearts",
    audit: "normal",
  },
  {
    id: "react-quiet",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdf-removebg-preview.png?updatedAt=1787598976516",
      label: "Quiet",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "ripple",
    audit: "normal",
  },
  {
    id: "react-rock",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfdds-removebg-preview.png?updatedAt=1787598911698",
      label: "Rock",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "flyin",
    audit: "normal",
  },
  {
    id: "react-nice",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfdd-removebg-preview.png?updatedAt=1787598801681",
      label: "Nice",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "pop",
    audit: "normal",
  },
  {
    id: "react-cross",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewf-removebg-preview.png?updatedAt=1787598709766",
      label: "Cross",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "wobble",
    audit: "normal",
  },
  {
    id: "react-think",
    tier: "reaction",
    section: "react",
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrew-removebg-preview.png?updatedAt=1787598595048",
      label: "Think",
      expression: "generic",
    },
    handlerKey: "toggle-reaction",
    animation: "ripple",
    audit: "normal",
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2 · INTELLIGENCE · 4 mascots for launch
  // NEX composes a message with real data · rate-limited so it can't spam.
  // Handler resolution: each has its own handlerKey.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "weather",
    tier: "intelligence",
    section: "ask-nex",
    // Upgraded 2026-08-25 to the N-branded umbrella mascot · more premium
    // than the earlier rainy hoodie. Sunny variant slot still open.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsd-removebg-preview%20(1).png",
      label: "Weather",
      expression: "rainy",
    },
    handlerKey: "weather-post",
    animation: "glow",
    capabilities: ["location:read", "tool:weather"],
    rateLimit: { per: "hour", max: 4 },
    audit: "normal",
  },
  {
    id: "birthday",
    tier: "intelligence",
    section: "ask-nex",
    // Party hat · cake with candles · confetti · winking mascot.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsd-removebg-preview.png",
      label: "Birthday",
      expression: "birthday",
    },
    handlerKey: "birthday-post",
    animation: "wobble",
    fullScreen: "fireworks",
    rateLimit: { per: "day", max: 20 },
    audit: "normal",
  },
  {
    id: "reminder",
    tier: "intelligence",
    section: "ask-nex",
    // Calendar + alarm clock · focused pose · N-branded.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdw-removebg-preview.png",
      label: "Reminder",
      expression: "generic",
    },
    handlerKey: "reminder-schedule",
    animation: "ripple",
    rateLimit: { per: "day", max: 40 },
    audit: "normal",
  },
  {
    id: "currency",
    tier: "intelligence",
    section: "ask-nex",
    // Glasses · holding Indonesian Rupiah cash + coin · perfect for the
    // Indonesia-first NEX launch. Add USD/GBP variants later if regions expand.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdww-removebg-preview.png",
      label: "Currency",
      expression: "premium",
    },
    handlerKey: "currency-post",
    animation: "flip",
    capabilities: ["tool:currency"],
    rateLimit: { per: "hour", max: 10 },
    audit: "normal",
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 3 · ACTIONS · 6 mascots for launch
  // NEX finds a venue and posts an interactive card (YES / NO / another).
  // All share handlerKey "find-venue" · differentiated by handlerParams.category.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "coffee",
    tier: "action",
    section: "discover",
    // Steaming N-branded coffee mug + coffee bag · thoughtful pointing pose.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwwew-removebg-preview.png",
      label: "Coffee",
      expression: "cozy",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "cafe", filters: { openNow: true, hasSeating: true } },
    animation: "flyin",
    capabilities: ["location:read", "tool:venues"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },
  {
    id: "food",
    tier: "action",
    section: "discover",
    // Bowl of noodles + chopsticks · Indonesian noodle scene · N-branded.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwwewe-removebg-preview.png",
      label: "Food",
      expression: "generic",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "restaurant", filters: { openNow: true } },
    animation: "flyin",
    capabilities: ["location:read", "tool:venues"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },
  {
    id: "date",
    tier: "action",
    section: "discover",
    // Upgraded 2026-08-25 to the couple-at-candlelit-dinner-with-rose mascot ·
    // signature "date-night" scene · replaces the Cupid-with-bow variant.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwww-removebg-preview.png",
      label: "Dinner Date",
      expression: "romantic",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "date", filters: { ambiance: "date-appropriate", openTonight: true } },
    animation: "glow",
    capabilities: ["location:read", "tool:venues"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },
  {
    id: "beer",
    tier: "action",
    section: "discover",
    // Beer-mug mascot · upgraded 2026-08-25 to the N-branded sunglasses +
    // beer scene · matches the visual polish of the other event mascots.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwww-removebg-preview.png",
      label: "Beer",
      expression: "generic",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "bar", filters: { openNow: true, servesBeer: true } },
    animation: "flyin",
    capabilities: ["location:read", "tool:venues"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },
  {
    id: "cinema",
    tier: "action",
    section: "discover",
    // 3D glasses · red cinema seat · popcorn tub · film reel.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwwewewe-removebg-preview.png",
      label: "Cinema",
      expression: "generic",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "cinema", filters: { showtimesTonight: true } },
    animation: "flyin",
    capabilities: ["location:read", "tool:venues"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },
  {
    id: "beach",
    tier: "action",
    section: "discover",
    // Palm tree · beach chair · sunglasses · beach ball · tropical scene.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwweweweweedfdfdf-removebg-preview.png",
      label: "Beach",
      expression: "sunny",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "beach", filters: { weatherFriendly: true } },
    animation: "flyin",
    capabilities: ["location:read", "tool:venues", "tool:weather"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },
  {
    id: "walk",
    tier: "action",
    section: "discover",
    // Walking stick · casual stroll pose · outdoor N-branded.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/xcvxcveesddssdsdsdsdfdgfgsdsdsdwwwwwewewewee-removebg-preview.png",
      label: "Walk",
      expression: "generic",
    },
    handlerKey: "find-venue",
    handlerParams: { category: "park", filters: { walkability: "high" } },
    animation: "flyin",
    capabilities: ["location:read", "tool:venues"],
    rateLimit: { per: "hour", max: 6 },
    audit: "normal",
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 4 · CONSUMABLES · 1 signature mascot for launch (grenade)
  // Server-authoritative. Wallet-gated. Cinematic animation is signature.
  // See docs/nex-actions/grenade-animation-spec.md for the animation spec.
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "grenade",
    tier: "consumable",
    section: "special",
    // Trash-can mascot (m14) · Philip approved 2026-08-25 · "throw this post
    // in the trash" reads playful, not aggressive. Signature interaction
    // should feel mischievous, not violent.
    mascot: {
      imageUrl: "https://ik.imagekit.io/7grri5v7d/Untitleddsfsfdfdsdfwrewfddsdfdfdfsdfdfwereredfddfdfsdsdsdfsdsddfdfdfdfdfdfdfsdddd4dfsdsdsdddds-removebg-preview.png?updatedAt=1787602222947",
      label: "Grenade",
      expression: "explosive",
    },
    handlerKey: "grenade",
    animation: "drop",     // landing motion · full choreography in the handler
    capabilities: ["delete-own-message", "wallet:sparks:spend"],
    cost: { sparks: 100 }, // ACTION-LEVEL cost only · commercial pricing in wallet layer
    rateLimit: { per: "minute", max: 3 },
    audit: "high",
  },
];

// Pure lookup · no side effects · safe to call anywhere.
const ACTION_INDEX = new Map<string, NexAction>();
for (const a of NEX_ACTIONS) ACTION_INDEX.set(a.id, a);
export function getAction(id: string): NexAction | undefined {
  return ACTION_INDEX.get(id);
}

// Pure section filter · used by the tray to render tabbed groups.
export function actionsBySection(section: NexAction["section"]): readonly NexAction[] {
  return NEX_ACTIONS.filter((a) => (a.section ?? sectionForTier(a.tier)) === section);
}

// Default section per tier · overridable via NexAction.section.
export function sectionForTier(tier: NexAction["tier"]): NonNullable<NexAction["section"]> {
  switch (tier) {
    case "reaction":     return "react";
    case "intelligence": return "ask-nex";
    case "action":       return "discover";
    case "consumable":   return "special";
  }
}
