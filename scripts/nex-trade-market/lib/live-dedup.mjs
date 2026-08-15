// Live-Supabase deduplication engine · reusable across markets.
//
// Philip 2026-08-15: "when we start Germany/USA/Europe, the collector can
// check live production + historical datasets from the beginning, preventing
// this same problem from recurring at 10× the scale."
//
// This module is the shared truth-source dedup logic. Callers:
//   · scripts/nex-trade-market/stage5b-v2-live-dedup.mjs   (this import)
//   · future collector form validators (must import this)
//   · future international market imports (must import this)
//
// Verdicts (Philip's 4-bucket classification 2026-08-15):
//   INSERT                  · no collision · truly new business
//   LIVE_MERGE              · collision on domain/slug/phone/email AND name matches → merge into existing
//   LIVE_AMBIGUOUS_REVIEW   · collision on domain/slug/phone/email BUT name differs → human decision
//   MERGE_ALREADY_TARGETED  · this record already targeted an existing merge (Stage 4 catch)
//
// Match priority: domain > slug > phone(≥7) > email > postcode+name > name+town > fuzzy-name

export function normalizeName(s) {
  return (s || '').toLowerCase().replace(/\b(ltd|limited|llp|plc|co|company|inc|the)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
}
export function normalizePhone(s) { return (s || '').replace(/\D/g, ''); }
export function normalizeEmail(e) { return (e || '').toLowerCase().trim(); }
export function normalizePostcode(p) { return (p || '').replace(/\s+/g, '').toUpperCase(); }
export function normalizeDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch { return ''; }
}

/**
 * Build indexed lookup maps from a live table snapshot.
 * @param {Array<object>} rows · production rows with { id, slug, business_name, website, telephone, email, postcode, town }
 * @returns {object} · indexes keyed by identity signals
 */
export function buildLiveIndex(rows) {
  const idx = {
    byDomain: new Map(),
    bySlug: new Map(),
    byPhone: new Map(),
    byEmail: new Map(),
    byPcName: new Map(),
    byNameTown: new Map(),
    byNormName: new Map(),
  };
  for (const r of rows) {
    const d = normalizeDomain(r.website); if (d) idx.byDomain.set(d, r);
    if (r.slug) idx.bySlug.set(r.slug, r);
    const p = normalizePhone(r.telephone); if (p.length >= 7) idx.byPhone.set(p, r);
    const e = normalizeEmail(r.email); if (e) idx.byEmail.set(e, r);
    const pc = normalizePostcode(r.postcode);
    const n = normalizeName(r.business_name);
    const t = normalizeName(r.town);
    if (pc && n) idx.byPcName.set(`${pc}|${n}`, r);
    if (n && t) idx.byNameTown.set(`${n}|${t}`, r);
    if (n) idx.byNormName.set(n, r);
  }
  return idx;
}

/**
 * Classify an incoming record against the live index.
 * Returns { verdict, matches, primary_match }.
 */
export function classifyIncoming(rec, liveIndex) {
  const dom = normalizeDomain(rec.website);
  const phone = normalizePhone(rec.telephone);
  const email = normalizeEmail(rec.email);
  const slug = rec.slug;
  const name = normalizeName(rec.business_name);
  const town = normalizeName(rec.town);
  const pc = normalizePostcode(rec.postcode);

  const matches = [];
  const seenIds = new Set();
  const pushIf = (signal, other) => {
    if (other && !seenIds.has(other.id)) {
      matches.push({ signal, other_id: other.id, other_slug: other.slug, other_name: other.business_name });
      seenIds.add(other.id);
    } else if (other && seenIds.has(other.id)) {
      matches.push({ signal, other_id: other.id, other_slug: other.slug, other_name: other.business_name, corroborating: true });
    }
  };

  // Priority order · strongest first
  if (dom) pushIf('domain', liveIndex.byDomain.get(dom));
  if (slug) pushIf('slug', liveIndex.bySlug.get(slug));
  if (phone.length >= 7) pushIf('phone', liveIndex.byPhone.get(phone));
  if (email) pushIf('email', liveIndex.byEmail.get(email));
  if (pc && name) pushIf('postcode+name', liveIndex.byPcName.get(`${pc}|${name}`));
  if (name && town) pushIf('name+town', liveIndex.byNameTown.get(`${name}|${town}`));

  // Fuzzy name · only if no other match found
  if (matches.length === 0 && name && name.length >= 8) {
    for (const [otherNorm, other] of liveIndex.byNormName) {
      if (otherNorm === name || otherNorm.includes(name) || name.includes(otherNorm)) {
        pushIf('fuzzy-name', other);
        break;
      }
    }
  }

  if (matches.length === 0) return { verdict: 'INSERT', matches: [], primary_match: null };

  // Determine identity confidence.
  // Unique IDs matched (may be corroborated on multiple signals)
  const uniqueIds = new Set(matches.map(m => m.other_id));
  const primary = matches[0];

  // Name match test: normalised equality OR mutual substring (≥6 chars each)
  const incomingName = name;
  const targetName = normalizeName(primary.other_name);
  const nameMatches = incomingName === targetName
    || (incomingName.length >= 6 && targetName.length >= 6 && (incomingName.includes(targetName) || targetName.includes(incomingName)));

  // If all matches point to the SAME live record AND names match → LIVE_MERGE
  if (uniqueIds.size === 1 && nameMatches) {
    return { verdict: 'LIVE_MERGE', matches, primary_match: primary };
  }

  // If matches point to multiple different records, OR names don't match → AMBIGUOUS
  return { verdict: 'LIVE_AMBIGUOUS_REVIEW', matches, primary_match: primary };
}

/**
 * Batch classify + summarise for reporting.
 */
export function classifyBatch(records, liveIndex) {
  const results = records.map(r => ({ record: r, ...classifyIncoming(r, liveIndex) }));
  const summary = {
    insert: results.filter(r => r.verdict === 'INSERT').length,
    live_merge: results.filter(r => r.verdict === 'LIVE_MERGE').length,
    live_ambiguous_review: results.filter(r => r.verdict === 'LIVE_AMBIGUOUS_REVIEW').length,
  };
  return { results, summary };
}
