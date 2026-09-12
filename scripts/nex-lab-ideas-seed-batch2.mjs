#!/usr/bin/env node
// scripts/nex-lab-ideas-seed-batch2.mjs
//
// Founder 2026-09-10 · Innovation Room · seed monetization/trust ideas from
// agent 3. Idempotent. Idea "Long-Stay Kos" is deliberately skipped because
// agent 1 already covered it with a different framing.

import { Client } from "pg";

const IDEAS = [
  {
    agent: "creative-agent:monetization-trust",
    category: "trust_signal",
    title: "Halal + Muslim-Traveller Certification Program",
    user_need: "Muslim families in Indonesia (USD 180B halal-tourism market) need clear signals: prayer room, qibla, halal kitchen, gender-segregation, Ramadan meal timing.",
    description: "Tier-gated (Business+) self-certification checklist stored in accommodation_business_field_provenance with trust_layer='self_verified_halal'. Halal badge + detailed checklist on cards + search filter. Locked behind Business tier for upgrade urgency. No merchant fee beyond subscription.",
    why_missing: "Accommodation purpose_tags exist (business/wellness/family) but no religious_observance tag. Halal module in src/lib/nex/indonesia/halal/ exists but is not surfaced. Trust-score weighting has no halal signal.",
    evidence_refs: ["src/lib/tierCatalog.ts","src/lib/nex/intelligence-storage-grid/accommodation/taxonomy.ts","src/lib/nex/intelligence-storage-grid/accommodation/property-schema.ts","src/lib/nex/trust-score/index.ts"],
    difficulty: "M",
    user_value: "high",
    engineering_brief: "Add columns halal_certification enum(self_verified/mui_certified/hti_certified/none) + halal_checklist JSONB {prayer_room, qibla_marker, halal_kitchen, gender_segregation, ramadan_iftar_times, local_certifier}. New page /trade-off/edit/[slug]/trust/halal-certification with Business tier gate. deterministic-composer emits halal summary. entity-result-cards render halal_badge alongside verified_badge. trust-score +0.15 when present.",
  },
  {
    agent: "creative-agent:monetization-trust",
    category: "monetization",
    title: "Seasonal Price Surge Detection + Alerts",
    user_need: "Indonesian owners (Bali/Yogya beach properties) face big seasonal swings (Ramadan dip / school holidays peak / rainy-season eco-lodge surge). Prices go stale · money left on table.",
    description: "Professional-tier seasonal pricing template + AI-suggested rates per month from Google Trends + historical booking volumes + weather. Never take commission — owners set their prices. Traveller sees 'Prices peak July-August (school holidays)'. £3.99/mo add-on unlocks AI suggestions on Free tier without changing sub tier.",
    why_missing: "tierCatalog has no pricing-intelligence feature. Analytics is a stub per docs/features/index.md line 138 ('Status: not built'). activity-taxonomy has seasonality_relevance for activities only, not accommodation. Zero price-surge endpoints in src/app/api/nex/accommodation/*.",
    evidence_refs: ["src/lib/tierCatalog.ts","docs/features/index.md","src/lib/nex/intelligence-storage-grid/accommodation/activity-taxonomy.ts"],
    difficulty: "M",
    user_value: "critical",
    engineering_brief: "Add JSONB seasonal_pricing { enabled, adjustments:[{month,factor}], data_source:'owner_manual'|'ml_suggested' }. New /trade-off/edit/[slug]/pricing/seasonal (Professional gate). Google Trends proxy for {city}{type}{month}. Simple regression search_volume × historical_volume → suggested_factor. Composer emits 'Prices typically peak in {months} due to {reason}'. £3.99/mo add-on via hammerex_app_subscriptions.",
  },
  {
    agent: "creative-agent:monetization-trust",
    category: "monetization",
    title: "Insurance-Backed Host Guarantee",
    user_need: "Indonesia has unique liability model — owners need coverage for visitor claims (damage/accidents/illness). Western insurance doesn't fit. Travellers want protection assurance.",
    description: "Business-tier optional enrollment in NEX Host Guarantee (Allianz/Axa partner). £2.99/mo add-on. Traveller sees 'Protected by NEX Host Guarantee' badge with coverage detail (damage/liability/cancellation up to IDR 5M). Not lead commission — service margin (permitted per ADR-0003 spirit: not transaction-based).",
    why_missing: "No insurance partnership today. No insurance-backed badge in trust-signal system. Business tier differentiator is 'Verified badge fast-track' + '5-slot beacon' — no insurance layer. Zero insurance integration in codebase.",
    evidence_refs: ["src/lib/tierCatalog.ts","docs/DECISIONS/0003-never-sell-leads.md","src/lib/nex/trust-score/index.ts"],
    difficulty: "L",
    user_value: "high",
    engineering_brief: "Requires partnership negotiation (Allianz/Axa/Simas Energi). Add JSONB insurance_guarantee { enabled, partner, policy_id, coverage_idr, coverage_start_date }. £2.99/mo add-on in hammerex_app_subscriptions type 'nex-host-guarantee'. New /trade-off/edit/[slug]/trust/host-guarantee. entity-result-cards emit insurance_badge. trust-score +0.20 when enabled. Claims webhook + Stripe premium billing + admin dashboard. FOUNDER REVIEW REQUIRED for ADR-0003 spirit compliance.",
  },
  {
    agent: "creative-agent:monetization-trust",
    category: "community_layer",
    title: "Kos + Homestay Renter Stories (Community Trust)",
    user_need: "Long-stay renters want qualitative community signals ('are other students happy?', 'is landlord responsive?') · 5-star ratings don't capture kos community feel.",
    description: "Post-stay 3-5 structured questions ('How was community feel?', 'Would other {student/nomad/expat} like it?', 'What surprised you?'). Aggregated as anonymized snippets: '7 students loved this · 2 expats had WiFi issues'. Professional-tier owners see aggregated sentiment. Retention driver, no new revenue.",
    why_missing: "hammerex_reviews is generic 5-star model. No renter_story or qualitative-review table. No community-segment tagging (student/nomad/expat/family). Composer doesn't surface stories.",
    evidence_refs: ["docs/features/index.md"],
    difficulty: "S",
    user_value: "high",
    engineering_brief: "New renter_story table { id, accommodation_id, renter_name, renter_segment enum(student/nomad/expat/family), story_text, sentiment enum(positive/neutral/negative), created_at, published }. Post-stay form /home/[stay-id]/review/story via email link. Accommodation-detail shows 'Renter stories: N students · M nomads'. Professional dashboard /trade-off/edit/[slug]/reviews/stories.",
  },
  {
    agent: "creative-agent:monetization-trust",
    category: "trust_signal",
    title: "Trust Ladder Badge Progression",
    user_need: "Owners need visible progression path from claimed → verified → insurance-backed → community-rated. Travellers need to distinguish trust levels at a glance.",
    description: "Trust ladder: L1 Claimed (Free) · L2 Verified (Business tier Companies-House check) · L3 Insurance-backed (add-on) · L4 Community-rated (10+ stories, avg 4+ sentiment). Progression bar on profile + badge stack on cards. Merchant sees 'Next unlock: Host Guarantee £2.99/mo'.",
    why_missing: "tierCatalog says 'Verified badge fast-track' but no ladder model. trust-score has single overall score, no ladder/badge-stack. Composer doesn't emit multi-signal profile.",
    evidence_refs: ["src/lib/tierCatalog.ts","docs/DECISIONS/0003-never-sell-leads.md","src/lib/nex/trust-score/index.ts"],
    difficulty: "S",
    user_value: "medium",
    engineering_brief: "Add computed field trust_ladder_level enum(claimed/verified/insurance_backed/community_rated) derived from verified_badge + insurance_guarantee.enabled + renter_story_count>=10 AND avg_sentiment>=0.7. New TrustLadderBadges component on profile + cards. /trade-off/edit/[slug]/trust/ladder page showing 'You are Level 2 · Next: Insurance-Backed £2.99/mo'. Composer emits multi-signal fact. Progression telemetry.",
  },
];

async function main() {
  const c = new Client({ connectionString: process.env.NEX_TAXONOMY_POSTGRES_URL ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev" });
  await c.connect();
  let inserted = 0, skipped = 0;
  for (const idea of IDEAS) {
    try {
      const existing = await c.query(`SELECT idea_id FROM nex_lab.innovation_ideas WHERE title = $1 LIMIT 1`, [idea.title]);
      if (existing.rows.length > 0) { skipped++; continue; }
      await c.query(
        `INSERT INTO nex_lab.innovation_ideas
           (generated_by_agent, category, title, user_need, description, why_missing, evidence_refs, engineering_brief, difficulty, user_value, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,'proposed')`,
        [idea.agent, idea.category, idea.title, idea.user_need, idea.description, idea.why_missing, JSON.stringify(idea.evidence_refs), idea.engineering_brief, idea.difficulty, idea.user_value],
      );
      inserted++;
    } catch (err) { console.error(`ERR on "${idea.title}": ${err.message}`); }
  }
  console.log(`batch2: seeded ${inserted} new ideas · ${skipped} already existed`);
  await c.end();
}
main().catch(err => { console.error("fatal:", err.message); process.exit(1); });
