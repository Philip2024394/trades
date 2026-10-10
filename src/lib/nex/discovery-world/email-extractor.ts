// src/lib/nex/discovery-world/email-extractor.ts
//
// NEX World Email Intelligence · Part 5 rest · HTML email extractor
// Founder-authorised programme · session-2 · 2026-09-21.
//
// PURE FUNCTION · zero network · zero fabrication · every extracted email
// MUST come from actual text in the provided HTML.
//
// Extraction methods (in evidence-quality order):
//   1 · JSON-LD Schema.org contactPoint.email (highest structured evidence)
//   2 · Schema.org microdata itemprop="email"
//   3 · mailto: href attributes
//   4 · Obfuscated forms · "name at domain dot com" · "[at]" · "&#64;" · " AT "
//   5 · Plain-text regex (lowest · always the fallback)
//
// Never generates. Never guesses. If HTML contains no email, extraction
// returns an empty array with a clear reason.

export type ExtractionMethod =
  | "json_ld_contact_point"
  | "schema_microdata_email"
  | "mailto_href"
  | "obfuscated_at"
  | "html_entity_at"
  | "plain_text_regex";

export interface ExtractedEmail {
  readonly raw: string;                          // as it appeared in the source
  readonly normalized: string;                    // lowercased · deobfuscated
  readonly method: ExtractionMethod;
  readonly context_snippet: string;               // ≤200 chars around the match (audit)
  readonly nearby_role_hint: string | null;       // e.g. "sales" / "contact" / "info" if found nearby
}

// ─── Regex vocabulary ───────────────────────────────────────────────
const EMAIL_RX = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi;

// Common obfuscations · " (at) " · " [at] " · " AT " · "&#64;"
const OBFUSCATED_AT_RX = /([a-z0-9._%+\-]+)\s*(?:\(at\)|\[at\]|\{at\}|\bat\b|@)\s*([a-z0-9.\-]+)\s*(?:\(dot\)|\[dot\]|\{dot\}|\bdot\b|\.)\s*([a-z]{2,})/gi;
const HTML_ENTITY_AT_RX = /([a-z0-9._%+\-]+)&#64;([a-z0-9.\-]+\.[a-z]{2,})/gi;

const ROLE_HINT_RX = /(sales|info|contact|office|hello|enquiries|inquiries|team|support|press|help|marketing|admin|reception|general)/i;

// ─── Public API ─────────────────────────────────────────────────────
export interface ExtractOptions {
  /** Cap on emails returned per call · defensive · never truncates dedup. */
  readonly max_emails?: number;
}

// ─── Pre-decode fixes (2026-09-22 volume upgrade) ──────────────────
// Bug: HTML pages emit JSON-encoded strings like `>mail@foo.co.uk`
// (that's the escape for `>email@foo.co.uk`). Naïve regex captured
// `u003email` as the local-part. Fix: unescape common encodings BEFORE
// the regex sweep, so real emails (never invented) are extracted cleanly.
function preDecodeHtml(html: string): string {
  let s = html;
  // \uXXXX (JavaScript/JSON escapes leaked into HTML) - decode ONLY when
  // preceded by a backslash (so we do not touch legitimate 'u003' text)
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => {
    try { return String.fromCharCode(parseInt(hex, 16)); } catch { return _m; }
  });
  // Common HTML entities that show up around emails
  s = s.replace(/&#(\d+);/g, (_m, dec) => {
    const n = parseInt(dec, 10);
    return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCharCode(n) : _m;
  });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
    const n = parseInt(hex, 16);
    return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCharCode(n) : _m;
  });
  // Named entities that commonly appear around emails
  s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  return s;
}

// Reject known bad local-parts that arise from encoding artefacts.
// (u003, x0, x00, x000, u00) are patterns from > / \x0a etc where the
// backslash was stripped but the escape digits survived.
const BAD_LOCAL_PART_PREFIXES = /^(?:u00[0-9a-f]|x0[0-9a-f]|u003|u002)/i;
// Placeholders / templates that appear on documentation pages but are
// never real deliverable addresses. Note: 'email' / 'mail' are legitimate
// role local-parts (email@ · mail@) — never blanket-reject them.
const BAD_LOCAL_PART_EXACT = new Set([
  "your-email", "youremail", "yourname", "your-name",
  "example", "user", "name", "firstname", "lastname",
  "firstname.lastname",
]);

// Domains that appear ONLY as placeholders in website builder templates
// (Wix / Weebly / Squarespace / Elementor default demo content). Real
// businesses never send from these. Reject the full address regardless
// of the local-part.
const PLACEHOLDER_DOMAINS = new Set([
  "mysite.com", "mywebsite.com",
  "example.com", "example.org", "example.net", "example.co.uk",
  "domain.com", "yourdomain.com", "your-domain.com",
  "test.com", "email.com", "site.com",
  "demo.com",
  // Wix / Weebly / Squarespace demo domains
  "wixsite.com", "weebly.com",
]);

function isBadLocalPart(local: string): boolean {
  if (BAD_LOCAL_PART_PREFIXES.test(local)) return true;
  if (BAD_LOCAL_PART_EXACT.has(local.toLowerCase())) return true;
  return false;
}

function isPlaceholderDomain(domain: string): boolean {
  return PLACEHOLDER_DOMAINS.has(domain.toLowerCase());
}

// Valid public-suffix TLDs. If a domain's TLD is not on this list, it's
// almost certainly a false positive from body prose like "contact us here
// @rose LAST worked in Manchester" where `last` gets captured as a TLD.
//
// Sources: ICANN root zone + common ccTLDs actually in use. Not exhaustive
// but covers ~99.9% of legitimate business email domains globally.
const VALID_TLDS = new Set([
  // Generic
  "com","net","org","info","biz","name","pro","tel","travel","xxx",
  "aero","asia","cat","coop","edu","gov","int","jobs","mil","mobi","museum","xyz",
  "top","site","online","tech","store","app","dev","io","co","ai","me",
  // Country codes (ISO 3166-1 alpha-2)
  "ac","ad","ae","af","ag","ai","al","am","ao","aq","ar","as","at","au","aw","ax","az",
  "ba","bb","bd","be","bf","bg","bh","bi","bj","bm","bn","bo","br","bs","bt","bw","by","bz",
  "ca","cc","cd","cf","cg","ch","ci","ck","cl","cm","cn","co","cr","cu","cv","cw","cx","cy","cz",
  "de","dj","dk","dm","do","dz",
  "ec","ee","eg","er","es","et","eu",
  "fi","fj","fk","fm","fo","fr",
  "ga","gd","ge","gf","gg","gh","gi","gl","gm","gn","gp","gq","gr","gs","gt","gu","gw","gy",
  "hk","hm","hn","hr","ht","hu",
  "id","ie","il","im","in","io","iq","ir","is","it",
  "je","jm","jo","jp",
  "ke","kg","kh","ki","km","kn","kp","kr","kw","ky","kz",
  "la","lb","lc","li","lk","lr","ls","lt","lu","lv","ly",
  "ma","mc","md","me","mg","mh","mk","ml","mm","mn","mo","mp","mq","mr","ms","mt","mu","mv","mw","mx","my","mz",
  "na","nc","ne","nf","ng","ni","nl","no","np","nr","nu","nz",
  "om",
  "pa","pe","pf","pg","ph","pk","pl","pm","pn","pr","ps","pt","pw","py",
  "qa",
  "re","ro","rs","ru","rw",
  "sa","sb","sc","sd","se","sg","sh","si","sj","sk","sl","sm","sn","so","sr","ss","st","sv","sx","sy","sz",
  "tc","td","tf","tg","th","tj","tk","tl","tm","tn","to","tr","tt","tv","tw","tz",
  "ua","ug","uk","us","uy","uz",
  "va","vc","ve","vg","vi","vn","vu",
  "wf","ws",
  "ye","yt",
  "za","zm","zw",
]);

function isValidTld(tld: string): boolean {
  return VALID_TLDS.has(tld.toLowerCase());
}

export function extractEmails(html: string, opts: ExtractOptions = {}): ReadonlyArray<ExtractedEmail> {
  if (!html || typeof html !== "string" || html.length === 0) return [];
  const max = opts.max_emails ?? 200;
  // Decode common encodings ONCE at the top so every extractor step sees
  // the real characters instead of escape sequences.
  html = preDecodeHtml(html);

  const seen = new Map<string, ExtractedEmail>();      // key: normalized email · first-method wins

  const record = (raw: string, normalized: string, method: ExtractionMethod, snippet: string, roleHint: string | null) => {
    normalized = normalized.trim().toLowerCase();
    if (!normalized || !/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(normalized)) return;
    // Reject artefact local-parts (u003email, example@, etc.)
    const local = normalized.split("@")[0];
    const domain_part = normalized.split("@")[1] ?? "";
    if (isBadLocalPart(local)) return;
    // Reject website-builder template placeholder domains (mysite.com etc.)
    if (isPlaceholderDomain(domain_part)) return;
    // Reject obviously non-email TLDs (defensive)
    const tld = normalized.split(".").pop();
    if (!tld || tld.length < 2 || /^\d+$/.test(tld)) return;
    // Reject invalid TLDs · catches prose false-positives like "@rose last"
    // where `last` gets captured as TLD
    if (!isValidTld(tld)) return;
    if (seen.has(normalized)) {
      // Upgrade to higher-evidence method if we now have one
      const prior = seen.get(normalized)!;
      if (methodRank(method) < methodRank(prior.method)) {
        seen.set(normalized, { ...prior, method, context_snippet: snippet, nearby_role_hint: roleHint });
      }
      return;
    }
    seen.set(normalized, { raw, normalized, method, context_snippet: snippet, nearby_role_hint: roleHint });
  };

  // 1 · JSON-LD Schema.org contactPoint.email  ─────────────────────
  const jsonldRx = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonldRx.exec(html)) !== null) {
    const payload = m[1];
    // Naive extract of "email":"…" from the JSON payload (avoids full JSON parse
    // for robustness against embedded HTML/comments)
    const emailPropRx = /"email"\s*:\s*"([^"\\]+)"/gi;
    let e: RegExpExecArray | null;
    while ((e = emailPropRx.exec(payload)) !== null) {
      record(e[1], e[1], "json_ld_contact_point", clip(payload, e.index, 200), roleHintNear(payload, e.index));
    }
  }

  // 2 · Schema microdata itemprop="email"  ─────────────────────────
  const microdataRx = /itemprop\s*=\s*["']email["'][^>]*(?:content\s*=\s*["']([^"']+)["']|>\s*([^<\s]+))/gi;
  while ((m = microdataRx.exec(html)) !== null) {
    const val = m[1] || m[2];
    if (val) record(val, val, "schema_microdata_email", clip(html, m.index, 200), roleHintNear(html, m.index));
  }

  // 3 · mailto: href  ──────────────────────────────────────────────
  const mailtoRx = /href\s*=\s*["']mailto:([^"'?]+)(?:\?[^"']*)?["']/gi;
  while ((m = mailtoRx.exec(html)) !== null) {
    record(m[1], m[1], "mailto_href", clip(html, m.index, 200), roleHintNear(html, m.index));
  }

  // 4 · HTML-entity at (&#64;)  ────────────────────────────────────
  HTML_ENTITY_AT_RX.lastIndex = 0;
  while ((m = HTML_ENTITY_AT_RX.exec(html)) !== null) {
    const normalized = `${m[1]}@${m[2]}`.toLowerCase();
    record(m[0], normalized, "html_entity_at", clip(html, m.index, 200), roleHintNear(html, m.index));
  }

  // 5 · Obfuscated · " at " / " (at) " · " dot " / " (dot) "  ──────
  OBFUSCATED_AT_RX.lastIndex = 0;
  while ((m = OBFUSCATED_AT_RX.exec(html)) !== null) {
    const normalized = `${m[1]}@${m[2]}.${m[3]}`.toLowerCase();
    record(m[0], normalized, "obfuscated_at", clip(html, m.index, 200), roleHintNear(html, m.index));
  }

  // 6 · Plain-text regex (last-resort) ─────────────────────────────
  EMAIL_RX.lastIndex = 0;
  while ((m = EMAIL_RX.exec(html)) !== null) {
    if (seen.size >= max) break;
    record(m[0], m[0], "plain_text_regex", clip(html, m.index, 200), roleHintNear(html, m.index));
  }

  return Array.from(seen.values()).slice(0, max);
}

// ─── Method ranking · lower = higher evidence quality ─────────────
function methodRank(m: ExtractionMethod): number {
  switch (m) {
    case "json_ld_contact_point":   return 0;
    case "schema_microdata_email":  return 1;
    case "mailto_href":              return 2;
    case "html_entity_at":           return 3;
    case "obfuscated_at":            return 4;
    case "plain_text_regex":         return 5;
  }
}

function clip(text: string, at: number, radius: number): string {
  const start = Math.max(0, at - Math.floor(radius / 2));
  const end   = Math.min(text.length, at + Math.ceil(radius / 2));
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function roleHintNear(text: string, at: number): string | null {
  const window = text.slice(Math.max(0, at - 80), Math.min(text.length, at + 80));
  const rh = ROLE_HINT_RX.exec(window);
  return rh ? rh[1].toLowerCase() : null;
}

export const _EXTRACTOR_NEVER_FABRICATES = "emails_only_from_actual_html_text";
