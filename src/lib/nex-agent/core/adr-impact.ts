// src/lib/nex-agent/core/adr-impact.ts
//
// NEX Agent v1.3-T · ADR IMPACT analyser.
// Given a feature description, nex1 emits an ADR IMPACT REPORT:
//   ADR-0300 · No Supabase · PASS
//   ADR-0022 · Image sourcing · PASS
//   ADR-0003 · Commercial model · PASS
//   D-006    · Verification required · PASS
//
// This is the seed of a real Architecture Guardian. Every plan will eventually
// carry an ADR IMPACT block · nex2 verifies · nex3 signs off · founder approves.
//
// V1.3-T scoring: nex1 must (a) name the relevant ADRs, (b) give correct
// adjudication (PASS · FAIL · ATTENTION), (c) reference doctrine when relevant.

import { readFile } from "../tools";

export type Adjudication = "PASS" | "FAIL" | "ATTENTION";
export interface ADRImpact {
  ref: string;                 // 'ADR-0300' | 'D-006' | 'ADR-0022' etc.
  title: string;
  adjudication: Adjudication;
  reasoning: string;           // one sentence · why PASS / FAIL / ATTENTION
  cited_from?: string;         // file path where the ADR lives
}
export interface ADRImpactReport {
  feature_description: string;
  affected_areas: string[];
  impacts: ADRImpact[];
  overall_verdict: "safe" | "attention_required" | "blocked";
  blockers: string[];
}

// ─── The ADR catalogue nex1 knows about ─────────────────────────
// Populated from rules/architecture.json (immutable_adrs · key_adrs_to_honor)
// + rules/NEX-CODING-DOCTRINE.md (D-001..D-008).
// Each ADR carries KEYWORDS · when nex1 sees the feature description, it checks
// whether any keyword hits → adjudication.
interface ADRRule {
  ref: string;                 // 'ADR-0300' | 'D-006'
  title: string;
  trigger_keywords: RegExp[];  // if match → adjudication default is FAIL
  adjudicate_fn?: (feature: string) => Adjudication;   // override
  reasoning_pass: string;       // what to say when PASS
  reasoning_fail: string;       // what to say when triggered
}
const ADR_RULES: ADRRule[] = [
  { ref: "ADR-0300", title: "Phase out Supabase · new features route to pg directly",
    trigger_keywords: [/@supabase\//i, /supabase-js/i, /supabase\.co/i, /createClient.*supabase/i, /SUPABASE_/],
    reasoning_pass: "No supabase references detected in the feature description.",
    reasoning_fail: "Feature references @supabase/* which is forbidden in new modules. Route to `pg` directly."
  },
  { ref: "ADR-0022", title: "No third-party image copy · merchant/ODbL/CC only",
    trigger_keywords: [/googleusercontent\.com\/.*photo/i, /fbcdn\.net/i, /cdninstagram\.com/i, /copy.*(?:google|facebook|instagram).*(?:image|photo)/i, /scrape.*(?:image|photo)/i],
    reasoning_pass: "No third-party image copy patterns detected.",
    reasoning_fail: "Feature would copy images from a forbidden third-party source. Use merchant-uploaded or Wikimedia Commons only."
  },
  { ref: "ADR-0003", title: "Never sell leads · never take commission · fixed subscription only",
    trigger_keywords: [/commission/i, /per-lead-fee/i, /shortlist.*charge/i, /lead.*sale/i, /take.*(\d+)%.*(?:transaction|booking)/i],
    reasoning_pass: "No commission / lead-sale patterns in the feature.",
    reasoning_fail: "Feature implies commission or lead-sale. Not permitted. Use fixed subscription only."
  },
  { ref: "ADR-0023", title: "Directory imports store text only · never fabricate",
    trigger_keywords: [/fabricat/i, /invent.*data/i, /auto.*verify/i],
    reasoning_pass: "No fabrication / auto-verify patterns detected.",
    reasoning_fail: "Feature suggests auto-verification or fabricated data · ADR-0023 forbids."
  },
  { ref: "ADR-0028", title: "Preserve knowledge · every LLM output verified before authoritative",
    trigger_keywords: [/(?:llm|gpt).*(?:decide|authoritative|truth|apply)/i, /trust.*llm/i],
    reasoning_pass: "Feature does not treat LLM output as authoritative truth.",
    reasoning_fail: "Feature would treat LLM output as truth without verification · ADR-0028 forbids."
  },
  { ref: "ADR-0033", title: "Quality over quantity · brain isolation · <70 confidence fails save",
    trigger_keywords: [/cross-domain.*brain/i, /general brain/i, /skip.*confidence/i],
    reasoning_pass: "No brain-isolation violations detected.",
    reasoning_fail: "Feature would blur brain boundaries or bypass confidence gate · ADR-0033 forbids."
  },
  { ref: "D-001", title: "Every new file must start with a `//` (or `--`) summary comment",
    trigger_keywords: [/no comment/i, /skip.*header/i],
    reasoning_pass: "Convention applies · nex1 will add a leading summary comment.",
    reasoning_fail: "Feature description hints at skipping the mandatory file summary comment."
  },
  { ref: "D-002", title: "No @supabase/* in new NEX code",
    trigger_keywords: [/@supabase\//i, /supabase auth/i, /supabase storage/i],
    reasoning_pass: "No supabase in new-code path.",
    reasoning_fail: "Feature would introduce new @supabase/* import · D-002 forbids."
  },
  { ref: "D-003", title: "Migrations are append-only · never modify existing numbered file",
    trigger_keywords: [/modify.*migration/i, /edit.*(\d{3,4})_/, /alter existing migration/i],
    reasoning_pass: "No modification of existing migrations proposed.",
    reasoning_fail: "Feature would modify an existing numbered migration file · D-003 forbids."
  },
  { ref: "D-006", title: "Nex1 never claims complete before verification passes",
    // Always relevant · always PASS unless explicitly ignoring verification
    trigger_keywords: [/skip.*verification/i, /skip.*tests/i, /don't.*test/i, /bypass.*(?:typecheck|lint|verify)/i],
    reasoning_pass: "Feature will pass through the standard verification gate.",
    reasoning_fail: "Feature hints at skipping verification · D-006 forbids."
  },
];

// ─── Report generator ───────────────────────────────────────────
export function analyseADRImpact(featureDescription: string): ADRImpactReport {
  const desc = String(featureDescription || "");
  const impacts: ADRImpact[] = [];
  const blockers: string[] = [];
  const affected_areas: string[] = [];

  // Heuristic area detection
  if (/api|route|endpoint/i.test(desc)) affected_areas.push("src/app/api/");
  if (/migration|table|schema/i.test(desc)) affected_areas.push("db/migrations/");
  if (/library|module|lib/i.test(desc)) affected_areas.push("src/lib/nex/");
  if (/page|ui|component/i.test(desc)) affected_areas.push("src/app/");

  for (const rule of ADR_RULES) {
    const hit = rule.trigger_keywords.some(rx => rx.test(desc));
    const adj: Adjudication = hit ? "FAIL" : "PASS";
    const impact: ADRImpact = {
      ref: rule.ref,
      title: rule.title,
      adjudication: adj,
      reasoning: hit ? rule.reasoning_fail : rule.reasoning_pass,
      cited_from: rule.ref.startsWith("ADR-") ? `docs/DECISIONS/${rule.ref.replace("ADR-", "").padStart(4, "0")}-*.md` : `rules/NEX-CODING-DOCTRINE.md`,
    };
    if (adj === "FAIL") blockers.push(`${rule.ref} · ${rule.title}`);
    impacts.push(impact);
  }

  const overall: ADRImpactReport["overall_verdict"] = blockers.length > 0 ? "blocked" : impacts.some(i => i.adjudication === "ATTENTION") ? "attention_required" : "safe";
  return { feature_description: desc, affected_areas, impacts, overall_verdict: overall, blockers };
}

// Optional · reads the actual ADR file to enrich the "cited_from" context (used by future UI · not required)
export async function enrichImpactWithADRText(impact: ADRImpact): Promise<{ ref: string; excerpt: string | null }> {
  if (!impact.cited_from) return { ref: impact.ref, excerpt: null };
  const r = readFile(impact.cited_from.replace(/\*/g, ""), 8_000);
  return { ref: impact.ref, excerpt: r.ok ? String((r.data as { content: string }).content).slice(0, 500) : null };
}
