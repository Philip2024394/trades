// Editing Platform · MVP command parser.
//
// A lightweight rule-based parser for the shipping-set of intents. A future
// phase upgrades to a vision-language parser for free-form commands.
//
// Doctrine: docs/brains/nex-phase-e5-e7-editing-delivery-design-memory-philip-2026-08-04.md

import type { EditCommand, EditIntent, EditDirection, EditParseResult } from "./types";

const DIRECTIONS: Record<string, EditDirection> = {
  left: "left", right: "right", up: "up", down: "down", in: "in", out: "out",
};

function parseMm(text: string): number | undefined {
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*mm\b/i);
  if (m) return parseFloat(m[1]);
  const cm = text.match(/(-?\d+(?:\.\d+)?)\s*cm\b/i);
  if (cm) return parseFloat(cm[1]) * 10;
  const mtr = text.match(/(-?\d+(?:\.\d+)?)\s*m\b(?!\w)/i);
  if (mtr) return parseFloat(mtr[1]) * 1000;
  return undefined;
}

function parsePct(text: string): number | undefined {
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
  return m ? parseFloat(m[1]) : undefined;
}

function findFirst(text: string, keywords: readonly string[]): string | undefined {
  for (const k of keywords) if (text.includes(k)) return k;
  return undefined;
}

const OBJECT_KEYWORDS = ["staircase", "handrail", "logo", "cta", "hero", "image", "kitchen", "island", "worktop", "camera", "lighting", "badge", "qr", "text", "headline"] as const;

const MATERIAL_KEYWORDS = ["oak", "walnut", "pine", "mahogany", "ash", "steel", "brass", "glass", "aluminium", "quartz", "granite", "concrete"] as const;

const THEME_KEYWORDS = ["luxury_burgundy", "luxury_black_gold", "modern_blue", "aqua_teal", "nature_green", "traditional_brown", "premium_purple", "heritage_walnut_cream", "corporate_grey", "minimal_white", "industrial_orange", "nature_green_lifestyle"] as const;

const CAMERA_KEYWORDS = ["marketing", "website", "instagram", "flyer", "technical", "construction", "exploded", "isometric", "floorplan", "section"] as const;

const LIGHTING_KEYWORDS = ["luxury_warm", "modern_cool", "industrial", "showroom", "daylight", "golden_hour", "studio", "night_leds", "golden hour", "night leds"] as const;

function classifyIntent(text: string): EditIntent | undefined {
  if (/\bmove\b/.test(text) || /\bslide\b/.test(text) || /\bshift\b/.test(text)) return "move";
  if (/\breplace\b/.test(text) && MATERIAL_KEYWORDS.some((m) => text.includes(m))) return "replace_material";
  if (/\bswap\b/.test(text) && MATERIAL_KEYWORDS.some((m) => text.includes(m))) return "replace_material";
  if (/\b(darker|lighter|redder|greener|bluer|change (the )?colou?r|recolou?r)\b/.test(text)) return "recolor";
  if (/\b(bigger|larger|smaller|shrink|scale|resize|increase|reduce)\b/.test(text)) return "resize";
  if (/\brotate\b/.test(text)) return "rotate";
  if (/\b(delete|remove)\b/.test(text)) return "delete";
  if (/\badd\b/.test(text)) return "add";
  if (/\b(camera)\b/.test(text)) return "change_camera";
  if (/\b(lighting|light)\b/.test(text)) return "change_lighting";
  if (/\btheme\b/.test(text)) return "change_theme";
  return undefined;
}

function parseSingle(rawFull: string): EditCommand | undefined {
  const text = rawFull.trim().toLowerCase();
  if (!text) return undefined;
  const intent = classifyIntent(text);
  if (!intent) return undefined;

  const target_id = OBJECT_KEYWORDS.find((k) => text.includes(k));
  const amount_mm = parseMm(text);
  const amount_pct = parsePct(text);
  const directionKey = Object.keys(DIRECTIONS).find((d) => new RegExp(`\\b${d}\\b`).test(text));
  const direction = directionKey ? DIRECTIONS[directionKey] : undefined;

  let from: string | undefined;
  let to: string | undefined;
  if (intent === "replace_material" || intent === "change_theme" || intent === "change_camera" || intent === "change_lighting") {
    const pool = intent === "replace_material" ? MATERIAL_KEYWORDS
              : intent === "change_theme" ? THEME_KEYWORDS
              : intent === "change_camera" ? CAMERA_KEYWORDS
              : LIGHTING_KEYWORDS;
    const hits = pool.filter((k) => text.includes(k));
    if (intent === "replace_material") {
      // "replace oak with walnut" → from=oak, to=walnut
      const withIdx = text.indexOf(" with ");
      if (hits.length >= 2 && withIdx > 0) {
        const beforeWith = text.slice(0, withIdx);
        const afterWith = text.slice(withIdx);
        from = hits.find((k) => beforeWith.includes(k));
        to = hits.find((k) => afterWith.includes(k) && k !== from);
      } else if (hits.length >= 1) {
        to = hits[hits.length - 1];
      }
    } else {
      to = hits[hits.length - 1];
    }
  }

  let hex_delta: string | undefined;
  if (intent === "recolor") {
    if (/darker/.test(text)) hex_delta = "-15%";
    else if (/lighter/.test(text)) hex_delta = "+15%";
  }

  // Confidence heuristic · start at 0.5 · +0.1 per resolved slot
  let confidence = 0.5;
  if (target_id) confidence += 0.1;
  if (amount_mm !== undefined || amount_pct !== undefined || direction || to || hex_delta) confidence += 0.2;
  if (from && to && intent === "replace_material") confidence += 0.1;
  if (confidence > 0.95) confidence = 0.95;

  return {
    intent,
    target_id,
    amount_mm,
    amount_pct,
    direction,
    from,
    to,
    hex_delta,
    raw_text: rawFull,
    confidence,
  };
}

/** Parse one command string · returns 0..N commands + warnings. Multi-command
 *  utterances split on " and " · " then " · " · " · " ; " · full stop. */
export function parseCommand(text: string): EditParseResult {
  const parts = text.split(/(?:\s+then\s+|\s*·\s*|\s*;\s*|\s+and\s+|\.\s+)/i).map((s) => s.trim()).filter(Boolean);
  const commands: EditCommand[] = [];
  const unrecognized: string[] = [];
  const warnings: string[] = [];
  for (const p of parts) {
    const cmd = parseSingle(p);
    if (cmd) commands.push(cmd);
    else unrecognized.push(p);
  }
  if (commands.length === 0 && text.trim().length > 0) {
    warnings.push("No editable intent recognised in the command.");
  }
  return { commands, warnings, unrecognized_fragments: unrecognized };
}
