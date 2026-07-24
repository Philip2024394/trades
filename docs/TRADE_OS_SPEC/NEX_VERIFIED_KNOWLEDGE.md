# Nex Verified Knowledge Policy

**Nex must become known for one thing: if Nex says something is an official regulation, it is backed by a real official source.**

Every research request follows a strict Source-of-Truth policy. Nex never presents assumptions, guesses, hallucinations or AI reasoning as fact.

---

## The four source tiers

| Tier | Definition | Examples |
|---|---|---|
| **official** | Government, national regulations, statutory guidance | gov.uk Approved Documents, HSE guidance, legislation.gov.uk, local authority guidance |
| **industry** | Recognised trade bodies + accredited certification + manufacturer technical documentation | Gas Safe, NICEIC, NAPIT, BSI, RICS, CIOB, FMB, manufacturer specs |
| **educational** | Universities, technical publications, research papers | City & Guilds textbooks, university research, journals |
| **community** | Forums, blogs, tradesperson opinion | Reddit, community forums, industry blogs |

Every source has an explicit `tier` field. The mapping from `kind` to `tier` is deterministic (see `KIND_TO_TIER` in `types.ts`); callers can override.

## The weakest-link rule

**A knowledge draft inherits the LOWEST tier among its cited sources.**

If one draft cites `[official, community]`, the whole draft is treated as `community` — because mixing tiers makes the whole draft only as trustworthy as its weakest link. Nex UI + chat labels drafts by this inherited tier.

`draftTier()` in `research.ts` computes this. Rank order: `official 4 > industry 3 > educational 2 > community 1 > unverified 0`.

## Fabricated-URL guard

Nex can hallucinate URLs. The guard sits in `coerceSource()`:

```
TRUSTED_URL_DOMAINS = [
  gov.uk, hse.gov.uk, legislation.gov.uk,
  planningportal.co.uk, gassaferegister.co.uk,
  niceic.com, napit.org.uk, bsigroup.com,
  rics.org, citb.co.uk, cscs.uk.com
]
```

Any URL NOT on the allowlist is **dropped** and the source is annotated with `verification_note: "URL '...' not on trusted-domain allowlist — cited by name only until verified"`.

The source remains — its `title` is still shown — but there is no clickable link until a staff reviewer verifies the URL and adds it manually. Sneaky spoofs (`gov.uk.evil.example`) are rejected because the check requires exact-match or genuine subdomain (`.gov.uk`).

## Every source carries provenance

The `SourceSchema` now includes:
- `title` (required)
- `kind` (existing enum)
- `tier` (derived if omitted)
- `country` (defaults `UK`)
- `date_published` (optional)
- `last_verified` (optional; staff-supplied at approval time)
- `verification_note` (auto-populated when URL fails allowlist)
- `url` (optional; only kept when on allowlist)

## LLM prompt rules (verbatim in `RESEARCH_SYSTEM`)

- You NEVER invent facts, URLs, dates or citations.
- Every draft has at least one source with title + kind + tier.
- URLs are optional. Cite the document by name if you're unsure.
- If uncertain about anything, DO NOT DRAFT — return an empty array.
- Prefer official > industry > educational > community.
- Never mix official + community into the same draft.

## Research report records the tier split

`hammerex_nex_research_reports` gained:
- `tier_counts jsonb` — `{ official: N, industry: N, educational: N, community: N }`
- `found_official boolean`
- `search_summary jsonb` — which sources were checked + notes

## Chat reply — trust language

When a merchant asks Nex to research, the reply follows this template:

```
I searched official government and recognised industry sources before answering.

[if found_official]
Official guidance was found. N drafts cite regulation-tier sources.

[else]
No official guidance was found for "<topic>". Any drafts below come from
industry / community sources and are not legislation.

Industry sources:    N
Community guidance:  N (labelled)

N items waiting for your approval. Nothing is live yet.
```

Merchants can never be told community guidance is regulation. The UI + chat both wear the tier explicitly.

## Review UI — every source shows its tier chip

Green = official · Blue = industry · Purple = educational · Amber = community · Red = unverified

Staff reviewer sees:
- Tier chip
- Source title
- Trusted link (when present)
- `date_published`
- `verification_note` (in italic when the URL was dropped)

## What Nex will refuse to do

- Auto-approve any knowledge (existing rule from Phase 2)
- Publish a URL that isn't on the trusted-domain allowlist
- Draft anything at all when the LLM can't cite a source
- Present community guidance as regulation
- Promise a source that doesn't exist

## What's shipped this pass

- `SourceSchema` extended with `tier`, `country`, `date_published`, `last_verified`, `verification_note`
- `KIND_TO_TIER` deterministic mapping + `withTier()` helper
- Migration `20260722700000_nex_verified_knowledge.sql` adds `tier_counts` + `found_official` + `search_summary` to research reports
- Research pipeline rewritten:
  - Verified-knowledge system prompt
  - Fabricated-URL guard via trusted-domain allowlist
  - Weakest-link tier inheritance per draft
  - Structured SearchSummary
- Chat reply uses the exact trust-language template
- Review UI shows a tier chip + link + date + verification note per source
- Research report admin page shows a green/amber banner ("Official guidance found" / "No official guidance found") + per-tier stats
- 18 new tests: allowlist accept + reject, spoof rejection, tier inference, weakest-link tiering, kind-to-tier completeness

## What's deferred honestly

- **Real web fetch of gov.uk pages** — pass 2 with Firecrawl / similar. Framework already carries `method` column so we can distinguish `reasoning` vs `web-fetch` at query time.
- **Level 3 (educational) source enrichment** — need integrations with journal databases
- **Reviewer's "verify URL" action** — one-click "yes I checked, this URL is real" that flips `last_verified` and re-enables the link
- **Confidence-decay for aged sources** — auto-lower confidence when `date_published` is > 5 years old

Trust is more important than speed. Every answer traceable to source. Nothing invented.
