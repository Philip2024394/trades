# Government rates ingest — operator runbook

## Purpose

Populate `app_rates_gov` from official public data so The Network can display rate baselines with provable evidence.

## Sources (currently supported)

### 1. ONS ASHE — Annual Survey of Hours and Earnings

- URL: <https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkingtime/bulletins/annualsurveyofhoursandearnings/latest>
- Releases: **quarterly**, headline annual bulletin each October/November
- Key table: **Table 15 — Occupation (4-digit SOC 2020) by region**
- License: **OGL v3.0** (Open Government Licence, free commercial use with attribution)
- Format: `.xlsx` with a `Median`, `10%ile`, `25%ile`, `75%ile`, `90%ile` per SOC × region cross-tab

### 2. CITB Skills Network Report (planned Phase 2b)

- URL: <https://www.citb.co.uk/about-citb/skills-network/>
- Construction-specific rates by trade, region, skill level
- Annual publication with retrospective analysis

### 3. HMRC PAYE RTI Summaries (planned Phase 2c)

- URL: <https://www.gov.uk/government/statistics/paye-real-time-information-rti>
- Quarterly public summaries of median earnings by industry code
- Broader industry codes, less granular than ONS ASHE

## Ingest workflow (manual for now)

Automate via cron once volumes justify it. Manual steps:

1. **Download the latest ASHE Table 15** from the ONS URL above
2. **Extract the SOC codes we care about** — see `src/lib/rates/taxonomy.ts` for our `SOC_TO_TRADE_SLUG` table (13 codes currently mapped, all construction trades)
3. **For each (SOC × region × rate_type)** row, insert into `app_rates_gov` with:
   - `source = 'ONS_ASHE'`
   - `source_url = 'https://www.ons.gov.uk/…/annualsurveyofhoursandearnings/[year]'`
   - `source_release = 'Annual [year]'` or `'Q2 [year]'`
   - `trade_soc_code` = the SOC code
   - `trade_slug` = resolved via `socToTradeSlug()`
   - `region_code` / `region_label` = NUTS-1 mapping (see `NUTS1_REGIONS`)
   - `rate_type = 'hourly'` (ASHE headlines are hourly)
   - `gbp_low` = 25th percentile
   - `gbp_median` = 50th percentile
   - `gbp_high` = 75th percentile
   - `sample_size_note` = the ONS "N=" figure from that row
   - `released_at` = the ONS release date
4. **Verify via** `SELECT count(*) FROM app_rates_gov WHERE source = 'ONS_ASHE' AND source_release = '…'`

## Freshness policy

- Rates ≤ 6 months old: displayed with `✓ Official` badge
- Rates 6-12 months old: displayed with `✓ Official (last release)` badge
- Rates > 12 months old: **hidden** — the UI shows the honest empty state ("no verified rate available yet") until a fresh release is ingested

## Do NOT

- **Never** insert rows without a real source (no synthesised placeholders in prod)
- **Never** paraphrase or round ONS figures beyond their published precision
- **Never** display a row without the `source_url` linkable to the raw dataset

If real ONS data isn't available for a given (trade × region), the UI must show the honest "not yet ingested" empty state — not a fallback made-up number.

## Attribution requirement

Every UI element displaying a row from `app_rates_gov` must include:

- The source name ("ONS ASHE", "CITB Skills Network", or "HMRC PAYE RTI")
- The release identifier ("Q2 2026", "Annual 2025", etc.)
- A **clickable link** to the source URL

This satisfies OGL v3.0 attribution AND the platform's evidence-or-silence rule (`project_evidence_or_silence.md`).
