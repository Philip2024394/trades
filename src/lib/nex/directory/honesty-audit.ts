// src/lib/nex/directory/honesty-audit.ts
//
// Founder Phase 28 · P28-1 · Truth-in-advertising audit for directory listings.
//
// Reads a listing's website HTML and detects:
//   · "free" / "no cost" / "$0" claims
//   · "credit card required" · "credit card needed" · "billing information"
//   · "cancel anytime" · "no obligation" · "hidden fees"
//   · trial length in days
//   · subscription auto-renew signals
//
// Returns a structured verdict with EVIDENCE SPANS (the exact matched
// substring), so the directory card can display:
//   ✓ Free trial verified (no credit card)
//   ⚠ Free trial claim + credit card required (contradiction)
//   ⚠ Pricing not stated on landing page
//
// Discipline:
//   · deterministic pattern matching · NO LLM inference
//   · every verdict traces to matched spans
//   · when the site blocks scraping we return honest UNKNOWN

export interface HonestyClaim {
  kind: "free_claim" | "no_cost_claim" | "trial_offered" | "credit_card_required" | "credit_card_not_required" | "cancel_anytime" | "hidden_fees" | "auto_renew" | "subscription" | "trial_length_days";
  matched: string;              // exact substring
  detail?: string | number;     // for trial_length_days
}

export interface HonestyVerdict {
  listing_ref: string;
  url: string;
  fetched: boolean;
  http_status: number | null;
  bytes: number;
  claims: HonestyClaim[];
  contradictions: string[];     // e.g. "free_but_credit_card_required"
  overall: "verified_free_no_cc" | "free_with_cc_required" | "paid_only" | "trial_details_unclear" | "pricing_not_stated" | "unknown_site_blocked";
  overall_reason: string;
  fetched_at: string;
  request_ms: number;
}

const _PATTERNS = {
  free: [/\bfree\b/i, /\bno cost\b/i, /\$0\b/, /\bzero cost\b/i, /\bcompletely free\b/i, /\bfree forever\b/i],
  trial: [/\bfree trial\b/i, /\b\d+[- ]?day trial\b/i, /\btry it free\b/i, /\btry for free\b/i, /\bstart trial\b/i],
  cc_required: [/\bcredit card required\b/i, /\brequires? (a )?credit card\b/i, /\bbilling (info(rmation)?|details) required\b/i, /\benter (your )?(credit card|payment)\b/i, /\bcard details required\b/i, /\bpayment method (is )?required\b/i],
  cc_not_required: [/\bno credit card (required|needed)\b/i, /\bwithout (a )?credit card\b/i, /\bno card required\b/i, /\bno payment (info|method) required\b/i, /\bno billing (info|details) required\b/i],
  cancel_anytime: [/\bcancel any ?time\b/i, /\bcancel whenever\b/i, /\bno commitment\b/i, /\bno obligation\b/i],
  hidden_fees: [/\bhidden fees?\b/i, /\bhidden charges?\b/i, /\bsurcharge\b/i],
  auto_renew: [/\bauto[- ]?renew(al|s|ing|ed)?\b/i, /\brenews? automatically\b/i, /\brecurring (billing|charge)\b/i],
  subscription: [/\bsubscription\b/i, /\bmonthly plan\b/i, /\byearly plan\b/i, /\bannual plan\b/i, /\bpricing plan\b/i],
  trial_length: /\b(\d{1,3})[- ]?day (free )?trial\b/i,
};

function extractText(html: string): string {
  // Strip scripts + styles + tags · keep visible text · truncate to 200KB
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
                       .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const stripped = noScript.replace(/<[^>]+>/g, " ")
                           .replace(/&nbsp;/g, " ")
                           .replace(/&amp;/g, "&")
                           .replace(/&lt;/g, "<")
                           .replace(/&gt;/g, ">")
                           .replace(/&quot;/g, "\"")
                           .replace(/\s+/g, " ")
                           .trim();
  return stripped.length > 200_000 ? stripped.slice(0, 200_000) : stripped;
}

function collectMatches(text: string, patterns: RegExp[], kind: HonestyClaim["kind"]): HonestyClaim[] {
  const out: HonestyClaim[] = [];
  const seen = new Set<string>();
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && !seen.has(m[0].toLowerCase())) {
      out.push({ kind, matched: m[0].slice(0, 200) });
      seen.add(m[0].toLowerCase());
    }
  }
  return out;
}

/**
 * Fetches the given URL (best-effort · 8s timeout) and analyses the visible
 * text for pricing/trial honesty signals. Never invents · when fetch fails
 * we return overall="unknown_site_blocked" with fetched=false.
 */
export async function auditWebsiteHonesty(listing_ref: string, rawUrl: string): Promise<HonestyVerdict> {
  const t0 = performance.now();
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const nowIso = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "NEXHonestyAudit/1.0 (+https://nex.example/directory)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const html = await res.text();
    const text = extractText(html);
    const claims: HonestyClaim[] = [
      ...collectMatches(text, _PATTERNS.free, "free_claim"),
      ...collectMatches(text, _PATTERNS.trial, "trial_offered"),
      ...collectMatches(text, _PATTERNS.cc_required, "credit_card_required"),
      ...collectMatches(text, _PATTERNS.cc_not_required, "credit_card_not_required"),
      ...collectMatches(text, _PATTERNS.cancel_anytime, "cancel_anytime"),
      ...collectMatches(text, _PATTERNS.hidden_fees, "hidden_fees"),
      ...collectMatches(text, _PATTERNS.auto_renew, "auto_renew"),
      ...collectMatches(text, _PATTERNS.subscription, "subscription"),
    ];
    // Trial length capture
    const trialMatch = _PATTERNS.trial_length.exec(text);
    if (trialMatch) {
      claims.push({ kind: "trial_length_days", matched: trialMatch[0], detail: Number(trialMatch[1]) });
    }

    const hasFree = claims.some((c) => c.kind === "free_claim" || c.kind === "trial_offered");
    const ccReq = claims.some((c) => c.kind === "credit_card_required");
    const ccNo = claims.some((c) => c.kind === "credit_card_not_required");
    const paid = claims.some((c) => c.kind === "subscription" || c.kind === "auto_renew");
    const anyPricingSignal = hasFree || paid;

    const contradictions: string[] = [];
    if (hasFree && ccReq) contradictions.push("free_but_credit_card_required");
    if (ccReq && ccNo) contradictions.push("credit_card_both_stated");

    let overall: HonestyVerdict["overall"];
    let reason: string;
    if (hasFree && ccNo && !ccReq) {
      overall = "verified_free_no_cc";
      reason = "Site states free/trial AND explicitly no credit card required.";
    } else if (hasFree && ccReq) {
      overall = "free_with_cc_required";
      reason = "Site claims free trial but explicitly requires credit card.";
    } else if (paid && !hasFree) {
      overall = "paid_only";
      reason = "Site advertises subscription/plans · no free option detected.";
    } else if (hasFree && !ccReq && !ccNo) {
      overall = "trial_details_unclear";
      reason = "Free claim detected but credit-card requirement not stated on landing page.";
    } else if (!anyPricingSignal) {
      overall = "pricing_not_stated";
      reason = "No pricing signals detected on the landing page.";
    } else {
      overall = "trial_details_unclear";
      reason = "Mixed signals detected.";
    }

    return {
      listing_ref,
      url,
      fetched: true,
      http_status: res.status,
      bytes: html.length,
      claims,
      contradictions,
      overall,
      overall_reason: reason,
      fetched_at: nowIso,
      request_ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      listing_ref,
      url,
      fetched: false,
      http_status: null,
      bytes: 0,
      claims: [],
      contradictions: [],
      overall: "unknown_site_blocked",
      overall_reason: e instanceof Error ? e.message.slice(0, 120) : "fetch_failed",
      fetched_at: nowIso,
      request_ms: Math.round(performance.now() - t0),
    };
  }
}

export function shortBadgeFor(v: HonestyVerdict): { label: string; kind: "good" | "warn" | "neutral" | "bad" } {
  switch (v.overall) {
    case "verified_free_no_cc": return { label: "✓ Free · no credit card", kind: "good" };
    case "free_with_cc_required": return { label: "⚠ Free trial · card required", kind: "bad" };
    case "paid_only": return { label: "Paid plans only", kind: "neutral" };
    case "trial_details_unclear": return { label: "⚠ Trial details unclear", kind: "warn" };
    case "pricing_not_stated": return { label: "Pricing not stated", kind: "neutral" };
    case "unknown_site_blocked": return { label: "Site blocked scan", kind: "neutral" };
  }
}
