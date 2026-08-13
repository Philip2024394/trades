// scripts/refacing/dry-run-classify.mjs
//
// Dry-run the URL-queue classifier against a list of candidate URLs WITHOUT
// touching the database. Fetches each URL, extracts text, runs the same
// keyword-bank derivation the production extractor uses, and prints a per-URL
// report.
//
// Usage:
//   node scripts/refacing/dry-run-classify.mjs https://stairfurb.co.uk/ https://...
//   node scripts/refacing/dry-run-classify.mjs   (uses the built-in default list)
//
// Keyword banks MUST stay in sync with src/lib/nex/collection/candidateExtractor.ts.
// If you tune banks there, mirror the change here (or delete this file and run the
// worker against real DB — but the dry-run is the safer preview).

const DEFAULT_URLS = [
  "https://stairfurb.co.uk/",
  "https://staircase-refurbishment.co.uk/",
  "https://www.shawstairs.com/",
  "https://stairservice.co.uk/",
  "https://stairinnovations.co.uk/",
  "https://oakfactor.co.uk/",
];

// Real Chrome UA · many UK trade sites sit behind Cloudflare / bot-blockers
// that 520/403 anything with a "bot" User-Agent. Being a normal browser is the
// realistic way NEX will actually collect the market.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15_000;
const TOTAL_BUDGET_MS    = 45_000;
const MAX_HTML_BYTES     = 1_500_000;
const MAX_FOLLOWED_PAGES = 4;

// Follow-page hints (mirrors src/lib/nex/collection/candidateFetcher.ts).
const HINTS = [
  { tier: 1, needles: ["/contact","/contact-us","/contact_us","/contactus","/get-in-touch","/getintouch","/find-us","/findus","/reach-us","/enquiries","/enquiry","/enquire","/quote","/get-a-quote","/request-a-quote","/request-quote","/hello"], texts: ["contact us","contact","get in touch","get a quote","request a quote","enquire","reach us","find us"] },
  { tier: 2, needles: ["/about","/about-us","/about_us","/aboutus","/who-we-are","/whoweare","/our-story","/our-team"], texts: ["about us","about","who we are","our story","our team"] },
  { tier: 3, needles: ["/services","/what-we-do","/whatwedo","/our-services"], texts: ["services","what we do","our services"] },
  { tier: 4, needles: ["/service","/refurbishment","/refurb","/renovation","/renovations","/refacing","/staircase-refurbishment","/staircase-refacing","/staircases","/staircase","/stairs","/cladding","/overlay"], texts: ["refurbishment","renovation","refacing","staircase refurbishment","staircase renovation","staircases","stairs","cladding"] },
];

// ─── keyword banks (mirror src/lib/nex/collection/candidateExtractor.ts) ────

const NEGATIVE_KEYWORDS = [
  "new build staircase only",
  "we only manufacture new",
  "no refurbishment",
  "does not offer refurbishment",
  "we do not refurbish",
];

const MANUFACTURE_KEYWORDS = [
  "manufacture", "manufacturing", "we manufacture", "custom staircase",
  "bespoke staircase", "made to measure staircase", "new staircase",
  "staircase design and build", "designed and manufactured",
  "workshop", "cnc", "our workshop",
];

const INSTALLATION_KEYWORDS = [
  "installation", "we install", "fit", "fitting", "on-site install",
  "install your staircase", "we fit", "fitted by our team",
];

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

const REFACING_KEYWORDS = [
  "refacing", "reface", "refaced",
  "over your existing stairs", "over the existing staircase",
  "over existing staircase", "over existing stairs",
  "fit over existing", "fitted over your existing",
  "cladding over", "cover existing staircase",
  "covering your existing",
  "overcladding", "overlay",
  "replace the visible parts", "replacing the visible parts",
  "replace your treads", "replacement treads",
  "replace your risers", "replacement risers",
  "replacement treads and risers", "new treads and risers",
  "swap treads", "swap the risers",
  "resurface", "re-surface", "re surface",
  "without replacing the whole staircase", "without a full rebuild",
  "keep your existing structure", "existing structure",
];

const CLADDING_KEYWORDS = [
  "stair cladding", "staircase cladding", "cladding kit",
  "tread cladding", "riser cladding", "step cladding",
  "clad the treads", "clad your stairs",
];

const JOINERY_KEYWORDS = [
  "bespoke joinery", "joinery", "joiner", "joiners",
  "custom joinery", "handcrafted joinery",
];

const SUPPLIER_KEYWORDS = [
  "stair parts", "stair components", "trade counter",
  "trade prices", "trade account", "wholesale",
  "add to cart", "add to basket", "shopping basket", "shopping cart",
  "in stock", "delivery available", "next day delivery",
  "buy stair parts", "shop stair", "stair parts shop",
  "our range of stair", "browse our range",
];

const WEAK_STAIRCASE_SIGNALS = [
  "staircase", "stairs", "stair", "banister", "handrail", "newel", "spindle",
  "balustrade", "carpenter", "joiner",
];

// ─── helpers ─────────────────────────────────────────────────────────────

function anyKeyword(hayLower, needles) {
  for (const n of needles) if (hayLower.includes(n)) return true;
  return false;
}

function whichKeywords(hayLower, needles, cap = 4) {
  const hits = [];
  for (const n of needles) {
    if (hayLower.includes(n)) hits.push(n);
    if (hits.length >= cap) break;
  }
  return hits;
}

const NAMED_ENTITIES = {
  amp:"&", lt:"<", gt:">", quot:'"', apos:"'",
  nbsp:" ", ndash:"–", mdash:"—", hellip:"…",
  laquo:"«", raquo:"»", lsquo:"‘", rsquo:"’",
  ldquo:"“", rdquo:"”", bull:"•", middot:"·",
  copy:"©", reg:"®", trade:"™",
  pound:"£", euro:"€", yen:"¥", cent:"¢",
  deg:"°", plusmn:"±", times:"×", divide:"÷",
  frac12:"½", frac14:"¼", frac34:"¾",
};
function decodeHtmlEntities(input) {
  if (!input) return input;
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const cp = Number(dec);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : _;
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function htmlToText(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

function findCompanyName(html) {
  const ogSite = /<meta[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(html);
  if (ogSite?.[1]) return cleanTitle(ogSite[1]);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) return cleanTitle(title[1]);
  return null;
}
function cleanTitle(raw) {
  const decoded = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  const cut = decoded.split(/[\|·–—-]/)[0].trim();
  return cut.length >= 3 ? cut : decoded;
}

function findEvidenceQuote(text, hasRefacing, hasRefurbishment) {
  const banks = [];
  if (hasRefacing) banks.push(REFACING_KEYWORDS);
  if (hasRefurbishment) banks.push(REFURBISHMENT_KEYWORDS);
  banks.push(CLADDING_KEYWORDS, MANUFACTURE_KEYWORDS, INSTALLATION_KEYWORDS, JOINERY_KEYWORDS);
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const bank of banks) {
    for (const kw of bank) {
      const hit = sentences.find((s) => s.toLowerCase().includes(kw));
      if (hit && hit.length >= 20 && hit.length <= 400) return hit.trim();
    }
  }
  return null;
}

async function fetchHtml(url, budgetMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { ok: false, error: `content-type: ${contentType}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const capped = buf.subarray(0, MAX_HTML_BYTES);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(capped);
    return { ok: true, finalUrl: res.url, html };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function extractRankedLinks(html, baseOrigin) {
  const bestByHref = new Map();
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(m[1]);
    if (!hrefMatch) continue;
    const rawHref = hrefMatch[1].trim();
    if (!rawHref || /^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;
    let abs;
    try { abs = new URL(rawHref, baseOrigin).toString(); } catch { continue; }
    if (!abs.startsWith(baseOrigin)) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|doc|docx|xls|xlsx)(\?|$)/i.test(abs)) continue;
    const hrefKey = abs.split("#")[0];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const hrefLower = hrefKey.toLowerCase();
    let bestTier = null;
    for (const hint of HINTS) {
      const urlHit = hint.needles.some((n) => hrefLower.includes(n));
      const textHit = hint.texts.some((n) => text.includes(n));
      if (urlHit || textHit) {
        if (bestTier === null || hint.tier < bestTier) bestTier = hint.tier;
      }
    }
    if (bestTier === null) continue;
    const prev = bestByHref.get(hrefKey);
    if (prev === undefined || bestTier < prev) bestByHref.set(hrefKey, bestTier);
  }
  return Array.from(bestByHref.entries()).map(([href, tier]) => ({ href, tier })).sort((a, b) => a.tier - b.tier);
}

async function fetchSurface(startUrl) {
  const start = Date.now();
  const primary = await fetchHtml(startUrl);
  if (!primary.ok) return primary;
  const baseOrigin = new URL(primary.finalUrl).origin;
  const followed = [];
  const ranked = extractRankedLinks(primary.html, baseOrigin);
  const seen = new Set([primary.finalUrl.split("#")[0]]);
  const shortlist = [];
  for (const l of ranked) {
    const k = l.href.split("#")[0];
    if (seen.has(k)) continue;
    seen.add(k);
    shortlist.push(l);
    if (shortlist.length >= MAX_FOLLOWED_PAGES) break;
  }
  for (const l of shortlist) {
    if (Date.now() - start > TOTAL_BUDGET_MS) break;
    const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
    const budget = Math.max(3_000, Math.min(REQUEST_TIMEOUT_MS, remaining));
    const sub = await fetchHtml(l.href, budget);
    if (sub.ok) followed.push({ url: sub.finalUrl, tier: l.tier, html: sub.html });
  }
  return { ok: true, finalUrl: primary.finalUrl, html: primary.html, followed };
}

const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;
const EMAIL_STRICT_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const EMAIL_BLOCKLIST = ["sentry.io","example.com","domain.com","yourdomain","@wixpress","@shopify","@squarespace","wordpress.com","@2x.png","png","@2x","@3x"];
function isValidEmail(candidate) {
  const lower = candidate.toLowerCase();
  if (!EMAIL_STRICT_RE.test(lower)) return false;
  if (EMAIL_BLOCKLIST.some((b) => lower.includes(b))) return false;
  if (/\.(png|jpg|jpeg|svg|webp|gif|css|js)$/i.test(lower)) return false;
  return true;
}
function findMailtoHrefs(html) {
  const out = [];
  const re = /href\s*=\s*["']mailto:([^"'?]+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = decodeHtmlEntities(m[1]).trim();
    const clean = raw.split(/[?&]/)[0].trim();
    if (clean) out.push(clean);
  }
  return out;
}
function findObfuscatedEmail(text) {
  const patterns = [
    /([a-z0-9._%+-]+)\s*[\[\(]\s*(?:at|@)\s*[\]\)]\s*([a-z0-9.-]+(?:\s*[\[\(]\s*(?:dot|\.)\s*[\]\)]\s*[a-z0-9-]+)+)/gi,
    /([a-z0-9._%+-]+)\s+at\s+([a-z0-9-]+(?:\s+dot\s+[a-z0-9-]+)+)/gi,
    /([a-z0-9._%+-]+)\s+@\s+([a-z0-9-]+(?:\s+\.\s+[a-z0-9-]+)+)/gi,
  ];
  for (const p of patterns) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(text)) !== null) {
      const local = m[1];
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
function findEmail(surfaces) {
  // Preference: mailto: hrefs → body text → obfuscated. Return {email, source, kind}
  for (const s of surfaces) {
    for (const raw of findMailtoHrefs(s.html)) {
      const lower = raw.toLowerCase();
      if (isValidEmail(lower)) return { email: lower, source_url: s.url, kind: "mailto" };
    }
  }
  for (const s of surfaces) {
    const text = htmlToText(s.html);
    const matches = text.match(EMAIL_RE) ?? [];
    for (const raw of matches) {
      const lower = raw.toLowerCase();
      if (isValidEmail(lower)) return { email: lower, source_url: s.url, kind: "body" };
    }
  }
  for (const s of surfaces) {
    const text = htmlToText(s.html);
    const decoded = findObfuscatedEmail(text);
    if (decoded) return { email: decoded, source_url: s.url, kind: "obfuscated" };
  }
  return { email: null, source_url: null, kind: null };
}

const PHONE_RE = /(?:\+44\s?|0)(?:1|2|3|7)\d[\d\s().-]{8,14}/g;
function normaliseUkPhone(raw) {
  const digits = raw.replace(/[^\d]/g, "");
  const normalised = digits.startsWith("44") ? "0" + digits.slice(2) : digits;
  if (normalised.length === 11 && /^0(1|2|3|7)/.test(normalised)) return raw.trim();
  return null;
}
function findTelHrefs(html) {
  const out = [];
  const re = /href\s*=\s*["']tel:([^"']+)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const clean = m[1].trim();
    if (clean) out.push(clean);
  }
  return out;
}
function findUKPhone(text) {
  const matches = text.match(PHONE_RE) ?? [];
  for (const raw of matches) {
    const n = normaliseUkPhone(raw);
    if (n) return n;
  }
  return null;
}
function findUKPhoneCombined(surfaces) {
  for (const s of surfaces) {
    for (const raw of findTelHrefs(s.html)) {
      const n = normaliseUkPhone(raw);
      if (n) return { phone: n, kind: "tel" };
    }
  }
  for (const s of surfaces) {
    const t = htmlToText(s.html);
    const found = findUKPhone(t);
    if (found) return { phone: found, kind: "body" };
  }
  return { phone: null, kind: null };
}

/** NEX Brain Confidence Score rubric (mirror of candidateExtractor.ts). */
function scoreConfidence({ companyName, email, phone, postcode, capYesCount, evidence, qualification }) {
  const b = {
    company_name:  companyName ? 20 : 0,
    email:         email ? 15 : 0,
    phone:         phone ? 15 : 0,
    postcode:      postcode ? 10 : 0,
    services:      capYesCount >= 1 ? 15 : 0,
    multi_service: capYesCount >= 2 ? 5 : 0,
    evidence:      evidence ? 10 : 0,
    qualification: qualification === "A+" || qualification === "A" ? 10 : qualification === "B" ? 5 : 0,
  };
  const total = Object.values(b).reduce((a, n) => a + n, 0);
  return { breakdown: b, total };
}

function classify(text) {
  const lower = text.toLowerCase();
  const negatives = NEGATIVE_KEYWORDS.filter((k) => lower.includes(k));
  const hasManufacture   = anyKeyword(lower, MANUFACTURE_KEYWORDS);
  const hasInstallation  = anyKeyword(lower, INSTALLATION_KEYWORDS);
  const hasRefurbishment = anyKeyword(lower, REFURBISHMENT_KEYWORDS);
  const hasRefacing      = anyKeyword(lower, REFACING_KEYWORDS);
  const hasCladding      = anyKeyword(lower, CLADDING_KEYWORDS);
  const hasJoinery       = anyKeyword(lower, JOINERY_KEYWORDS);
  const hasSupplier      = anyKeyword(lower, SUPPLIER_KEYWORDS);
  const weakHits         = WEAK_STAIRCASE_SIGNALS.filter((k) => lower.includes(k));

  const services = {
    staircase_manufacture:   hasManufacture,
    installation:            hasInstallation,
    staircase_refurbishment: hasRefurbishment || hasRefacing,
    staircase_refacing:      hasRefacing,
    staircase_cladding:      hasCladding,
    bespoke_joinery:         hasJoinery,
  };

  let qualification, qualReason;
  if (negatives.length > 0) { qualification = "excluded"; qualReason = `neg: ${negatives.join(", ")}`; }
  else if (hasRefacing)      { qualification = "A+"; qualReason = "refacing evidence"; }
  else if (hasRefurbishment) { qualification = "A"; qualReason = "refurbishment evidence"; }
  else if (hasCladding || hasManufacture || hasInstallation || hasJoinery) {
    qualification = "B"; qualReason = "adjacent trade evidence";
  } else if (weakHits.length >= 3) { qualification = "B"; qualReason = `${weakHits.length} weak staircase terms`; }
  else if (weakHits.length > 0)    { qualification = "C"; qualReason = "very weak"; }
  else                              { qualification = "excluded"; qualReason = "no staircase language"; }

  let classification;
  if (negatives.length > 0) classification = "NEEDS_REVIEW";
  else if (hasRefurbishment && hasManufacture) classification = "BOTH";
  else if (hasRefacing || hasRefurbishment) classification = hasManufacture ? "BOTH" : "REFACING";
  else if (hasManufacture) classification = "MANUFACTURE";
  else if (hasInstallation) classification = "INSTALLER";
  else if (hasSupplier) classification = "SUPPLIER";
  else if (hasJoinery && weakHits.length >= 2) classification = "NEEDS_REVIEW";
  else classification = "NEEDS_REVIEW";

  return {
    services, classification, qualification, qualReason,
    hits: {
      manufacture:   whichKeywords(lower, MANUFACTURE_KEYWORDS),
      installation:  whichKeywords(lower, INSTALLATION_KEYWORDS),
      refurbishment: whichKeywords(lower, REFURBISHMENT_KEYWORDS),
      refacing:      whichKeywords(lower, REFACING_KEYWORDS),
      cladding:      whichKeywords(lower, CLADDING_KEYWORDS),
      joinery:       whichKeywords(lower, JOINERY_KEYWORDS),
      supplier:      whichKeywords(lower, SUPPLIER_KEYWORDS),
    },
    weakStaircaseHits: weakHits.length,
  };
}

// ─── main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const urls = args.length > 0 ? args : DEFAULT_URLS;

  console.log("");
  console.log(`Dry-run classifier · ${urls.length} URL${urls.length === 1 ? "" : "s"}`);
  console.log("=".repeat(70));

  for (const url of urls) {
    console.log("");
    console.log(`URL:  ${url}`);
    const res = await fetchSurface(url);
    if (!res.ok) {
      console.log(`  ✗ fetch failed: ${res.error}`);
      continue;
    }
    const surfaces = [{ url: res.finalUrl, html: res.html }, ...res.followed.map((f) => ({ url: f.url, html: f.html }))];
    const combinedText = surfaces.map((s) => htmlToText(s.html)).join("\n\n---\n\n");
    const company = findCompanyName(res.html);
    const email   = findEmail(surfaces);
    const phoneResult = findUKPhoneCombined(surfaces);
    const phone = phoneResult.phone;
    // Quick postcode extract for scoring parity (matches production regex)
    const pcMatch = combinedText.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i);
    const postcode = pcMatch ? pcMatch[0].toUpperCase() : null;
    const c = classify(combinedText);
    const evidence = findEvidenceQuote(combinedText, c.services.staircase_refacing, c.services.staircase_refurbishment);
    const capYesCount = Object.values(c.services).filter(Boolean).length;
    const score = scoreConfidence({
      companyName: company,
      email: email.email,
      phone,
      postcode,
      capYesCount,
      evidence,
      qualification: c.qualification,
    });
    const route = score.total >= 80 ? "PASS ≥80 · auto-save" : "REVIEW <80 · human queue";

    console.log(`  final url:      ${res.finalUrl}`);
    if (res.followed.length) {
      console.log(`  followed pages: ${res.followed.length}`);
      for (const f of res.followed) console.log(`    · [T${f.tier}] ${f.url}`);
    } else {
      console.log(`  followed pages: 0`);
    }
    console.log(`  company (og):   ${company ?? "(not found)"}`);
    console.log(`  email:          ${email.email ?? "(not found)"}${email.kind ? `  [${email.kind}]` : ""}${email.source_url && email.source_url !== res.finalUrl ? `  ← ${email.source_url}` : ""}`);
    console.log(`  phone (UK):     ${phone ?? "(not found)"}${phoneResult.kind ? `  [${phoneResult.kind}]` : ""}`);
    console.log(`  classification: ${c.classification}`);
    console.log(`  qualification:  ${c.qualification}  · ${c.qualReason}`);
    console.log(`  confidence:     ${score.total}/100  →  ${route}`);
    const brk = score.breakdown;
    console.log(`    name:${brk.company_name} email:${brk.email} phone:${brk.phone} pc:${brk.postcode} svc:${brk.services} multi:${brk.multi_service} evid:${brk.evidence} qual:${brk.qualification}`);
    console.log(`  services:`);
    for (const [k, v] of Object.entries(c.services)) {
      console.log(`    ${v ? "✓" : "·"} ${k}`);
    }
    const activeHits = Object.entries(c.hits).filter(([, arr]) => arr.length > 0);
    if (activeHits.length) {
      console.log(`  matched phrases:`);
      for (const [bank, arr] of activeHits) {
        console.log(`    ${bank}: ${arr.map((s) => `"${s}"`).join(", ")}`);
      }
    }
    console.log(`  weak staircase terms: ${c.weakStaircaseHits}`);
    if (evidence) console.log(`  evidence: "${evidence.slice(0, 200)}${evidence.length > 200 ? "..." : ""}"`);
  }

  console.log("");
  console.log("=".repeat(70));
  console.log("");
}

main().catch((err) => { console.error(err); process.exit(1); });
