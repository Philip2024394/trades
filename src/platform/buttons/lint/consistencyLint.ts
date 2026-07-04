// Button consistency lint — pure engine.
//
// Given a set of button instances (extracted from layout JSON across
// pages), returns issues:
//
//   • drift              multiple distinct variants play the same role
//                        across pages — merchant probably wanted one
//   • label_drift        the same role has different labels ("Contact
//                        us" vs "Get in touch") across pages
//   • href_drift         the same role points at different hrefs
//   • orphan_role        role bound to a Global that no longer exists
//   • tone_conflict      labels within a page mix formal + playful
//
// The engine returns structured issues so the UI can offer per-issue
// fixes (normalise to the majority variant / Global button / most-used
// label / etc.).

export type ButtonInstanceForLint = {
  pageId: string;
  pageName: string;
  instanceId: string;
  role: string;
  variantKey: string;
  label: string;
  href: string;
  globalRefRole?: string;
};

export type LintIssue =
  | {
      kind: "drift";
      role: string;
      variants: {
        variantKey: string;
        occurrences: number;
        pages: string[];
      }[];
      recommendation: string;
    }
  | {
      kind: "label_drift";
      role: string;
      labels: { label: string; occurrences: number; pages: string[] }[];
      recommendation: string;
    }
  | {
      kind: "href_drift";
      role: string;
      hrefs: { href: string; occurrences: number; pages: string[] }[];
      recommendation: string;
    }
  | {
      kind: "orphan_role";
      role: string;
      pages: string[];
      recommendation: string;
    }
  | {
      kind: "tone_conflict";
      pageId: string;
      pageName: string;
      labels: string[];
      recommendation: string;
    };

export type LintReport = {
  totalButtons: number;
  totalPages: number;
  issues: LintIssue[];
  /** Roll-up score 0-100 — 100 = zero issues; each issue drops the
   *  score with diminishing returns so a merchant with a few
   *  intentional exceptions doesn't tank to zero. */
  consistencyScore: number;
};

// ─── Entry point ─────────────────────────────────────────

export function lintButtons(args: {
  instances: ButtonInstanceForLint[];
  knownGlobalRoles: string[];
}): LintReport {
  const { instances, knownGlobalRoles } = args;
  const issues: LintIssue[] = [];

  // Group by role.
  const byRole = new Map<string, ButtonInstanceForLint[]>();
  for (const inst of instances) {
    const bucket = byRole.get(inst.role) ?? [];
    bucket.push(inst);
    byRole.set(inst.role, bucket);
  }

  for (const [role, bucket] of byRole) {
    // ─── Drift ────────────────────────────
    const variantCounts = countBy(bucket, (i) => i.variantKey);
    if (variantCounts.size > 1 && bucket.length >= 2) {
      const majorityKey = argmax(variantCounts);
      const variants = Array.from(variantCounts.entries()).map(
        ([variantKey, occurrences]) => ({
          variantKey,
          occurrences,
          pages: uniqueBy(
            bucket.filter((b) => b.variantKey === variantKey),
            (b) => b.pageName
          )
        })
      );
      issues.push({
        kind: "drift",
        role,
        variants: variants.sort((a, b) => b.occurrences - a.occurrences),
        recommendation: `Set a Global for "${role}" and normalise to ${majorityKey} (used ${variantCounts.get(majorityKey)}×).`
      });
    }

    // ─── Label drift ─────────────────────
    const labelCounts = countBy(
      bucket.filter((b) => b.label.trim().length > 0),
      (i) => normaliseLabel(i.label)
    );
    if (labelCounts.size > 1 && bucket.length >= 2) {
      const majority = argmax(labelCounts);
      const labels = Array.from(labelCounts.entries()).map(
        ([label, occurrences]) => ({
          label,
          occurrences,
          pages: uniqueBy(
            bucket.filter((b) => normaliseLabel(b.label) === label),
            (b) => b.pageName
          )
        })
      );
      issues.push({
        kind: "label_drift",
        role,
        labels: labels.sort((a, b) => b.occurrences - a.occurrences),
        recommendation: `Standardise the label on "${majority}" or set it via Global.`
      });
    }

    // ─── Href drift ──────────────────────
    const hrefCounts = countBy(
      bucket.filter((b) => b.href.trim().length > 0),
      (i) => i.href.trim().toLowerCase()
    );
    if (hrefCounts.size > 1 && bucket.length >= 2) {
      const majority = argmax(hrefCounts);
      const hrefs = Array.from(hrefCounts.entries()).map(
        ([href, occurrences]) => ({
          href,
          occurrences,
          pages: uniqueBy(
            bucket.filter((b) => b.href.trim().toLowerCase() === href),
            (b) => b.pageName
          )
        })
      );
      issues.push({
        kind: "href_drift",
        role,
        hrefs: hrefs.sort((a, b) => b.occurrences - a.occurrences),
        recommendation: `Point all "${role}" buttons at "${majority}".`
      });
    }

    // ─── Orphan role → global that doesn't exist ─
    const globallyBound = bucket.filter((b) => b.globalRefRole);
    for (const b of globallyBound) {
      if (b.globalRefRole && !knownGlobalRoles.includes(b.globalRefRole)) {
        issues.push({
          kind: "orphan_role",
          role: b.role,
          pages: [b.pageName],
          recommendation: `Global "${b.globalRefRole}" no longer exists — detach or create.`
        });
        break; // one issue per role
      }
    }
  }

  // Tone-conflict — per page: if page has labels that MIX formal +
  // playful tones. Naive but useful signal.
  const byPage = new Map<string, ButtonInstanceForLint[]>();
  for (const inst of instances) {
    const bucket = byPage.get(inst.pageId) ?? [];
    bucket.push(inst);
    byPage.set(inst.pageId, bucket);
  }
  for (const [pageId, bucket] of byPage) {
    const tones = bucket.map((b) => toneOf(b.label));
    if (tones.includes("playful") && tones.includes("formal")) {
      const pageName = bucket[0]?.pageName ?? pageId;
      issues.push({
        kind: "tone_conflict",
        pageId,
        pageName,
        labels: bucket.map((b) => b.label).filter((l) => l.trim().length > 0),
        recommendation:
          "Pick one tone per page. Playful ('Grab yours') next to formal ('Please contact us') reads inconsistent."
      });
    }
  }

  // Score
  const rawPenalty = issues.reduce((acc, iss) => {
    switch (iss.kind) {
      case "drift":
        return acc + 20;
      case "label_drift":
        return acc + 15;
      case "href_drift":
        return acc + 12;
      case "orphan_role":
        return acc + 10;
      case "tone_conflict":
        return acc + 6;
    }
  }, 0);
  const consistencyScore = Math.max(0, Math.min(100, 100 - rawPenalty));

  return {
    totalButtons: instances.length,
    totalPages: byPage.size,
    issues,
    consistencyScore
  };
}

// ─── Helpers ─────────────────────────────────────────

function countBy<T>(arr: T[], key: (item: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of arr) {
    const k = key(it);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function argmax<T>(m: Map<T, number>): T {
  let best: T | undefined;
  let bestVal = -Infinity;
  for (const [k, v] of m) {
    if (v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best as T;
}

function uniqueBy<T>(arr: T[], key: (item: T) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of arr) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Case + whitespace + punctuation-fold. "Contact us" and "Contact
 *  Us!" fold to the same key so they don't count as drift. */
function normaliseLabel(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
}

const PLAYFUL_MARKERS = /grab|yours|score|snag|nab|steal|smash|slay|bag/i;
const FORMAL_MARKERS = /please|kindly|inquire|enquire|discuss|regarding/i;

function toneOf(label: string): "playful" | "formal" | "neutral" {
  if (PLAYFUL_MARKERS.test(label)) return "playful";
  if (FORMAL_MARKERS.test(label)) return "formal";
  return "neutral";
}
