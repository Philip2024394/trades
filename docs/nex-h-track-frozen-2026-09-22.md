# NEX 24/7 World Harvest Engine · H-track · FROZEN

**Founder-authored governance annotation · 2026-09-22 · not runtime · not code**

> **STATUS: H1-H5 ENGINEERING COMPLETE · H-TRACK FROZEN**
>
> The complete harvest engineering pipeline (durable queue → governed sources → source-probe executor → website walker → controller with reaper + Asia-last runtime enforcement) has been shipped and endurance-tested. The next phase is **operational activation, not more architecture.**
>
> No `H6` wave exists or should be proposed on the basis that H5 is done.

---

## The permanent boundary

**Engineering complete** ≠ **World-proof complete.**

| Component | Status |
|---|---|
| Durable work queue (H1) | ✅ engineered · 28 tests |
| Governed source registry (H2) | ✅ engineered · 21 tests |
| Business retention bridge (H3) | ✅ engineered · 20 tests |
| Website walker executor (H4) | ✅ engineered · 14 tests |
| Continuous controller with endurance/chaos proof (H5) | ✅ engineered · 7 tests |
| Asia-last enforced at runtime (not UI comment) | ✅ locked |
| Recovery via reaper (no manual intervention) | ✅ locked |
| HQ operational visibility (17-page manifest) | ✅ shipped |
| **Real-world continuous harvesting** | 🔒 **Founder operational activation** |
| **24/7 sustained world-proof** | 🔒 **Not yet earned** |

The 🔒 lines cannot be moved from inside this repo. They are moved only by:
- Founder-signed operational activation through the World Activation Pack
- Sustained evidence across a multi-hour window
- ADR + code+test update per `docs/world-activation-pack/04-standing-line-governance.md`

---

## What the next action is (not another engineering wave)

The Founder-controlled operational activation follows the existing frozen pack:

1. `docs/world-activation-pack/README.md` — evidence chain + tiny-first principle
2. `docs/world-activation-pack/01-runbook-per-gate.md` — exact Founder actions per gate
3. `docs/world-activation-pack/02-audit-sql.md` — before/after evidence queries
4. `docs/world-activation-pack/03-rollback-procedure.md` — un-flip without weakening
5. `docs/world-activation-pack/04-standing-line-governance.md` — allowed phrase set
6. `docs/world-activation-pack/gate-1-first-flip-observation.md` — empty form ready to receive real evidence

The tiny-first principle applies: **one real source → one real business → one real website → one real public email → one real database row → one real yield → HQ shows same fact**. Then repeat. Then expand.

---

## Doctrine locks that must not be weakened during activation

These are enforced structurally in code and must not be relaxed to make first-flip evidence "look good":

- **`_CONTROLLER_ACTIVE_MEANS_YIELD_NOT_HEARTBEAT`** — a dead worker with a green cron endpoint is STALLED, not ACTIVE. The Overview page reads `harvest_yield` · that is the sole definition of ACTIVE.
- **`_SCHEDULER_ASIA_LAST_ENFORCED_AT_RUNTIME`** — Asia refused while non_asia_eligible pool is non-empty. Modifying this requires editing `country-scheduler.ts` (a code change under source control).
- **`_EXECUTOR_RETAINS_EVERY_BUSINESS_ELEMENT`** — Overpass elements with a business name become durable candidate rows. Zero-discard path.
- **`_WEBSITE_WALK_NEVER_GENERATES_EMAIL`** — publicly found email ≠ generated email. No `info@domain` construction, no name-based derivation, no MX-invention.
- **`_CANDIDATE_WEBSITE_URL_NULLABLE`** — missing website stays NULL, never fabricated.
- **`_HARVEST_POSTGRES_IS_AUTHORITY`** — no in-memory queue. Process restart cannot erase work.
- **`_HARVEST_LEASE_OWNERSHIP_REQUIRED`** — heartbeat/complete/fail all reject wrong-owner mutations.
- **`_REGISTRY_FOUNDER_SIGNATURE_REQUIRED`** — every source carries `founder_signed_at` + `founder_signed_by` + `provenance_note` NOT NULL at DB level.

If any of these appears about to be relaxed during activation, that is a governance-boundary signal · not a "make it work" moment.

---

## What remains dormant by design (and correctly so)

- `NULL_OVERPASS_ADAPTER` — module default · production Overpass adapter is Founder-opt-in via injection
- `NULL_FETCHER` — module default · production PageFetcher requires Gate #1 activation with M26-signed allowlist
- `NEX_DISCOVERY_CRON_ACTIVATION` — must equal exactly `"on"` for `/api/cron/nex-harvest-tick` to run · currently unset
- `NEX_PAGE_FETCHER_ACTIVATION` — must equal exactly `"on"` for the production PageFetcher · currently unset
- Migrations `nex_harvest_engine.sql` + `nex_harvest_source_registry.sql` + `nex_harvest_business_candidate.sql` — authored in repo, not applied to any deployment

---

## The freeze applies to Claude too

Future sessions defaulting to "propose the next H-wave because H5 is done" is incorrect. The engineering pipeline is complete. The next milestone is not architectural. It is:

> The moment NEX crosses from **MACHINERY PROVEN UNDER TEST** to actual real-world operational evidence — and that should happen through the existing activation gates and proof pack, without weakening any of the safeguards.

If a future prompt appears to ask Claude for "H6" or "the next wave after H5" without an explicit governance-signed authorization, the correct default response is:

**The H-track is frozen. The next milestone is Founder-controlled operational activation via the World Activation Pack, not another engineering wave.**

---

## Standing marketing status line · unchanged verbatim

`NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.`

Preserved. Governed by `docs/world-activation-pack/04-standing-line-governance.md`. Never modified at runtime. Never modified by "it looks like it's working."

---

**End of H-track freeze annotation.**
