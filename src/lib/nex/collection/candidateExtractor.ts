// Path C · HTML → structured CandidateReport extractor.
//
// Regex-based extraction of email · phone · UK postcode · company name ·
// address · evidence quotes. NEVER fabricates missing data — every field
// stays null when not present in the source HTML.
//
// MULTI-SERVICE CLASSIFICATION (Philip 2026-08-13):
//   The extractor emits a `capabilities` map (RefacingCapabilityKey → "yes")
//   containing every service the company's own website PROVES it performs.
//   A company may perform MANY services simultaneously (a single business
//   often manufactures new staircases AND refurbishes existing ones AND
//   installs balustrades) — the classifier NEVER forces the site into a
//   single category. Downstream, the queue processor uses this map to
//   populate directory_seeds.capabilities so one company = one record with
//   multiple service tags rather than duplicate records per service.
//
//   Six top-level service categories are detected independently:
//     · staircase_manufacture      (new-build staircases)
//     · installation               (installing pre-made staircases / balustrades)
//     · staircase_refurbishment    (broad · restore/renovate/repair existing)
//     · staircase_refacing         (specific · cover/clad/overlay existing structure)
//     · staircase_cladding         (cladding component work — covering treads/risers)
//     · bespoke_joinery            (custom joinery capability — often paired w/ manufacture)
//
//   Plus supporting granular capabilities (tread_replacement, riser_replacement,
//   handrail, baluster, sanding, staining, etc.) when the site names them.
//
// EVIDENCE-DRIVEN, NEVER GUESSED:
//   The user's brief: "don't require the website to literally say refacing.
//   For example, StairFurb describes replacing the visible parts of an existing
//   staircase without replacing the whole structure — that's exactly the kind of
//   evidence NEX should recognise as refurbishment/refacing." Signal banks below
//   deliberately include component-replacement + surface-treatment + existing-
//   staircase language, not just the literal "refacing" token.

import "server-only";
import type { FetchOk } from "./candidateFetcher";
import type { RefacingCapabilityKey } from "@/lib/nex/centre-publishing/directorySeedLoader";

export type CandidateReport = {
  source_url: string;
  final_url: string;
  followed_urls: string[];

  company_name: string | null;
  description: string | null;

  email: string | null;
  email_source_url: string | null;
  phone: string | null;
  postcode: string | null;

  address_line_1: string | null;
  town: string | null;
  county: string | null;

  evidence_snippet: string | null;
  evidence_source_url: string | null;

  /** Multi-service classification. Only "yes" capabilities appear (absence ≠ no).
   *  Downstream code populates directory_seeds.capabilities from this map. */
  capabilities: Partial<Record<RefacingCapabilityKey, "yes">>;

  /** Top-level service axis flags · convenience derivations from `capabilities`
   *  used by the admin dashboard to render the six-checkbox row per URL. */
  services: {
    staircase_manufacture: boolean;
    installation: boolean;
    staircase_refurbishment: boolean;
    staircase_refacing: boolean;
    staircase_cladding: boolean;
    bespoke_joinery: boolean;
  };

  refacing_qualification: "A+" | "A" | "B" | "C" | "excluded";
  qualification_reasoning: string;

  /** Derived classification label (Philip 2026-08-13 · standing worker rule).
   *  Candidate URLs are RAW research — the worker MUST classify them
   *  independently based on the site's own content. Never trust the dump. */
  classification:
    | "REFACING"
    | "MANUFACTURE"
    | "BOTH"
    | "INSTALLER"
    | "SUPPLIER"
    | "NOT_RELEVANT"
    | "NEEDS_REVIEW";

  /** Evidence-driven confidence score 0-100 (Philip 2026-08-13 · NEX Brain
   *  Confidence Rule · memory: project_nex_brain_confidence_rule_2026_08_13.md).
   *  ≥80 auto-passes to save/merge · <80 lands in the human review queue.
   *  NEVER inflated · NEVER awarded to help a record pass · rubric points are
   *  earned only by fields the extractor actually found in the source HTML. */
  confidence_score: number;

  /** Per-signal breakdown of how the score was assembled, so the admin can
   *  see WHY a record scored what it did without re-running the extractor. */
  confidence_breakdown: {
    company_name:      number;   // 0 or 20
    email:             number;   // 0 or 15
    phone:             number;   // 0 or 15
    postcode:          number;   // 0 or 10
    services:          number;   // 0 or 15
    multi_service:     number;   // 0 or 5
    evidence:          number;   // 0 or 10
    qualification:     number;   // 0 · 5 · 10
    total:             number;   // sum · always ≤ 100
  };
};

// ─── Signal banks · service detection ─────────────────────────────
// Each bank drives ONE independent yes/no. A phrase list is authoritative
// for the service — never inferred. If no phrase matches → capability is
// NOT asserted (absence ≠ negative claim).

const NEGATIVE_KEYWORDS = [
  "new build staircase only",
  "we only manufacture new",
  "no refurbishment",
  "does not offer refurbishment",
  "we do not refurbish",
];

/** Manufacture · designing + constructing a NEW staircase from scratch. */
const MANUFACTURE_KEYWORDS = [
  "manufacture", "manufacturing", "we manufacture", "custom staircase",
  "bespoke staircase", "made to measure staircase", "new staircase",
  "staircase design and build", "designed and manufactured",
  "workshop", "cnc", "our workshop",
];

/** Installation · fitting a staircase / balustrade on site (usually new). */
const INSTALLATION_KEYWORDS = [
  "installation", "we install", "fit", "fitting", "on-site install",
  "install your staircase", "we fit", "fitted by our team",
];

/** Refurbishment · broad restoration/renovation/repair language covering ANY
 *  work on an EXISTING staircase (restoration, sanding down, repainting,
 *  spindle swap, damaged tread repair, etc.). */
const REFURBISHMENT_KEYWORDS = [
  "staircase refurbishment", "stair refurbishment",
  "staircase renovation", "stair renovation",
  "staircase makeover", "stair makeover",
  "staircase restoration", "stair restoration",
  "restore your staircase", "restoring staircases",
  "staircase repair", "stair repair", "repair your staircase",
  "staircase refresh", "refresh your staircase",
  "revamp your staircase", "revamp your stairs",
  "modernise your staircase", "modernise your stairs",
  "modernize your staircase", "modernize your stairs",
  "update your staircase", "update your stairs",
  "transform your staircase", "transform your stairs",
  "give your stairs a new look", "give your staircase a new look",
  "renovate your staircase", "renovate your stairs",
  "breathe new life into your staircase", "breathing new life into your stairs",
  "existing staircase", "existing stairs",
];

/** Refacing · SPECIFIC subset of refurbishment where the visible surfaces are
 *  replaced/covered without rebuilding the structural stringers. This is what
 *  the user called out with the StairFurb example — component-replacement +
 *  covering language, not the literal word "refacing". */
const REFACING_KEYWORDS = [
  "refacing", "reface", "refaced",
  "over your existing stairs", "over the existing staircase",
  "over existing staircase", "over existing stairs",
  "fit over existing", "fitted over your existing",
  "cladding over", "cover existing staircase",
  "covering your existing",
  "overcladding", "overlay",
  // Component-replacement (visible parts) — user's key ask
  "replace the visible parts", "replacing the visible parts",
  "replace your treads", "replacement treads",
  "replace your risers", "replacement risers",
  "replacement treads and risers", "new treads and risers",
  "swap treads", "swap the risers",
  "resurface", "re-surface", "re surface",
  "without replacing the whole staircase", "without a full rebuild",
  "keep your existing structure", "existing structure",
];

/** Cladding-specific · covering a component surface with a new material. */
const CLADDING_KEYWORDS = [
  "stair cladding", "staircase cladding", "cladding kit",
  "tread cladding", "riser cladding", "step cladding",
  "clad the treads", "clad your stairs",
];

/** Bespoke joinery · often paired with manufacture but a distinct capability. */
const JOINERY_KEYWORDS = [
  "bespoke joinery", "joinery", "joiner", "joiners",
  "custom joinery", "handcrafted joinery",
];

/** Supplier · parts / materials commerce (no on-site service). Used to detect
 *  companies whose site is a shop for stair parts rather than a service trade.
 *  Many refacing companies ALSO sell parts, so SUPPLIER only wins as the
 *  primary classification when service signals are absent. */
const SUPPLIER_KEYWORDS = [
  "stair parts", "stair components", "trade counter",
  "trade prices", "trade account", "wholesale",
  "add to cart", "add to basket", "shopping basket", "shopping cart",
  "in stock", "delivery available", "next day delivery",
  "buy stair parts", "shop stair", "stair parts shop",
  "our range of stair", "browse our range",
];

// ─── Granular components (populate the finer capability keys) ─────
const COMPONENT_SIGNALS: Array<[RefacingCapabilityKey, string[]]> = [
  ["tread_replacement",     ["tread replacement", "replace your treads", "new treads"]],
  ["riser_replacement",     ["riser replacement", "replace your risers", "new risers"]],
  ["tread_and_riser_replacement", ["treads and risers", "tread and riser"]],
  ["handrail",              ["handrail", "hand rail"]],
  ["baserail",              ["baserail", "base rail"]],
  ["newel",                 ["newel post", "newel"]],
  ["baluster",              ["baluster"]],
  ["spindle",               ["spindle", "spindles"]],
  ["glass_balustrade",      ["glass balustrade", "glass panels"]],
  ["stainless_steel_balustrade", ["stainless steel balustrade", "stainless balustrade"]],
  ["metal_balustrade",      ["metal balustrade", "metal spindles"]],
  ["sanding",               ["sand your stairs", "sanding staircase", "staircase sanding"]],
  ["staining",              ["stain your stairs", "stained treads", "stair staining"]],
  ["painting",              ["paint your stairs", "painted stairs", "stair painting"]],
  ["varnishing",            ["varnish", "varnishing"]],
  ["repair",                ["stair repair", "staircase repair", "repair your staircase"]],
];

// B-band (weak) staircase signal — used only for qualification, not services.
const WEAK_STAIRCASE_SIGNALS = [
  "staircase", "stairs", "stair", "banister", "handrail", "newel", "spindle",
  "balustrade", "carpenter", "joiner",
];

/** Build a CandidateReport by scanning the primary page + followed pages. */
export function extractCandidateReport(fetched: FetchOk): CandidateReport {
  const surfaces = [
    { url: fetched.finalUrl, html: fetched.html },
    ...fetched.followedPages,
  ];
  const combinedText = surfaces
    .map((s) => htmlToText(s.html))
    .join("\n\n---\n\n");
  const combinedLower = combinedText.toLowerCase();

  // ── Extractions ─────────────────────────────────────────────
  const emailFinding = findEmail(surfaces);
  const phone        = findUKPhoneCombined(surfaces);
  const postcode     = findUKPostcode(combinedText);
  const companyName  = findCompanyName(fetched.html);
  const description  = findMetaDescription(fetched.html);

  // ── Service detection (independent per axis · absence ≠ no) ─
  const negatives = NEGATIVE_KEYWORDS.filter((k) => combinedLower.includes(k));
  const hasManufacture   = anyKeyword(combinedLower, MANUFACTURE_KEYWORDS);
  const hasInstallation  = anyKeyword(combinedLower, INSTALLATION_KEYWORDS);
  const hasRefurbishment = anyKeyword(combinedLower, REFURBISHMENT_KEYWORDS);
  const hasRefacing      = anyKeyword(combinedLower, REFACING_KEYWORDS);
  const hasCladding      = anyKeyword(combinedLower, CLADDING_KEYWORDS);
  const hasJoinery       = anyKeyword(combinedLower, JOINERY_KEYWORDS);

  const capabilities: Partial<Record<RefacingCapabilityKey, "yes">> = {};
  if (hasManufacture)   capabilities.staircase_manufacture   = "yes";
  if (hasInstallation)  capabilities.installation            = "yes";
  if (hasRefurbishment) capabilities.staircase_refurbishment = "yes";
  // Refacing evidence implies refurbishment too (refacing is a refurbishment
  // technique) — makes downstream filtering simpler.
  if (hasRefacing) {
    capabilities.staircase_refacing      = "yes";
    capabilities.staircase_refurbishment = "yes";
  }
  if (hasCladding) {
    capabilities.staircase_cladding = "yes";
    capabilities.staircase_covering = "yes";
  }
  if (hasJoinery) capabilities.bespoke_joinery = "yes";

  // Granular component signals — populate the fine-grained keys the tagger UI
  // uses. Silent when a signal isn't present.
  for (const [key, phrases] of COMPONENT_SIGNALS) {
    if (anyKeyword(combinedLower, phrases)) capabilities[key] = "yes";
  }

  // Convenience top-level service map for the admin dashboard.
  const services = {
    staircase_manufacture:   hasManufacture,
    installation:            hasInstallation,
    staircase_refurbishment: hasRefurbishment || hasRefacing,
    staircase_refacing:      hasRefacing,
    staircase_cladding:      hasCladding,
    bespoke_joinery:         hasJoinery,
  };

  const hasSupplier = anyKeyword(combinedLower, SUPPLIER_KEYWORDS);
  const evidenceFinding = findEvidenceQuote(surfaces, hasRefacing, hasRefurbishment);

  // ── Qualification (kept for backwards compat + card ranking) ──
  //   A+  refacing/covering language present  (strongest signal for refacing exchange)
  //   A   refurbishment/renovation/restore language present (no explicit refacing)
  //   B   only generic staircase-trade language + at least 3 matches
  //   C   weak signal (1-2 generic staircase terms · no refurbishment evidence)
  //   excluded  negative keyword OR no staircase-related terms at all
  //
  // Note: qualification is EVIDENCE + RANKING, never a gate — per Philip
  // 2026-08-13 doctrine. paid_member alone is the enquiry-channel gate.
  let qualification: CandidateReport["refacing_qualification"];
  let reasoning: string;
  const weakHits = WEAK_STAIRCASE_SIGNALS.filter((k) => combinedLower.includes(k));

  if (negatives.length > 0) {
    qualification = "excluded";
    reasoning = `Negative signal: "${negatives.join('", "')}"`;
  } else if (hasRefacing) {
    qualification = "A+";
    reasoning = `Refacing evidence · ${listServices(services)}`;
  } else if (hasRefurbishment) {
    qualification = "A";
    reasoning = `Refurbishment evidence · ${listServices(services)}`;
  } else if (hasCladding || hasManufacture || hasInstallation || hasJoinery) {
    qualification = "B";
    reasoning = `Adjacent staircase-trade evidence · ${listServices(services)}`;
  } else if (weakHits.length >= 3) {
    qualification = "B";
    reasoning = `Generic staircase-trade language only (${weakHits.length} matches, no refurbishment terms)`;
  } else if (weakHits.length > 0) {
    qualification = "C";
    reasoning = `Weak signal · few staircase terms and no refurbishment mention`;
  } else {
    qualification = "excluded";
    reasoning = `No staircase-related terms found in extracted text`;
  }

  // ── Classification derivation (Philip 2026-08-13 · standing worker rule) ─
  //
  // Rule 6 in project_nex_trade_card_rule_2026_08_13.md: workers must classify
  // every candidate URL independently. Never trust the dump's label.
  //
  //   NEEDS_REVIEW  — negative signal · OR no staircase language at all
  //   BOTH          — manufactures new AND refurbishes/refaces existing
  //   REFACING      — refurbishes/refaces existing (no manufacture evidence)
  //   MANUFACTURE   — makes new staircases (no refurbishment evidence)
  //   INSTALLER     — installation-only (no manufacture / no refurbishment)
  //   SUPPLIER      — parts/materials commerce · no service signal
  //   NOT_RELEVANT  — reserved for admin override · extractor never emits it
  //                    directly (an unreachable site or empty extraction is
  //                    NEEDS_REVIEW, not NOT_RELEVANT — the human decides).
  let classification: CandidateReport["classification"];
  if (negatives.length > 0) {
    classification = "NEEDS_REVIEW";
  } else if (hasRefurbishment && hasManufacture) {
    classification = "BOTH";
  } else if (hasRefacing || hasRefurbishment) {
    classification = hasManufacture ? "BOTH" : "REFACING";
  } else if (hasManufacture) {
    classification = "MANUFACTURE";
  } else if (hasInstallation) {
    classification = "INSTALLER";
  } else if (hasSupplier) {
    classification = "SUPPLIER";
  } else if (hasJoinery && weakHits.length >= 2) {
    // Joinery + some staircase mention · human decides whether it's a real fit.
    classification = "NEEDS_REVIEW";
  } else {
    classification = "NEEDS_REVIEW";
  }

  // ── Confidence scoring (Philip 2026-08-13 · NEX Brain Confidence Rule) ───
  //
  // Evidence-driven rubric · 100 pts total. NEVER inflate to help a record
  // pass. NEVER fabricate a field to raise a score. Missing stays missing.
  // See docs and memory: project_nex_brain_confidence_rule_2026_08_13.md.
  //
  //   Company name (og:site_name or clean <title>) — 20
  //   Email (visible in HTML, not blocklisted)      — 15
  //   UK phone (01/02/03/07 · 11 digits)            — 15
  //   UK postcode                                    — 10
  //   ≥1 service capability = yes                    — 15
  //   Multi-service (≥2 capabilities)                — 5
  //   Evidence quote captured (≥20 chars)           — 10
  //   Qualification A+/A: 10 · B: 5 · C/excluded: 0 — up to 10
  //                                          TOTAL — 100
  const capabilityYesCount = Object.values(capabilities).filter((v) => v === "yes").length;
  const breakdown = {
    company_name:  companyName ? 20 : 0,
    email:         emailFinding.email ? 15 : 0,
    phone:         phone ? 15 : 0,
    postcode:      postcode ? 10 : 0,
    services:      capabilityYesCount >= 1 ? 15 : 0,
    multi_service: capabilityYesCount >= 2 ? 5 : 0,
    evidence:      evidenceFinding.snippet ? 10 : 0,
    qualification:
      qualification === "A+" || qualification === "A" ? 10 :
      qualification === "B"                            ? 5  :
      /* C or excluded */                                0,
    total: 0, // filled below
  };
  breakdown.total =
    breakdown.company_name +
    breakdown.email +
    breakdown.phone +
    breakdown.postcode +
    breakdown.services +
    breakdown.multi_service +
    breakdown.evidence +
    breakdown.qualification;

  return {
    source_url: fetched.url,
    final_url: fetched.finalUrl,
    followed_urls: fetched.followedPages.map((p) => p.url),
    company_name: companyName,
    description,
    email: emailFinding.email,
    email_source_url: emailFinding.source_url,
    phone,
    postcode,
    address_line_1: null,
    town: null,
    county: null,
    evidence_snippet: evidenceFinding.snippet,
    evidence_source_url: evidenceFinding.source_url,
    capabilities,
    services,
    refacing_qualification: qualification,
    qualification_reasoning: reasoning,
    classification,
    confidence_score: breakdown.total,
    confidence_breakdown: breakdown,
  };
}

// ─── helpers ──────────────────────────────────────────────────────

function anyKeyword(haystackLower: string, needles: readonly string[]): boolean {
  for (const n of needles) if (haystackLower.includes(n)) return true;
  return false;
}

function listServices(s: CandidateReport["services"]): string {
  const on: string[] = [];
  if (s.staircase_refacing)      on.push("refacing");
  if (s.staircase_refurbishment) on.push("refurbishment");
  if (s.staircase_manufacture)   on.push("manufacture");
  if (s.installation)            on.push("installation");
  if (s.staircase_cladding)      on.push("cladding");
  if (s.bespoke_joinery)         on.push("bespoke joinery");
  return on.length ? on.join(" + ") : "no service axis detected";
}

/** Decode common HTML entities so titles/descriptions/quotes come out as
 *  human text · not `StairService &#8211; Professional...`.
 *
 *  Handles:
 *   · &nbsp;                              → space
 *   · &#nnn;   (decimal numeric entity)   → chr(nnn)   e.g. &#8211; → –
 *   · &#xHH;   (hex numeric entity)       → chr(0xHH)  e.g. &#x2013; → –
 *   · named entities in NAMED_ENTITIES    → their character
 *
 *  Unknown named entities are left as-is (safer than guessing wrong). Pure
 *  function · never throws. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",  lt: "<",   gt: ">",   quot: '"',  apos: "'",
  nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", bull: "•", middot: "·",
  copy: "©", reg: "®", trade: "™",
  pound: "£", euro: "€", yen: "¥", cent: "¢",
  deg: "°", plusmn: "±", times: "×", divide: "÷",
  frac12: "½", frac14: "¼", frac34: "¾",
};

function decodeHtmlEntities(input: string): string {
  if (!input) return input;
  return input
    // Hex numeric first (must precede decimal or the digit pattern wins)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    // Decimal numeric entities · &#8211; → –
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = Number(dec);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    // Named entities · &ndash; → –
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(stripped)
    .replace(/\s+/g, " ")
    .trim();
}

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const EMAIL_BLOCKLIST = [
  "sentry.io", "example.com", "domain.com", "yourdomain",
  "@wixpress", "@shopify", "@squarespace",
  "wordpress.com", "@2x.png", "png", "@2x", "@3x",
];

// Anchored variant used for FULL-string validation (mailto: hrefs, decoded
// obfuscation output). The global EMAIL_RE above is for SCANNING body text
// for matches — different job.
const EMAIL_STRICT_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
function isValidEmail(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  if (!EMAIL_STRICT_RE.test(lower)) return false;
  if (EMAIL_BLOCKLIST.some((b) => lower.includes(b))) return false;
  if (/\.(png|jpg|jpeg|svg|webp|gif|css|js)$/i.test(lower)) return false;
  return true;
}

/**
 * Find every mailto: href on a page · returns the email addresses embedded
 * in `<a href="mailto:info@company.co.uk">`. Site owners publish these
 * deliberately so users can click to open their mail client — reading them
 * back is not fabrication, it's honouring the publisher's intent.
 */
function findMailtoHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']mailto:([^"'?]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = decodeHtmlEntities(m[1]).trim();
    // Strip any accidental query/subject suffix `mailto:a@b.co?subject=...`
    const clean = raw.split(/[?&]/)[0].trim();
    if (clean) out.push(clean);
  }
  return out;
}

/**
 * Decode a small set of common obfuscated email patterns intentionally used
 * by site owners to hide from naive scrapers:
 *
 *   info [at] company [dot] co [dot] uk    →  info@company.co.uk
 *   info(at)company(dot)co(dot)uk          →  info@company.co.uk
 *   info AT company DOT co DOT uk          →  info@company.co.uk
 *   info @ company . co . uk               →  info@company.co.uk (padded @/dots)
 *
 * Strict rules to avoid false positives:
 *   · The obfuscation MUST contain an "at" separator (bracketed / parens / spaces).
 *   · The reassembled string MUST pass the standard EMAIL_RE + blocklist.
 *   · Only the FIRST clean match per page is returned · we don't crawl for many.
 *
 * Never fabricates. If nothing matches, returns null.
 */
function findObfuscatedEmail(text: string): string | null {
  // Pattern: local  [ (at) | at ]  domainish  ([ (dot) | dot ] tld)+
  // Use a permissive scan then rebuild.
  const patterns: RegExp[] = [
    // "info [at] company [dot] co [dot] uk"  ·  brackets/parens with at/dot literals
    /([a-z0-9._%+-]+)\s*[\[\(]\s*(?:at|@)\s*[\]\)]\s*([a-z0-9.-]+(?:\s*[\[\(]\s*(?:dot|\.)\s*[\]\)]\s*[a-z0-9-]+)+)/gi,
    // "info AT company DOT co DOT uk"  ·  bare AT / DOT with spaces (case-insensitive)
    /([a-z0-9._%+-]+)\s+at\s+([a-z0-9-]+(?:\s+dot\s+[a-z0-9-]+)+)/gi,
    // "info @ company . co . uk"  ·  padded @/dots with spaces (min 1 space required)
    /([a-z0-9._%+-]+)\s+@\s+([a-z0-9-]+(?:\s+\.\s+[a-z0-9-]+)+)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.exec(text)) !== null) {
      const local = m[1];
      // Reassemble domain by stripping the obfuscation markers
      const domain = m[2]
        .replace(/[\[\(]\s*(?:dot|\.)\s*[\]\)]/gi, ".")
        .replace(/\s+dot\s+/gi, ".")
        .replace(/\s+\.\s+/g, ".")
        .replace(/\s+/g, "");
      const candidate = `${local}@${domain}`.toLowerCase();
      if (isValidEmail(candidate)) return candidate;
    }
  }
  return null;
}

function findEmail(surfaces: Array<{ url: string; html: string }>): { email: string | null; source_url: string | null } {
  // Preference order (Philip 2026-08-13):
  //   1. mailto: hrefs         — deliberately-published email links
  //   2. plain body-text email — visible on the page
  //   3. obfuscated email      — [at]/[dot] intent-to-publish patterns
  // Site owners publish contact channels intending them to be used · we honour
  // that intent. NEVER fabricated · every source respects the blocklist.
  for (const s of surfaces) {
    const mailtos = findMailtoHrefs(s.html);
    for (const raw of mailtos) {
      const lower = raw.toLowerCase();
      if (isValidEmail(lower)) return { email: lower, source_url: s.url };
    }
  }
  for (const s of surfaces) {
    const text = htmlToText(s.html);
    const matches = text.match(EMAIL_RE) ?? [];
    for (const raw of matches) {
      const lower = raw.toLowerCase();
      if (isValidEmail(lower)) return { email: lower, source_url: s.url };
    }
  }
  for (const s of surfaces) {
    const text = htmlToText(s.html);
    const decoded = findObfuscatedEmail(text);
    if (decoded) return { email: decoded, source_url: s.url };
  }
  return { email: null, source_url: null };
}

// UK phone: prefixes 01/02/03 (landline/nongeographic) or 07 (mobile) — 11 digits total after normalisation
const PHONE_RE = /(?:\+44\s?|0)(?:1|2|3|7)\d[\d\s().-]{8,14}/g;

function normaliseUkPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const normalised = digits.startsWith("44") ? "0" + digits.slice(2) : digits;
  if (normalised.length === 11 && /^0(1|2|3|7)/.test(normalised)) return raw.trim();
  return null;
}

/**
 * Extract tel: hrefs from `<a href="tel:+441619300000">Call us</a>`. Site
 * owners deliberately publish these to make click-to-call work on mobile —
 * reading them back is not fabrication.
 */
function findTelHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href\s*=\s*["']tel:([^"']+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const clean = m[1].trim();
    if (clean) out.push(clean);
  }
  return out;
}

function findUKPhone(text: string): string | null {
  const matches = text.match(PHONE_RE) ?? [];
  for (const raw of matches) {
    const n = normaliseUkPhone(raw);
    if (n) return n;
  }
  return null;
}

/**
 * Combined phone finder used by the pipeline · scans tel: hrefs across every
 * fetched surface first (highest-signal source), then falls back to visible
 * body text on the primary page + follow-pages.
 */
function findUKPhoneCombined(surfaces: Array<{ url: string; html: string }>): string | null {
  for (const s of surfaces) {
    for (const raw of findTelHrefs(s.html)) {
      const n = normaliseUkPhone(raw);
      if (n) return n;
    }
  }
  for (const s of surfaces) {
    const t = htmlToText(s.html);
    const found = findUKPhone(t);
    if (found) return found;
  }
  return null;
}

// UK postcode: A[A]N[NA/A/N] NAA (case-insensitive, optional space)
const POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
function findUKPostcode(text: string): string | null {
  const m = text.match(POSTCODE_RE);
  if (!m) return null;
  const raw = m[0].toUpperCase().replace(/\s+/g, " ").trim();
  if (!/\s/.test(raw) && raw.length >= 5) return raw.slice(0, raw.length - 3) + " " + raw.slice(-3);
  return raw;
}

function findCompanyName(html: string): string | null {
  const ogSite = /<meta[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html);
  if (ogSite?.[1]) return cleanTitle(ogSite[1]);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) return cleanTitle(title[1]);
  return null;
}
function cleanTitle(raw: string): string {
  // Decode entities FIRST · then split on delimiter · then trim. Otherwise a
  // title like "StairService &#8211; Professional..." keeps the raw entity
  // AND misses the em-dash split, producing an ugly single-string company
  // name AND an ugly slug.
  const decoded = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  const cut = decoded.split(/[\|·–—-]/)[0].trim();
  return cut.length >= 3 ? cut : decoded;
}

function findMetaDescription(html: string): string | null {
  const m = /<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html)
        ?? /<meta[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html);
  return m?.[1] ? decodeHtmlEntities(m[1]).replace(/\s+/g, " ").trim() : null;
}

/**
 * Find one sentence (from any surface) that contains a strong refacing or
 * refurbishment keyword — used as evidence_snippet in the saved seed.
 * Never fabricated. Prefer refacing evidence when available so A+ qualifications
 * carry the sharpest quote.
 */
function findEvidenceQuote(
  surfaces: Array<{ url: string; html: string }>,
  hasRefacing: boolean,
  hasRefurbishment: boolean,
): { snippet: string | null; source_url: string | null } {
  const banks: string[][] = [];
  if (hasRefacing) banks.push(REFACING_KEYWORDS);
  if (hasRefurbishment) banks.push(REFURBISHMENT_KEYWORDS);
  banks.push(CLADDING_KEYWORDS, MANUFACTURE_KEYWORDS, INSTALLATION_KEYWORDS, JOINERY_KEYWORDS);

  for (const bank of banks) {
    for (const s of surfaces) {
      const text = htmlToText(s.html);
      const sentences = text.split(/(?<=[.!?])\s+/);
      for (const kw of bank) {
        const hit = sentences.find((sent) => sent.toLowerCase().includes(kw));
        if (hit && hit.length >= 20 && hit.length <= 400) {
          return { snippet: hit.trim(), source_url: s.url };
        }
      }
    }
  }
  return { snippet: null, source_url: null };
}
