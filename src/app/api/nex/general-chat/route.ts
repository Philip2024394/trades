// POST /api/nex/general-chat · general customer Nex Chat backend · Philip 2026-08-03.
//
// The customer-side general assistant endpoint. Called by the
// /nex-app/chat page (the clean general chat surface) and by the shell
// FAB. Deliberately separate from:
//   · /api/nex/chat            — MERCHANT-side Nex business assistant (Studio · BI · CX etc.)
//   · /api/nex/merchant-chat   — merchant-context intake (Trade Centre)
//   · /api/brains/[slug]/message — trade-brain reasoning (Staircase etc.)
//
// v1 posture (Philip 2026-08-03):
//   · Deterministic authored intent routing · NO LLM call · Third-Law safe
//   · Detects broad user intent from keywords · returns a friendly reply
//     plus one or two navigation suggestions routing to real surfaces
//   · Never fabricates a merchant, price, or promise. Only points at pages.
//   · When we don't recognise the intent, we say so plainly and offer the
//     most useful next surface (Trade Centre + My Projects).
//
// When the General Nex Brain lands (per Brain Separation Architecture)
// this endpoint becomes the thin router that composes that brain's
// reasoning. For now it's honest, useful, and hallucination-free.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  activateThemeByIntent,
  resetThemeForSession,
} from "@/lib/nex/themes/server-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Optional session id · themes persist across devices when present ·
// gracefully degrades to localStorage-only when absent. Same header
// convention as /api/nex/projects/*.
function readOptionalSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

type Suggestion = { label: string; href: string };

// Theme command · Philip 2026-08-03 · runtime Theme Engine loop.
//
// Detected by the router when the user asks to change or reset the
// workspace theme in natural language. Client uses this to swap the
// applied theme class + persist to localStorage.
//
// NEVER changes navigation · surfaces · logic · APIs · state machines ·
// motion semantics · honest-state copy. Only visual tokens.
type ThemeCommand =
  | { action: "activate"; theme_id: "blossom" | "staircase_light_cream" | "staircase_walnut" }
  | { action: "reset" };

// Card payloads · Philip 2026-08-03 · Chat-First OS · "Stop Answering ·
// Start Doing" — every intent should produce a visible artifact, even
// when the capability can't complete yet. Users see their request take
// shape. Cards carry HONEST status (never fake progress).
type MeetingCard = {
  type: "meeting";
  fields: {
    title: string;
    date: string;
    time: string;
    reminder: string;
  };
  status: "requires_connection" | "coming_soon";
  status_label: string;
  actions: CardAction[];
};

type ImageCreationCard = {
  type: "image_creation";
  fields: {
    subject: string;
    overlay: string;
    format: string;
  };
  status: "coming_soon";
  status_label: string;
  actions: CardAction[];
};

type CardAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "coming_soon"; label: string; toast: string }
  | { kind: "dismiss"; label: string }
  // Philip 2026-08-03 · replaces the toast-rejection pattern. The card
  // transitions into an evolved "saved · waiting" state rather than
  // surfacing a wall message.
  | { kind: "save_for_later"; label: string; state: "prepared_waiting" };

type Card = MeetingCard | ImageCreationCard;

type ChatBody = {
  message?: string;
  conversation_id?: string;
};

// Theme-intent gate · Philip 2026-08-03.
//
// If a message clearly mentions "theme" (change theme · switch theme ·
// use the X theme · apply theme · etc.) we MUST resolve it as a theme
// command — otherwise generic words in the theme name (e.g. "staircase"
// in "staircase light cream") get stolen by the trade-brain matchers
// downstream. This gate wraps the theme routes and ONLY falls through
// to trade routing when no theme intent is detected at all.
function mentionsThemeIntent(lower: string): boolean {
  if (!/\btheme\b/i.test(lower)) return false;
  return /\b(change|switch|set|apply|use|make|turn|activate|try|preview|reset|restore|default|pick|choose)\b/i.test(
    lower,
  );
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }
  const conversationId =
    typeof body.conversation_id === "string" && body.conversation_id.length > 0
      ? body.conversation_id
      : randomUUID();

  const composed = composeReply(message);
  let { reply } = composed;
  const { suggestions, card, theme_command } = composed;

  // If the router emitted a ThemeCommand and the client sent a
  // session_id, persist the swap through the Theme Engine backend so
  // the change survives reload + syncs across devices. Client keeps
  // its localStorage fast path — this is additive, not required.
  let theme_persisted: null | {
    active: unknown;
    theme_id: string;
    via: string;
    preview_expires_at: string | null;
  } = null;

  const sessionId = readOptionalSessionId(req);
  if (theme_command && sessionId) {
    try {
      if (theme_command.action === "reset") {
        const r = await resetThemeForSession(sessionId);
        theme_persisted = {
          active: r.active,
          theme_id: r.theme.id,
          via: "reset",
          preview_expires_at: null,
        };
      } else if (theme_command.action === "activate") {
        const r = await activateThemeByIntent(sessionId, theme_command.theme_id);
        if (r.ok) {
          theme_persisted = {
            active: r.active,
            theme_id: r.theme.id,
            via: r.via,
            preview_expires_at: r.preview?.expires_at ?? null,
          };
          // Six Sharpening Rules #4: when a preview was granted, the
          // reply should mention the 24h window so users know what
          // happened. We surface this as an appended sentence (still
          // matches the approved feeling-forward voice).
          if (r.via === "preview_granted") {
            reply +=
              " I've turned it on for the next 24 hours so you can experience it properly.";
          }
        }
      }
    } catch (err) {
      // Persistence failure never breaks the reply · client's
      // localStorage path still applies the theme visually.
      console.error("[nex-general-chat][theme_persist]", err);
    }
  }

  return NextResponse.json({
    ok: true,
    reply,
    suggestions,
    card,
    theme_command,
    theme_persisted,
    conversation_id: conversationId,
    served_by: "nex-general-chat-v1",
  });
}

// ─── Intent routing (deterministic · authored) ─────────────────────────

function composeReply(message: string): {
  reply: string;
  suggestions: Suggestion[];
  card?: Card;
  theme_command?: ThemeCommand;
} {
  const lower = message.toLowerCase();

  // ─── Theme intent detection · Philip 2026-08-03 · runtime loop ─────
  //
  // Detects theme-change requests BEFORE all other intents · natural
  // language must map to a ThemeCommand · client applies the change.
  // Only two themes shipped today: Original Nex + Blossom. Other named
  // themes (Luxury / Military / Glass / Industrial) return an honest
  // "on my way" reply that keeps the user's intent recognised without
  // faking a swap that hasn't shipped (Third Law).
  //
  // Reset patterns are broad on purpose — the "familiar home" (Original
  // Nex) must always be recoverable via any of the phrasings Philip
  // captured in doctrine.
  const wantsReset =
    /\b(reset|restore|default|standard|original nex|standard nex)\b/i.test(
      lower,
    ) ||
    /back to (default|original|standard|normal|the original|the default)/i.test(
      lower,
    ) ||
    /(remove|switch off|disable|clear|turn off) (my |the )?(theme|custom theme|blossom|cherry blossom)/i.test(
      lower,
    ) ||
    /restore (my |the )?(workspace|nex|theme)/i.test(lower) ||
    /(switch|go|change) back to (nex|the original|standard)/i.test(lower) ||
    /use the (original|standard|default) (nex|design|workspace)/i.test(lower);
  if (wantsReset) {
    return {
      reply:
        "Done. Your workspace has been restored to the original Nex design. If you'd like to personalise it again, just describe how you'd like your workspace to feel.",
      suggestions: [],
      theme_command: { action: "reset" },
    };
  }

  const wantsBlossom =
    /\b(cherry blossom|blossom|sakura)\b/i.test(lower) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(soft |cute |gentle )?(and )?(pink|blush|rose)/i.test(
      lower,
    ) ||
    /pink (workspace|chat|nex|theme|style)/i.test(lower);
  if (wantsBlossom) {
    return {
      reply:
        "Done! Your workspace now has a soft cherry blossom style. If this isn't quite the right fit, tell me the feeling you're after and I'll create another one.",
      suggestions: [],
      theme_command: { action: "activate", theme_id: "blossom" },
    };
  }

  // Grand Entrance · luxury / cream / bronze / glass identity. Names the
  // FEELING in the reply, not the visual choice (approved Nex copy voice
  // for theme confirmations). Underlying theme_id stays
  // `staircase_light_cream` so persisted rows continue to resolve.
  const wantsGrandEntrance =
    /\b(grand entrance|luxury home|luxury workspace|premium workspace|five million|£5m|five ?m home)\b/i.test(
      lower,
    ) ||
    /\b(staircase[- ]?light[- ]?cream|staircase[- ]?light|light[- ]?cream|staircase[- ]?cream)\b/i.test(
      lower,
    ) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(like |into )?(a |the |an )?(luxury|luxurious|premium|elegant|grand|modern|apple|villa)/i.test(
      lower,
    ) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(like |into )?(a |the |an )?(workshop|craftsman|carpenter|joiner)/i.test(
      lower,
    ) ||
    /(luxury|luxurious|premium|elegant|grand|villa|workshop|craftsman|carpenter|joiner) (feel|style|workspace|theme|vibe)/i.test(
      lower,
    ) ||
    /(cream|bronze|brass|copper|champagne|gold) (workspace|chat|nex|theme|style)/i.test(
      lower,
    ) ||
    /(make|give) (my |the |it )?(workspace |chat )?(a )?(warm |soft )?(cream|bronze|brass|champagne|gold) (feel|look)/i.test(
      lower,
    ) ||
    /(warm |soft )?(cream and bronze|bronze and cream|glass and cream|cream and gold|bronze and gold)/i.test(
      lower,
    );
  if (wantsGrandEntrance) {
    return {
      reply:
        "Done. Your workspace now has a Grand Entrance feel — frosted glass over warm cream, bronze accents and a subtle champagne trim. If it's not quite the right fit, tell me the feeling you're after and I'll create another one.",
      suggestions: [],
      theme_command: {
        action: "activate",
        theme_id: "staircase_light_cream",
      },
    };
  }

  // Walnut Sanctum · first DARK theme · deep walnut wood + amber sconce
  // + antique brass · cream text on dark glass. Old-money library energy.
  // Underlying theme_id is `staircase_walnut`.
  const wantsWalnutSanctum =
    /\b(walnut sanctum|walnut|old money|old[- ]world|library|study|master(?:'s)? study|sanctum)\b/i.test(
      lower,
    ) ||
    /(make|change|switch|turn|set) (my |the |it |this )?(workspace |chat |nex )?(feel |look |appear |be )?(like |into )?(a |the |an )?(private )?(study|library|drawing[- ]?room|reading room|gentleman[' ]?s club)/i.test(
      lower,
    ) ||
    /(dark|moody|deep) (and )?(warm|luxurious|luxury|masculine|handsome|elegant)/i.test(
      lower,
    ) ||
    /(brass|amber|dark walnut) (workspace|chat|nex|theme|style)/i.test(
      lower,
    ) ||
    /(walnut and brass|brass and walnut|amber and walnut|walnut and amber|dark and warm)/i.test(
      lower,
    );
  if (wantsWalnutSanctum) {
    return {
      reply:
        "Done. Your workspace now has a Walnut Sanctum feel — deep walnut wood, a warm amber sconce and antique-brass hairlines. Old-money library energy. Tell me the feeling you're after if you'd like something different.",
      suggestions: [],
      theme_command: {
        action: "activate",
        theme_id: "staircase_walnut",
      },
    };
  }

  // Other named themes not yet built · honest response · doesn't fake
  // capability (Third Law · Never-Dead-End · offers what IS shipped).
  const wantsOtherPremiumTheme =
    /\b(luxury|luxurious|gold|black and gold|elegant|premium)\b.*(workspace|theme|look|feel|style)/i.test(
      lower,
    ) ||
    /\b(military|tactical|command|army|marine)\b.*(workspace|theme|look|feel|style)/i.test(
      lower,
    ) ||
    /\b(glass|apple|modern|futuristic|clean)\b.*(workspace|theme|look|feel|style)/i.test(
      lower,
    ) ||
    /\b(industrial|workshop|trades|construction|utility)\b.*(workspace|theme|look|feel|style)/i.test(
      lower,
    );
  if (wantsOtherPremiumTheme) {
    return {
      reply:
        "I understand the feeling you're after. Blossom is the first premium workspace I've finished — more styles like Luxury, Military, Glass and Industrial are on my way. In the meantime you can try Blossom or return to the original Nex design.",
      suggestions: [],
    };
  }

  // Theme-intent fallthrough guard · Philip 2026-08-03.
  //
  // If the user clearly meant a theme change but none of the specific
  // theme routes above claimed it, DO NOT let this leak into the
  // trade-brain matchers below (they steal generic words like
  // "staircase"). Offer the shipped themes honestly.
  if (mentionsThemeIntent(lower)) {
    return {
      reply:
        "I've got two premium workspaces ready right now — Blossom (soft cherry pink) and Grand Entrance (frosted glass with warm bronze). Say which one you'd like, or ask me to reset back to the original Nex.",
      suggestions: [],
    };
  }


  // Image / banner / marketing creation request · Philip 2026-08-03 · NOW
  // fix (Test Gate).
  //
  // Detected BEFORE the trade branches because otherwise "create me a banner
  // for staircase" matches the staircase branch and Nex ignores the actual
  // request. The user asked to CREATE something · Nex must honestly answer
  // that it can't yet, not deflect to information about the trade. Third
  // Law · Second Law (understanding intent) · Fifth Law (Nex completes or
  // honestly explains why not · never fakes).
  //
  // Composes with the Image Intelligence Brain spec: Nex is the director,
  // external models are the artist · but no artist is connected yet, so
  // Nex declines cleanly.
  const wantsCreation =
    /(create|make|design|build|generate|edit|change|resize|remove|replace|inpaint|outpaint)\s+.*(banner|poster|logo|flyer|advert(isement)?|ad|graphic|image|picture|design|marketing|render|thumbnail|artwork)/i.test(
      lower,
    ) ||
    /^(banner|poster|logo|flyer|design|graphic|artwork|thumbnail)\b/i.test(lower.trim()) ||
    /(instagram|facebook|linkedin|tiktok|twitter|x)\s+(banner|post|ad|advert|cover|story|reel)/i.test(
      lower,
    );
  if (wantsCreation) {
    const card: ImageCreationCard = {
      type: "image_creation",
      fields: {
        subject: extractImageSubject(message),
        overlay: extractImageOverlay(message),
        format: extractImageFormat(message),
      },
      status: "coming_soon",
      status_label: "Coming Soon",
      actions: [
        {
          kind: "coming_soon",
          label: "Notify me when ready",
          toast: "I'll surface this the moment image creation ships. No sign-up needed.",
        },
        { kind: "link", label: "Find a designer", href: "/nex-app/centre" },
        { kind: "dismiss", label: "Cancel" },
      ],
    };
    return {
      reply:
        "I've captured what I understood from your request. Image creation is on the way — once it lands I'll build this with you inside our conversation, edits and all. Have I missed any details?",
      suggestions: [],
      card,
    };
  }

  // Calendar / meeting / reminder request · Philip 2026-08-03 · NOW fix.
  //
  // Nex has NO calendar or reminder capability yet — Automation is a
  // FUTURE capability in the priority order. Nex must honestly explain
  // this rather than deflect. Third Law. Composes with "Hide the Engine
  // Room" — user language stays natural, no talk of "Automation Brain."
  const wantsCalendarOrReminder =
    /(save|schedule|book|create|set|add|make)\s+.*(meeting|appointment|event|reminder|note)/i.test(
      lower,
    ) ||
    /\bremind me\b/i.test(lower) ||
    /\bset (a |the )?reminder\b/i.test(lower) ||
    /\b(open|check|add to) (my |the )?calendar\b/i.test(lower);
  if (wantsCalendarOrReminder) {
    const card: MeetingCard = {
      type: "meeting",
      fields: {
        title: extractMeetingTitle(message),
        date: extractMeetingDate(message),
        time: extractMeetingTime(message),
        reminder: extractMeetingReminder(message),
      },
      status: "requires_connection",
      // Philip 2026-08-03 · aligned to the Universal Task Lifecycle
      // (Preparing → Waiting for Calendar → Saved → Completed). The card
      // has all fields · it's waiting for the external system.
      status_label: "Waiting for Calendar",
      actions: [
        // Save-for-later replaces the old toast pattern (Philip 2026-08-03).
        // Clicking transitions the card into "prepared · waiting" — the
        // user feels their work has been saved, not rejected.
        {
          kind: "save_for_later",
          label: "Save for later",
          state: "prepared_waiting",
        },
        { kind: "dismiss", label: "Cancel" },
      ],
    };
    return {
      reply:
        "I've completed everything I could from your request. The only thing missing is a connected calendar. Once you connect Google Calendar or Outlook, I'll save this meeting without you needing to enter everything again. Have I missed any details?",
      suggestions: [],
      card,
    };
  }

  // Contacts / friends / people-network request · Philip 2026-08-03 · NOW
  // fix. Nex DOES have a Contacts page (/nex-app/contacts) · route to it.
  const wantsContacts =
    /\bmy contact(s)?\b/i.test(lower) ||
    /\bmy friend(s)?\b/i.test(lower) ||
    /(pull up|show me|see|open|find|view)\s+(my |the )?(contact|friend|network|address book|people)/i.test(
      lower,
    ) ||
    /\bwhere is my (friend|contact)/i.test(lower);
  if (wantsContacts) {
    return {
      reply:
        "Your contacts live here — everyone you've connected with through Nex. Tap through to see who's around.",
      suggestions: [
        { label: "Open Contacts", href: "/nex-app/contacts" },
      ],
    };
  }

  // Image / picture / gallery VIEW request (NOT creation) · Philip
  // 2026-08-03 · NOW fix. Detects BEFORE the trade branches because
  // "show me an image of an oak staircase" would otherwise match
  // staircase and Nex would answer about design/materials instead of
  // showing images.
  const wantsImageView =
    /(show|see|look at|view|find|pull up|display|browse|open|any)\s+.*(image|picture|photo|photograph|gallery|design|example|inspiration)/i.test(
      lower,
    ) ||
    /(gallery|inspiration)\b/i.test(lower);
  if (wantsImageView) {
    // If the request has staircase context, route directly to the Library
    if (/staircase|\bstair(s|way|case)?\b|balustrade|oak|walnut|glass\s+stair/i.test(lower)) {
      return {
        reply:
          "The Staircase Library is where I keep the designs I know best — plenty of oak, walnut, glass and modern styles. Tap through and anything that catches your eye can start a project.",
        suggestions: [
          { label: "Open Staircase Library", href: "/nex-app/staircase-library" },
          { label: "Browse Trade Centre", href: "/nex-app/centre" },
        ],
      };
    }
    return {
      reply:
        "The Staircase Library has the deepest image collection today. Trade Centre also shows real project photos from verified merchants. I'll add more trade libraries as Nex grows.",
      suggestions: [
        { label: "Staircase Library", href: "/nex-app/staircase-library" },
        { label: "Trade Centre", href: "/nex-app/centre" },
      ],
    };
  }

  // Staircase-shaped question → surface the staircase brain area + Trade
  // Centre pre-filtered. Nex is honest that this is the area we know best.
  if (/staircase|\bstair(s|way|case)?\b|balustrade|banister|newel/.test(lower)) {
    return {
      reply:
        "Staircases are where I know most today. I can help you find companies, compare materials, and understand what's involved before you commit to anything.",
      suggestions: [
        { label: "Browse staircase companies", href: "/nex-app/centre?q=staircase" },
        { label: "Staircase Library", href: "/nex-app/staircase-library" },
      ],
    };
  }

  if (/plumber|plumbing|leak(ing)?|boiler|radiator|drain/.test(lower)) {
    return {
      reply:
        "For plumbing work, the Trade Centre lists verified professionals near you. I don't have deep plumbing knowledge yet, so I'll get you to real people faster.",
      suggestions: [
        { label: "Find a plumber", href: "/nex-app/centre?q=plumber" },
      ],
    };
  }

  if (/electric(al|ian)?|wiring|socket|fuse|rewire/.test(lower)) {
    return {
      reply:
        "For electrical work, the Trade Centre is the fastest way to a real professional. I'll add deeper electrical knowledge to Nex as it earns its place.",
      suggestions: [
        { label: "Find an electrician", href: "/nex-app/centre?q=electrician" },
      ],
    };
  }

  if (/kitchen|renovation|extension|loft|bathroom|refurb/.test(lower)) {
    return {
      reply:
        "That sounds like a home project. The Trade Centre is where you can find companies for it, and I'll help you keep everything organised in one place as you go.",
      suggestions: [
        { label: "Browse Trade Centre", href: "/nex-app/centre" },
        { label: "My Projects", href: "/nex-app/projects" },
      ],
    };
  }

  if (/find|looking for|need (someone|a )/.test(lower)) {
    return {
      reply:
        "The Trade Centre is where you can browse and connect with verified professionals. Tell me the kind of work you need and I'll help you get to the right people.",
      suggestions: [
        { label: "Open Trade Centre", href: "/nex-app/centre" },
      ],
    };
  }

  if (/(continue|resume|my project|where.*(left|got to))/.test(lower)) {
    return {
      reply:
        "Head to My Projects and pick up where you left off. I keep everything visible so you never have to remember what stage each conversation was at.",
      suggestions: [
        { label: "My Projects", href: "/nex-app/projects" },
      ],
    };
  }

  // Default · honest fallback (Unknown Rule + Third Law)
  return {
    reply:
      "I can help you find trusted professionals, manage projects, and understand what to do next. Tell me what you're working on and I'll point you the right way.",
    suggestions: [
      { label: "Trade Centre", href: "/nex-app/centre" },
      { label: "My Projects", href: "/nex-app/projects" },
    ],
  };
}

// ─── Field extractors for cards (Philip 2026-08-03) ────────────────────
//
// Best-effort extraction from natural-language messages. Never fabricate ·
// return "Not specified" when unclear. The card then shows Nex captured
// what the user said · missing fields stay honest.

function extractMeetingTitle(_message: string): string {
  // v1 · no explicit title extraction · keep it simple.
  return "Meeting";
}

function extractMeetingDate(message: string): string {
  const lower = message.toLowerCase();
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  if (/\btomorrow\b/.test(lower)) return "Tomorrow";
  if (/\btoday\b/.test(lower))    return "Today";
  for (const d of days) {
    const nextMatch = new RegExp(`\\bnext\\s+${d}\\b`, "i").test(lower);
    if (nextMatch) return "Next " + d.charAt(0).toUpperCase() + d.slice(1);
  }
  for (const d of days) {
    if (new RegExp(`\\b${d}\\b`, "i").test(lower)) {
      return d.charAt(0).toUpperCase() + d.slice(1);
    }
  }
  // Try DD/MM or Month name
  const monthMatch = message.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  );
  if (monthMatch) {
    return `${monthMatch[1]} ${monthMatch[2].charAt(0).toUpperCase() + monthMatch[2].slice(1).toLowerCase()}`;
  }
  return "Not specified";
}

function extractMeetingTime(message: string): string {
  // Handles "2pm", "2:30pm", "at 2:00 PM", "14:00"
  const m = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (m) {
    const h = m[1];
    const mins = m[2] ?? "00";
    const ampm = m[3].toUpperCase();
    return `${h}:${mins} ${ampm}`;
  }
  const m24 = message.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m24) return `${m24[1]}:${m24[2]}`;
  return "Not specified";
}

function extractMeetingReminder(message: string): string {
  const lower = message.toLowerCase();
  if (/morning of|morning reminder|reminder.*morning/.test(lower)) {
    return "Morning of the day";
  }
  const m = lower.match(/(\d+)\s*(hour|hr|min|minute)s?\s*(before|prior|earlier)?/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].startsWith("hour") || m[2] === "hr" ? "hour" : "minute";
    return `${n} ${unit}${n === 1 ? "" : "s"} before`;
  }
  return "1 hour before"; // sensible default
}

function extractImageSubject(message: string): string {
  const m = message.match(
    /(?:for|of|about|showing|featuring)\s+(?:a\s+|an\s+|some\s+|the\s+|my\s+)?([a-z][a-z\s]{2,50})/i,
  );
  if (m) {
    const words = m[1].trim().split(/\s+/).slice(0, 6).join(" ");
    // strip trailing conjunctions
    return words.replace(/\s+(with|and|for|in|on|at)$/i, "").trim() || "Not specified";
  }
  return "Not specified";
}

function extractImageOverlay(message: string): string {
  const q = message.match(/["']([^"']{2,50})["']/);
  if (q) return q[1];
  const w = message.match(/with\s+([a-z0-9][a-z0-9\s]{1,50}?)\s+on\s+it\b/i);
  if (w) return w[1].trim();
  const s = message.match(/(?:saying|that says|text|caption)\s+["']?([a-z0-9\s]{2,50}?)["']?(?:\.|,|$)/i);
  if (s) return s[1].trim();
  return "Not specified";
}

function extractImageFormat(message: string): string {
  const lower = message.toLowerCase();
  if (/instagram/.test(lower))  return "Instagram Portrait";
  if (/facebook/.test(lower))   return "Facebook Feed";
  if (/story/.test(lower))      return "Instagram Story";
  if (/cover/.test(lower))      return "Facebook Cover";
  if (/flyer|a4\b/.test(lower)) return "A4 Flyer";
  if (/a5\b/.test(lower))       return "A5 Flyer";
  if (/twitter|linkedin/.test(lower)) return "Social Post";
  return "Not specified";
}
