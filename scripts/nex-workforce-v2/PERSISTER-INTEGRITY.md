# NEX Workforce v2 · Persister Integrity Contract
**Established**: Slice A2 · 2026-09-07 · Philip

## Governing invariant

> **A production accommodation-workforce runner must NEVER invoke the mock
> persister.** The default `NEX_PERSISTER_FN` value (`nex_workforce.mock_persist_target`)
> is a test fixture only. Any production execution path that silently falls
> back to the mock target is a serious truth violation — records that appear
> to be "persisted" but land in a discardable mock table represent invented
> confirmations of work never done.

## Fail-closed layers already in place (Slice A2)

Slice A2 hardens the accommodation seam at three layers. Reviewers should
understand each layer independently — the guarantee is that ANY ONE of them
would catch a misconfigured production run, and ALL THREE must fail for a
silent misroute to occur.

### Layer 1 · Function body writes only to the real target

`nex_workforce.persist_to_accommodation_business` writes ONLY to:
- `nex.accommodation_business`
- `nex.accommodation_business_field_provenance`

It does not reference `nex_workforce.mock_target` in any INSERT / UPDATE
statement. There is no code path inside the function body that would
persist to the mock table.

### Layer 2 · Structural role isolation

The function is `SECURITY DEFINER` with owner
`nex_workforce_persister_accommodation_business`. That role has:

| Grant | Object | Purpose |
|---|---|---|
| USAGE | schemas `nex`, `nex_workforce`, `extensions` | schema visibility |
| SELECT, INSERT, UPDATE | `nex.accommodation_business` | write canonical row |
| SELECT, INSERT | `nex.accommodation_business_field_provenance` | write per-field trust |
| SELECT | `nex_workforce.city_catalogue` | authoritative city derivation |
| SELECT | `nex_workforce.evidence_record` | provenance joins |
| SELECT, UPDATE | `nex_workforce.work_item` | FOR UPDATE fence check |

**No grant on `nex_workforce.mock_target`.** Even if a bug in the function
body attempted to INSERT into mock_target, PostgreSQL would deny the
operation at the permission layer. Verified by the A2 contract test
`A10 · persister role has zero permissions on mock_target`.

### Layer 3 · Source-slug validation

The function rejects `p_source_slug` values outside `('overpass',
'osm_overpass')` with `rejection_reason = 'unsupported_source_slug:<x>'`.
This prevents a caller from tricking the function into treating a mock-shaped
payload as production overpass evidence.

## What Slice A2 explicitly does NOT do (runtime startup guard)

Slice A2 documents but does not implement the runtime startup guard —
that is a separate slice concern. The intended future guard is:

- **Where**: `scripts/nex-workforce-v2/agent.mjs` startup path, or a shared
  `scripts/nex-workforce-v2/lib/persister_gate.mjs`
- **What**: refuse to boot the accommodation capability with
  `NEX_PERSISTER_FN` unset OR equal to
  `nex_workforce.mock_persist_target(...)` in any production environment
  (defined by presence of a `NEX_PRODUCTION_ACQUISITION=1` env var OR
  hostname pattern OR similar deployment signal)
- **Deliverable**: a small assertion at agent startup + a test that boots
  the agent with `NODE_ENV=production` + no `NEX_PERSISTER_FN` and asserts
  the agent exits with a distinctive error before claiming any work

Until that guard ships, deployment operators must:

1. Set `NEX_PERSISTER_FN=nex_workforce.persist_to_accommodation_business(text,uuid,integer,text,timestamptz,text,text,jsonb)`
   at the deployment boundary (systemd unit, Windows Scheduled Task
   Argument, docker-compose env, whatever the runtime is)
2. Verify with `echo $NEX_PERSISTER_FN` before starting the agent
3. Grep the agent's stderr for `mock_persist_target` — if present, halt

## Contract tests that lock this in

| Test | Location | What it proves |
|---|---|---|
| `A1.1` | `accommodation_persister_contract.test.mjs` | Real persister inserts real rows into `nex.accommodation_business` |
| `A10 · after accommodation persist, mock_target has ZERO rows` | same file | Positive-path proof that accommodation writes never land in mock_target |
| `A10 · persister role has zero permissions on mock_target` | same file | Structural proof that the role couldn't write to mock_target even if the function body tried |

## Related architecture decisions

- **ADR-0119** · Accommodation Intelligence Database Authority (local PG :5433 · nex_dev) — establishes that Project B is NOT the accommodation authority; accommodation lives on local PG.
- **Slice 1g doctrine** · Persistence boundary immutability + evidence-record ledger.
- **Slice 1h R5** · Multi-city persister pattern with authoritative city derivation from work_item.city_slug.
- **A1** · Accommodation capability registration in the v2 step registry (routing only, no persistence changes).
