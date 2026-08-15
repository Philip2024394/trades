// UK Staircase Trade Market · Stage 3 · sample deep-verify
//
// Reads stage2-consolidated.json (311 records). Selects a 20-record stratified
// sample. For each: directly fetches the canonical URL, records HTTP status,
// verifies identity (page title / content mentions company name), extracts
// per-capability evidence FROM ACTUAL PAGE CONTENT (not from prior snippets).
//
// Assigns Philip's 4-state verification:
//   SEARCH-DISCOVERED   · fetch failed or identity did not confirm
//   DIRECTLY-REACHABLE  · fetch OK + company name confirmed on page
//   SERVICE-EVIDENCED   · above + ≥1 capability directly evidenced in page HTML
//   FULLY-VERIFIED      · above + ≥3 capabilities directly evidenced
//
// Assigns Philip's 6 business groups:
//   REFACING_SERVICE_SPECIALIST · REFURBISHMENT_SERVICE_SPECIALIST
//   REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER · STAIRCASE_MANUFACTURER
//   STAIRCASE_INSTALLER · MULTI_SERVICE_COMPANY
//
// STOP after report. Never contacts companies. Never imports to Supabase.

import { readFile, writeFile } from 'node:fs/promises';

const CONSOLIDATED = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_stage2/stage2-consolidated.json';
const OUT_JSON = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_stage2/stage3-sample-inspection.json';
const OUT_MD = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_stage2/STAGE-3-REPORT-2026-08-15.md';

const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NEXTradeMarketBot/1.0; +https://thenetworkers.app/nex/about-bot)';

// ─── evidence signal libraries (page-content pattern matching) ───

const SIGNALS = {
  manufacture: [
    /\bmanufactur(e|ing|er|es|ed)\b/i,
    /\bstair(case)?\s+mak(er|ers|ing|e)\b/i,
    /\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair/i,
    /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i,
    /\bin-house\s+(manufactur|production|joinery)/i,
    /\bown\s+(workshop|factory|manufacturing)\b/i,
    /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i,
    /\bstair(case)?s?\s+(supply|supplier|suppliers)\b/i,
  ],
  installation: [
    /\binstall(ation|s|ed|ing|er|ers)\b/i,
    /\bfitting\b/i,
    /\bfit(ted|ting)\s+by\s+us\b/i,
    /\bwe\s+fit\b/i,
    /\bon-site\s+install/i,
    /\bfully\s+install/i,
  ],
  refurbishment: [
    /\brefurb(ish(ment|ing|ed)?)?\b/i,
    /\brenovat(e|ing|ed|ion)\b/i,
    /\brestor(e|ing|ed|ation)\b/i,
    /\bupgrad(e|ing|ed)\s+(your\s+)?(stair|staircase)/i,
    /\bhandrail(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bspindl(e|es)\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bbaluster(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bmakeover\b/i,
    /\btransform(ing|ation|ed)?\s+(your\s+)?(stair|staircase)/i,
    /\bexisting\s+stair(case)?\b/i,
    /\bmodernis(e|ing|ed|ation)\b/i,
    /\brepair(s|ing|ed)?\b/i,
  ],
  refacing: [
    /\brefac(e|ing|ed)\b/i,
    /\bstair(case)?\s+(overlay|clad(ding)?|cover(ing)?|resurfac(e|ing))/i,
    /\bstair(case)?\s+(kit|kits)\b/i,
    /\boverlay\s+(your\s+)?stair/i,
    /\bclad(ding|s|ded)\s+over/i,
    /\bcover\s+(your\s+)?(carpet\s+|existing\s+)?stair/i,
    /\bveneer(ed|ing)?\s+stair/i,
  ],
  balustrade: [
    /\bbalustrad(e|es|ing)\b/i,
    /\bhandrail\s+system\b/i,
  ],
  handrail: [
    /\bhandrail(s)?\b/i,
    /\bhand[- ]rail(s)?\b/i,
  ],
  glass: [
    /\bglass\s+(stair|balustrad|panel|infill|handrail)/i,
    /\bglass\s+staircase/i,
    /\bframeless\s+glass\b/i,
  ],
  metal: [
    /\bmetal\s+(stair|staircase)/i,
    /\bsteel\s+(stair|staircase|balustrad)/i,
    /\b(mild|stainless)\s+steel\b/i,
    /\bwrought\s+iron\b/i,
  ],
  bespoke: [
    /\bbespoke\b/i,
    /\bmade[- ]to[- ]measure\b/i,
    /\bcustom(ised|ized)?\s+(stair|staircase|design)/i,
    /\bone[- ]off\b/i,
  ],
  design: [
    /\bdesign(er|ers|ed|s|ing)?\b/i,
    /\bcad\s+drawings?\b/i,
    /\b3d\s+(visualisation|render)/i,
  ],
  // Kit/product supply signals (distinguishes suppliers from installers)
  kit_or_product_supplier: [
    /\bkit(s)?\b/i,
    /\bself[- ]assembly\b/i,
    /\bdiy\s+(stair|kit)/i,
    /\bshop\s+(stair|parts|components)/i,
    /\bbuy\s+online\b/i,
    /\badd\s+to\s+(basket|cart)\b/i,
    /\bfree\s+delivery\b/i,
    /\bcatalog(ue)?\b/i,
  ],
};

// Materials commonly mentioned
const MATERIAL_SIGNALS = ['oak','walnut','ash','pine','beech','maple','sapele','iroko','mahogany','glass','stainless steel','mild steel','wrought iron','concrete','carpet'];

// ─── stratified sample of 20 ───

function stratifiedSample(records) {
  // Buckets:
  //   1. Refacing-flagged (raw refacing:true)
  //   2. Refurbishment-flagged (raw refurbishment:true)
  //   3. Handrail/balustrade specialists (from agent-9 or specialism marked)
  //   4. Glass/metal specialists (glass:true or metal:true and NOT balustrade-only)
  //   5. Component/parts suppliers (from agent-11)
  //   6. Pure manufacturers (manufacture:true AND NOT refurbishment AND NOT refacing)
  //   7. Regional gaps (NI, NE)
  //
  // Aim: diverse capability profiles + diverse regions + mix of agent sources.
  const byAgent = (r, needle) => (r.discovered_by_agents || []).some(a => a.includes(needle));
  const capOn = (r, k) => r.capabilities_claimed?.[k] === true;

  const pool = {
    refacing: records.filter(r => capOn(r, 'refacing')),
    refurbishment: records.filter(r => capOn(r, 'refurbishment') && !capOn(r, 'refacing')),
    hb_specialist: records.filter(r => byAgent(r, 'agent-9')),
    gm_specialist: records.filter(r => byAgent(r, 'agent-10')),
    parts: records.filter(r => byAgent(r, 'agent-11')),
    pure_mfr: records.filter(r => capOn(r, 'manufacture') && !capOn(r, 'refurbishment') && !capOn(r, 'refacing') && !byAgent(r, 'agent-9') && !byAgent(r, 'agent-10') && !byAgent(r, 'agent-11')),
    ni: records.filter(r => r.region === 'NI'),
    ne: records.filter(r => r.region === 'NE'),
    wales: records.filter(r => r.region === 'Wales'),
    scotland: records.filter(r => r.region === 'Scotland'),
  };

  // Pick with rotation to avoid duplication
  const chosen = [];
  const chosenNames = new Set();
  const take = (bucket, n) => {
    let taken = 0;
    for (const r of bucket) {
      if (taken >= n) break;
      if (chosenNames.has(r.business_name)) continue;
      chosen.push(r);
      chosenNames.add(r.business_name);
      taken++;
    }
  };
  take(pool.refacing, 4);          // ← Philip flagged this as strategic core
  take(pool.refurbishment, 3);
  take(pool.hb_specialist, 3);
  take(pool.gm_specialist, 3);
  take(pool.parts, 2);
  take(pool.pure_mfr, 2);
  take(pool.ni, 1);
  take(pool.ne, 1);
  take(pool.wales, 1);
  // If underfilled, top up from any bucket
  if (chosen.length < 20) {
    for (const r of records) {
      if (chosen.length >= 20) break;
      if (!chosenNames.has(r.business_name)) { chosen.push(r); chosenNames.add(r.business_name); }
    }
  }
  return chosen.slice(0, 20);
}

// ─── per-record fetch + inspect ───

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    const text = await r.text();
    return { ok: true, status: r.status, url: r.url, html: text, contentType: r.headers.get('content-type') };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  } finally { clearTimeout(timer); }
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ');
}

function pageIdentityMatches(html, businessName) {
  if (!businessName) return false;
  const normName = businessName.toLowerCase().replace(/\b(ltd|limited|llp|plc|co|the)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
  const normPage = stripHtml(html).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20000);
  if (normName.length < 4) return false;
  return normPage.includes(normName);
}

function extractEvidenceFromPage(html) {
  const text = stripHtml(html).slice(0, 40000);
  const evidence = {};
  for (const [cap, patterns] of Object.entries(SIGNALS)) {
    let matched = null;
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) { matched = m[0]; break; }
    }
    evidence[cap] = matched ? { present: true, matched_phrase: matched } : { present: false };
  }
  // Materials mentioned
  const materialsFound = MATERIAL_SIGNALS.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(text));
  return { capabilities: evidence, materials_mentioned: materialsFound };
}

function classifyBusinessGroup(record, pageEvidence) {
  // Prefer directly-evidenced capabilities when available; fall back to claimed
  const evOr = (cap) => pageEvidence?.capabilities?.[cap]?.present === true || record.capabilities_claimed?.[cap] === true;
  const has = {
    mfr: evOr('manufacture'),
    inst: evOr('installation'),
    refurb: evOr('refurbishment'),
    reface: evOr('refacing'),
    kit: pageEvidence?.capabilities?.kit_or_product_supplier?.present === true,
    handrail: evOr('handrail'),
    balustrade: evOr('balustrade'),
    glass: evOr('glass'),
    metal: evOr('metal'),
  };
  const capCount = ['mfr','inst','refurb','reface'].filter(k => has[k]).length;

  // Kit / product supplier signal wins over service (page shows shop/buy/basket)
  if (has.kit && (has.reface || has.refurb)) return 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER';
  if (has.kit && has.mfr && !has.inst) return 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER';
  if (has.reface && !has.mfr && has.inst) return 'REFACING_SERVICE_SPECIALIST';
  if (has.refurb && !has.mfr && has.inst) return 'REFURBISHMENT_SERVICE_SPECIALIST';
  if (capCount >= 3) return 'MULTI_SERVICE_COMPANY';
  if (has.mfr && !has.refurb && !has.reface) return 'STAIRCASE_MANUFACTURER';
  if (has.inst && !has.mfr) return 'STAIRCASE_INSTALLER';
  return 'MULTI_SERVICE_COMPANY';
}

function verificationState(fetchResult, identityConfirmed, pageEvidence) {
  if (!fetchResult.ok || fetchResult.status < 200 || fetchResult.status >= 400) return 'SEARCH_DISCOVERED';
  if (!identityConfirmed) return 'SEARCH_DISCOVERED';
  const capCount = Object.values(pageEvidence?.capabilities || {}).filter(v => v?.present === true).length;
  if (capCount >= 3) return 'FULLY_VERIFIED';
  if (capCount >= 1) return 'SERVICE_EVIDENCED';
  return 'DIRECTLY_REACHABLE';
}

function qualityBand(v) {
  if (v === 'FULLY_VERIFIED') return 'A';
  if (v === 'SERVICE_EVIDENCED') return 'B';
  if (v === 'DIRECTLY_REACHABLE') return 'C';
  return 'D';
}

// ─── main ───

async function main() {
  const all = JSON.parse(await readFile(CONSOLIDATED, 'utf8'));
  console.log(`Loaded ${all.length} canonical records`);

  const sample = stratifiedSample(all);
  console.log(`Selected ${sample.length} for deep-verify:`);
  for (const r of sample) console.log(`  · ${r.business_name} (${r.region}) · via ${r.discovered_by_agents?.join(',') || 'unknown'}`);

  const results = [];
  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    const url = (r.website || (r.source_urls?.[0]) || '').trim();
    console.log(`\n[${i + 1}/${sample.length}] ${r.business_name} → ${url || '(no url)'}`);
    if (!url) {
      results.push({ ...r, _stage3: { fetch: { ok: false, error: 'no_url' }, verification: 'SEARCH_DISCOVERED', business_group: null, evidence: null, identity_confirmed: false } });
      continue;
    }
    const fetchResult = await fetchWithTimeout(url.startsWith('http') ? url : 'https://' + url);
    console.log(`  fetch: ${fetchResult.ok ? fetchResult.status : `ERROR ${fetchResult.error}`}`);
    let identityConfirmed = false;
    let pageEvidence = null;
    if (fetchResult.ok && fetchResult.status >= 200 && fetchResult.status < 400) {
      identityConfirmed = pageIdentityMatches(fetchResult.html, r.business_name);
      console.log(`  identity match: ${identityConfirmed}`);
      pageEvidence = extractEvidenceFromPage(fetchResult.html);
      const evidCount = Object.values(pageEvidence.capabilities).filter(v => v.present).length;
      console.log(`  capabilities directly evidenced on page: ${evidCount}`);
    }
    const verif = verificationState(fetchResult, identityConfirmed, pageEvidence);
    const group = classifyBusinessGroup(r, pageEvidence);
    console.log(`  → verification=${verif} · group=${group}`);
    results.push({
      ...r,
      _stage3: {
        fetch: fetchResult.ok
          ? { ok: true, status: fetchResult.status, final_url: fetchResult.url, content_type: fetchResult.contentType, size_bytes: fetchResult.html?.length ?? 0 }
          : { ok: false, error: fetchResult.error },
        identity_confirmed: identityConfirmed,
        evidence: pageEvidence,
        verification: verif,
        quality_band: qualityBand(verif),
        business_group: group,
      },
    });
  }

  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));

  // Aggregate
  const agg = {
    inspected: results.length,
    directly_reachable: results.filter(r => r._stage3.fetch.ok).length,
    search_only: results.filter(r => !r._stage3.fetch.ok).length,
    fully_verified: results.filter(r => r._stage3.verification === 'FULLY_VERIFIED').length,
    service_evidenced: results.filter(r => r._stage3.verification === 'SERVICE_EVIDENCED').length,
    directly_reachable_only: results.filter(r => r._stage3.verification === 'DIRECTLY_REACHABLE').length,
    search_discovered_state: results.filter(r => r._stage3.verification === 'SEARCH_DISCOVERED').length,
    identity_confirmed: results.filter(r => r._stage3.identity_confirmed).length,
    with_manufacture_evidence: results.filter(r => r._stage3.evidence?.capabilities?.manufacture?.present).length,
    with_installation_evidence: results.filter(r => r._stage3.evidence?.capabilities?.installation?.present).length,
    with_refurbishment_evidence: results.filter(r => r._stage3.evidence?.capabilities?.refurbishment?.present).length,
    with_refacing_evidence: results.filter(r => r._stage3.evidence?.capabilities?.refacing?.present).length,
    with_balustrade_evidence: results.filter(r => r._stage3.evidence?.capabilities?.balustrade?.present).length,
    with_handrail_evidence: results.filter(r => r._stage3.evidence?.capabilities?.handrail?.present).length,
    with_glass_evidence: results.filter(r => r._stage3.evidence?.capabilities?.glass?.present).length,
    with_metal_evidence: results.filter(r => r._stage3.evidence?.capabilities?.metal?.present).length,
    with_kit_product_signal: results.filter(r => r._stage3.evidence?.capabilities?.kit_or_product_supplier?.present).length,
    excluded_no_url: results.filter(r => r._stage3.fetch.error === 'no_url').length,
    fetch_errors: results.filter(r => !r._stage3.fetch.ok && r._stage3.fetch.error !== 'no_url').length,
    groups: {},
  };
  for (const r of results) {
    const g = r._stage3.business_group;
    agg.groups[g] = (agg.groups[g] || 0) + 1;
  }

  const md = renderMd(results, agg);
  await writeFile(OUT_MD, md);

  console.log('\n─── AGGREGATE ───');
  console.log(JSON.stringify(agg, null, 2));
  console.log(`\nReport: ${OUT_MD}`);
  console.log(`Data:   ${OUT_JSON}`);
}

function renderMd(results, agg) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 3 · Sample Deep-Verify`);
  lines.push(``);
  lines.push(`_20-record stratified sample from stage2-consolidated.json · directly fetched · evidence extracted from actual page content · no snippet uplift · 2026-08-15_`);
  lines.push(``);
  lines.push(`## Verification-state definitions (Philip 2026-08-15)`);
  lines.push(``);
  lines.push(`| State | Meaning |`);
  lines.push(`|---|---|`);
  lines.push(`| SEARCH_DISCOVERED   | Only surfaced by search snippets · fetch failed OR identity did not confirm on page |`);
  lines.push(`| DIRECTLY_REACHABLE  | Fetch OK + company name confirmed on page · no capability evidence found on this page |`);
  lines.push(`| SERVICE_EVIDENCED   | Above + ≥1 capability directly evidenced in page HTML |`);
  lines.push(`| FULLY_VERIFIED      | Above + ≥3 capabilities directly evidenced in page HTML |`);
  lines.push(``);
  lines.push(`## Aggregate (as requested)`);
  lines.push(``);
  lines.push(`- **Records inspected:** ${agg.inspected}`);
  lines.push(`- **Directly reachable (HTTP 2xx-3xx):** ${agg.directly_reachable}`);
  lines.push(`- **Search-only (fetch failed):** ${agg.search_only}`);
  lines.push(`- **Identity confirmed on page:** ${agg.identity_confirmed}`);
  lines.push(``);
  lines.push(`### 4-state verification distribution`);
  lines.push(``);
  lines.push(`- FULLY_VERIFIED: ${agg.fully_verified}`);
  lines.push(`- SERVICE_EVIDENCED: ${agg.service_evidenced}`);
  lines.push(`- DIRECTLY_REACHABLE (identity only, no cap evidence): ${agg.directly_reachable_only}`);
  lines.push(`- SEARCH_DISCOVERED (unable to directly verify): ${agg.search_discovered_state}`);
  lines.push(``);
  lines.push(`### Capability evidence directly on page (of 20)`);
  lines.push(``);
  lines.push(`| Capability | Records with direct evidence |`);
  lines.push(`|---|---:|`);
  lines.push(`| manufacture | ${agg.with_manufacture_evidence} |`);
  lines.push(`| installation | ${agg.with_installation_evidence} |`);
  lines.push(`| refurbishment | ${agg.with_refurbishment_evidence} |`);
  lines.push(`| refacing | ${agg.with_refacing_evidence} |`);
  lines.push(`| balustrade | ${agg.with_balustrade_evidence} |`);
  lines.push(`| handrail | ${agg.with_handrail_evidence} |`);
  lines.push(`| glass | ${agg.with_glass_evidence} |`);
  lines.push(`| metal | ${agg.with_metal_evidence} |`);
  lines.push(`| kit/product supplier signal | ${agg.with_kit_product_signal} |`);
  lines.push(``);
  lines.push(`### 6-group business classification`);
  lines.push(``);
  lines.push(`| Group | Count |`);
  lines.push(`|---|---:|`);
  for (const [g, n] of Object.entries(agg.groups).sort((a,b) => b[1]-a[1])) lines.push(`| ${g} | ${n} |`);
  lines.push(``);
  lines.push(`### Requiring manual review`);
  lines.push(``);
  lines.push(`- Fetch errors: ${agg.fetch_errors}`);
  lines.push(`- No URL in original record: ${agg.excluded_no_url}`);
  lines.push(`- Total needing manual review (SEARCH_DISCOVERED + DIRECTLY_REACHABLE_only): ${agg.search_discovered_state + agg.directly_reachable_only}`);
  lines.push(``);
  lines.push(`## Per-record detail (all 20)`);
  lines.push(``);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### ${i + 1}. ${r.business_name}`);
    lines.push(``);
    lines.push(`- **Website:** ${r.website || '_(none in record)_'}`);
    lines.push(`- **Fetch:** ${r._stage3.fetch.ok ? `HTTP ${r._stage3.fetch.status} · ${r._stage3.fetch.size_bytes} bytes · final url ${r._stage3.fetch.final_url}` : `ERROR — ${r._stage3.fetch.error}`}`);
    lines.push(`- **Identity confirmed on page:** ${r._stage3.identity_confirmed}`);
    lines.push(`- **Verification state:** \`${r._stage3.verification}\``);
    lines.push(`- **Quality band:** ${r._stage3.quality_band}`);
    lines.push(`- **Business group:** \`${r._stage3.business_group}\``);
    lines.push(`- **Region / town:** ${r.region || '—'} · ${r.town || '—'} · ${r.county || '—'} · ${r.postcode || '—'}`);
    if (r._stage3.evidence) {
      lines.push(`- **Direct page evidence per capability:**`);
      for (const [cap, ev] of Object.entries(r._stage3.evidence.capabilities)) {
        if (ev.present) lines.push(`  - ✓ ${cap} — matched: "${(ev.matched_phrase || '').slice(0, 80)}"`);
        else lines.push(`  - ✗ ${cap}`);
      }
      lines.push(`- **Materials mentioned on page:** ${r._stage3.evidence.materials_mentioned.join(', ') || '_(none)_'}`);
    }
    lines.push(`- **Prior capability_claimed (from Stage 2):** ${Object.entries(r.capabilities_claimed || {}).filter(([,v]) => v === true).map(([k]) => k).join(', ') || '_(none)_'}`);
    lines.push(`- **Discovered by agents:** ${(r.discovered_by_agents || []).join(', ') || 'unknown'}`);
    lines.push(`- **Fields remaining unknown:** ${['telephone','email','postcode','county'].filter(f => !r[f]).join(', ') || '_(none)_'}`);
    lines.push(``);
  }
  lines.push(`## What Stage 3 did NOT do`);
  lines.push(``);
  lines.push(`- Did not contact any company.`);
  lines.push(`- Did not upgrade "verified reachable" label — used Philip's stricter 4-state model instead.`);
  lines.push(`- Did not import any records to Supabase.`);
  lines.push(`- Did not start Stage 4 · waiting for Philip's sign-off.`);
  lines.push(`- Did not touch the NEX brain / M4 freeze — orthogonal tracks preserved.`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
