# Materials · Application Module (Layer 2)

**Not a Reference Brain.** Application Module per the three-layer architecture confirmed by Philip 2026-07-28.

- **Layer 1** · Reference Brains — knowledge (Staircase Brain · Roofing Brain · …)
- **Layer 2** · Application Modules — transactional work (this)
- **Layer 3** · NEX — orchestration + composition

## What this owns

Physical stock tracking for a manufacturing business:

- Timber packs (batches purchased from suppliers)
- Individual boards (digital twin of each physical board)
- Measurements (versioned · never overwritten)
- Cubic-metre calculations (derived from measurements)
- Worker link surface (token-authenticated · phone-first · single-purpose)
- Live synchronisation (Supabase Realtime channel per pack)
- Stock views · allocation · offcuts · purchase history · audit log

## Provider pattern

`_providers/_base.ts` defines the abstract `MaterialProvider` interface.
`_providers/hardwood.ts` is the first concrete implementation.

Future materials (sheet goods · glass · metal · fasteners · adhesives · etc.) implement the same interface. The service layer never talks to a specific material type — it always talks to a provider.

## Boundaries

- Never imports from `src/lib/nex/brains/*` (Layer 1 · frozen)
- Never mutates `hammerex_nex_brain_*` tables (Layer 1)
- Only owns `nex_materials_*` tables (Layer 2)
- Exposes clean service interfaces for future NEX orchestration (Layer 3)
- Reuses `src/lib/supabaseAdmin.ts` (service-role client) — no new client
- Reuses `src/lib/nex/brains/_auth.ts::requireAuth()` for admin routes (identity is a shared NEX concern)

## Schema

Migration: `supabase/migrations/20260728150000_nex_materials.sql`

- `nex_materials_species` — reference catalogue (12 seeded hardwoods · extensible)
- `nex_materials_suppliers`
- `nex_materials_hardwood_packs`
- `nex_materials_hardwood_boards`
- `nex_materials_hardwood_board_measurements` — versioned
- `nex_materials_hardwood_board_defects`
- `nex_materials_worker_links` — token-authenticated write surface
- `nex_materials_hardwood_allocations`
- `nex_materials_hardwood_offcuts`
- `nex_materials_audit_log`

## API routes

Admin (session-authenticated · owner-scoped):
- `GET · POST   /api/materials/packs`
- `GET · PATCH · DELETE  /api/materials/packs/[packId]`
- `POST  /api/materials/packs/[packId]/boards`
- `POST  /api/materials/packs/[packId]/worker-link`
- `POST  /api/materials/boards/[boardId]/measurements`
- `GET   /api/materials/stock`

Worker (token-authenticated · pack-scoped):
- `GET   /api/worker/[token]/validate`
- `POST  /api/worker/[token]/measurements`
