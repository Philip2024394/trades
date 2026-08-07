# NEX Communications Centre · Social Engine

**Namespace:** `src/lib/nex/comms-social/**` · `nex.social_*` DB tables · `/api/nex/comms-social/**` routes.

**This is NOT `src/lib/nex/social/**`.** That path belongs to the Hammerex Nex product (see `../social/`), a separate Next.js application that shares this repo's file layout but runs on Supabase with `hammerex_*` tables. The two systems are architecturally distinct and MUST NOT share code, schema, or runtime.

| Concern | Communications Centre Social (this module) | Hammerex Nex Social (`../social/`) |
|---|---|---|
| Data plane | Postgres 17 via `withClient` (`src/lib/nex/db.ts`) | Supabase via `supabaseAdmin` (`src/lib/supabaseAdmin.ts`) |
| Table prefix | `nex.social_*` | `hammerex_nex_social_*` |
| Tenant model | `tenant_id` UUID + RLS default-deny | `merchant_slug` string |
| Governing charter | `docs/NEX_SOCIAL_ENGINE_CHARTER.md` v0.1 + `NEX_SOCIAL_ENGINE_CHARTER_v0.2_PROPOSAL.md` | none in this repo |
| Frozen kernel discipline | Must not modify v1.0.0 hashes | n/a |
| Predictive integration | Forbidden (S-XII) | n/a |

**Charter path discrepancy (recorded, not silently fixed):**
Charter v0.2 §S-II states adapter isolation applies to `src/lib/nex/social/adapters/*`. Implementation lives at `src/lib/nex/comms-social/adapters/*` because §D2-A separated namespaces. A future amendment to the canonical charter will reconcile the path. Until then, all charter references to `src/lib/nex/social/` should be read as `src/lib/nex/comms-social/` for this module only.

## Do not

- Import from `../social/**` (Hammerex).
- Import `@/lib/supabaseAdmin`.
- Import `@/lib/nex/predictive/**`.
- Import `@/lib/nex/delivery/**` or `@/lib/nex/compliance/**` (per invariant #15 kept faith with, and the charter S-XII / S-I).
- Import a social-provider SDK anywhere except in `adapters/*.ts`.
- Reuse `hammerex_*` tables.

## Do

- Import from `@/lib/nex/db` for the pg pool.
- Emit canonical events to `nex.events` (once we cross into Phase 4 event integration).
- Follow the enforcement matrix in `docs/NEX_SOCIAL_ENGINE_CHARTER_v0.2_PROPOSAL.md`.

## Phase 0 scope (this commit set)

Foundation + enforcement only. No providers · no publishing · no UI · no generation. See `PHASE_0_MAP.md` in this folder.
