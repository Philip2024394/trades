// src/lib/nex-food/evidence-aggregator-check.ts
//
// Task #88 Phase 3 · aggregator-detection for enrichment evidence values.
//
// Philip 2026-08-22 verbatim: *"Give the queue a 'Why am I seeing this?'
// evidence panel. For the linktr.ee case, the admin should immediately see
// something like: ⚠️ Possible aggregator / false-positive."*
//
// Pure function · zero deps · runs both server-side (queue page render) and
// client-side (row component tooltip). Never auto-decides · only flags for
// human attention. The admin decision is still the sole gate.
//
// Coverage:
//   · Known link aggregators (linktr.ee, beacons.ai, bio.link, taplink.cc, …)
//   · Reserved/utility handles that the extractor regex accidentally matches
//     (e.g. "p" · "reel" · "sharer" · "business" · "explore")
//   · URL-shape values in a social handle field (has protocol · has slash)
//
// This is NOT the safety guard against fabrication (agents never fabricate).
// This is a UX hint layered on top of already-existing provenance so admins
// spend one glance instead of one investigation per candidate.

const AGGREGATOR_TOKENS = new Set([
  "linktr.ee",
  "linktree",
  "linktr",
  "beacons.ai",
  "beacons",
  "bio.link",
  "biolink",
  "linkin.bio",
  "lnk.bio",
  "taplink.cc",
  "taplink",
  "carrd.co",
  "carrd",
  "campsite.bio",
  "solo.to",
  "milkshake.app",
  "many.link",
  "linkme.bio",
  "flow.page",
  "linkpop.com",
]);

// Reserved / non-handle path segments that the social-URL regex sometimes
// captures as the "handle" (they're actually URL paths, not usernames).
const RESERVED_HANDLE_TOKENS = new Set([
  "p", "reel", "reels", "stories", "explore", "share", "sharer", "watch",
  "shorts", "user", "channel", "c", "tr", "business", "dialog", "help",
  "settings", "about", "privacy", "terms", "download", "login", "signup",
  "search", "post", "hashtag", "tag", "tv", "live", "story",
]);

export type AggregatorFlag = {
  detected: boolean;
  reason: string | null;
  suggestion: string | null;
};

export function checkAggregator(fieldName: string, value: string | null | undefined): AggregatorFlag {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    return { detected: false, reason: null, suggestion: null };
  }

  const v = value.trim().toLowerCase();

  // Rule 1 · known aggregators (highest confidence flag)
  if (AGGREGATOR_TOKENS.has(v)) {
    return {
      detected: true,
      reason: `"${value}" is a known link-aggregator service, not a ${prettyField(fieldName)} handle.`,
      suggestion: "Reject · agent's regex matched the aggregator URL path segment, not a real profile.",
    };
  }
  for (const tok of AGGREGATOR_TOKENS) {
    if (v === tok || v.includes(tok)) {
      return {
        detected: true,
        reason: `"${value}" contains known aggregator token "${tok}".`,
        suggestion: "Likely a false-positive from URL parsing. Verify against the business's actual profile page before approving.",
      };
    }
  }

  // Rule 2 · reserved handle tokens (regex-artifact)
  if (RESERVED_HANDLE_TOKENS.has(v)) {
    return {
      detected: true,
      reason: `"${value}" is a reserved URL path segment, not a user handle.`,
      suggestion: "Almost certainly a regex-extraction artifact. Reject unless proven otherwise.",
    };
  }

  // Rule 3 · URL-shaped value in a social-handle field (should be bare handle)
  if (isSocialField(fieldName) && looksLikeUrl(value)) {
    return {
      detected: true,
      reason: `"${value}" is a URL, not a bare handle. Expected format: 'username' or 'company-name'.`,
      suggestion: "Extract the actual handle from the URL before approving, or reject and let a future agent try again.",
    };
  }

  // Rule 4 · phone/whatsapp value length sanity (too short = likely wrong)
  if ((fieldName === "phone" || fieldName === "whatsapp_number")) {
    const digits = value.replace(/\D+/g, "");
    if (digits.length < 8) {
      return {
        detected: true,
        reason: `"${value}" has only ${digits.length} digits · too short to be a real phone number.`,
        suggestion: "Reject · likely a regex mis-match on an unrelated numeric string.",
      };
    }
    if (digits.length > 15) {
      return {
        detected: true,
        reason: `"${value}" has ${digits.length} digits · exceeds international phone spec (E.164 max 15).`,
        suggestion: "Reject · likely concatenated numbers or extraction error.",
      };
    }
  }

  return { detected: false, reason: null, suggestion: null };
}

function isSocialField(fieldName: string): boolean {
  return fieldName.startsWith("social:") || fieldName === "social";
}

function looksLikeUrl(v: string): boolean {
  return /^(https?:\/\/|www\.)/i.test(v) || v.includes("/");
}

function prettyField(fieldName: string): string {
  if (fieldName.startsWith("social:")) {
    return fieldName.slice("social:".length).replace(/^./, (c) => c.toUpperCase());
  }
  switch (fieldName) {
    case "whatsapp_number": return "WhatsApp";
    case "phone":           return "phone";
    case "website":         return "website";
    default:                return fieldName;
  }
}
