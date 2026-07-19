# Comparison Evidence Files

_Purpose: create a defensible evidence trail for every competitor ❌/✅ score on `/trade-off/compare-platforms/`. Required before public publish per `docs/LEGAL_UK_COMPARATIVE_ADVERTISING.md`._

**Why this matters:** if a competitor challenges a row (email → `admin@thenetworkers.app` → 14-day correction SLA we committed publicly), we need to prove the score was true at the date of publication. This folder is the proof.

**Regulatory basis:**
- **BPRs 2008 reg. 4(a)** — comparisons must be "verifiable"
- **DMCCA s.226** — a misleading action can be true information presented misleadingly; contemporaneous evidence rebuts the presumption
- **Malicious falsehood** (post *George v Cannell* [2024] UKSC 19) — the presumption of nominal damage bites at time of publication; dated evidence is our defence
- **ASA 17 Sep 2025 ruling** — verifiability signposting must be present + verifiable

---

## Folder shape

```
docs/comparison-evidence/
├── README.md                        (this file)
├── _template/                       (copy this for each new competitor)
│   ├── evidence.md
│   ├── pricing-page.png             (dated screenshot)
│   ├── features-page.png            (dated screenshot)
│   └── help-centre-*.png            (optional, per-feature)
├── checkatrade/
├── mybuilder/
├── bark/
├── rated-people/
├── trust-a-trader/
├── which-trusted-traders/
├── trustpilot/
├── yell/
├── nextdoor/
├── google-business-profile/
├── ...one folder per row on the full chart
```

---

## What each competitor folder must contain

Per competitor, at minimum:

1. **`evidence.md`** — one row per feature scored. Template below.
2. **`pricing-page.png`** — full screenshot of the competitor's pricing page on the date of scoring.
3. **`features-page.png`** — full screenshot of their headline features page (or "how it works").
4. **Per-feature screenshots** — optional, but stronger evidence. Especially for the features they DON'T offer (proving absence is harder than proving presence).

**Screenshot rules:**
- Full page, not cropped tightly (includes URL bar showing domain + capture date if the browser/tool shows it)
- Save as PNG (lossless — proves no tampering)
- Filename convention: `{page-slug}-{YYYY-MM-DD}.png` e.g. `pricing-2026-07-18.png`
- Never edit the screenshot. If you need to highlight, do it in `evidence.md` with a text description or a separate `-annotated.png` copy

---

## `evidence.md` template

```markdown
# Evidence — {Competitor Name}

**Base URL:** https://example.com
**Scored:** 2026-07-18
**Scored by:** {your name}
**Re-verify by:** 2026-10-18  (quarterly cadence)

## Screenshots on file
- `pricing-2026-07-18.png` — headline pricing table (2026-07-18)
- `features-2026-07-18.png` — "How it works" page (2026-07-18)
- `terms-2026-07-18.png` — Ts & Cs, section on lead pricing (2026-07-18)

## Feature scores (matches src/data/tradePlatformComparison.ts)

| Feature | Score | Source | Notes |
|---|---|---|---|
| Own live URL | ✅ | features.html — "Get your own trade profile" section | Confirmed on their homepage hero |
| Custom domain | ❌ | pricing.html — no domain mention | No custom-domain option found in any tier; confirmed with support chat 2026-07-18 |
| Free tier | ❌ | pricing.html — tiers start at £30/mo | No free tier; only trial |
| ... | ... | ... | ... |

## Pricing (verbatim from public page)
- Starter: £30/mo (12-month contract)
- Standard: £60/mo (12-month contract)
- ...

## Corrections received
_(Empty until a competitor writes in.)_

## Correction log
_(Date · What was changed · Why · New evidence attached)_
```

---

## Adding a new competitor

1. Copy `_template/` to `{competitor-slug}/`
2. Fill in `evidence.md`
3. Capture the required screenshots
4. Add the platform to `src/data/tradePlatformComparison.ts` (only after evidence exists)
5. Commit both the data change + the evidence in the same PR — never data without evidence

---

## Quarterly re-verify workflow

Every 3 months:
1. Open each `evidence.md`
2. Compare `Scored:` date to today
3. Re-visit each competitor's public pages
4. If anything changed, capture a new dated screenshot + update the evidence.md + update `src/data/tradePlatformComparison.ts`
5. Log the change in `## Correction log`
6. Commit the batch as one "Quarterly comparison re-verify {YYYY-MM}" PR

---

## What NOT to do

- **Do NOT store their marketing videos** — copyright liability outside "fair dealing for reporting current events" scope.
- **Do NOT scrape behind their paywall / login-gated pages** — CFAA / Computer Misuse Act 1990 exposure. Only public pages.
- **Do NOT hotlink to their pages inside our chart** — link is fine (Referential Use TMA s.11(2)(c)), but not to iframes/embeds.
- **Do NOT modify screenshots** — a forged screenshot destroys the entire evidence file's credibility. If you need to annotate, keep the original + save an `-annotated.png` copy alongside.
- **Do NOT commit login credentials or session cookies** in any screenshot.
