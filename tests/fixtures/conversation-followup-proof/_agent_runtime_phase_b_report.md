# NEX — AGENT RUNTIME PHASE B REPORT

**Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION**
**Bundle: Indonesia-wide business universe · Runtime persistence hardening · Internet cross-process fault injection**

## Verdict

**GREEN** for everything within the authorized scope · **1 explicit YELLOW** per §45 (actual physical reboot not performed — Scheduled Task is registered and inspectable; procedure below).

## Architecture before

- **Agents:** Programmer + Accommodation running as detached child processes (from Agent Runtime activation slice). Both PIDs alive · fresh heartbeats.
- **Business identity:** none — accommodation records lived only as `WorldRecord` rows, one-per-location, no cross-city grouping, no history.
- **Change detection:** none — attributes were overwritten in place (§11 defence non-existent).
- **Cross-process internet fault injection:** unit-proven only (from prior slice's YELLOW).
- **Persistence across reboot/logoff:** unproven (from prior slice's YELLOW). Existing walker installer required admin.
- **Universe view of Indonesia:** none — city was a plain string on each WorldRecord row.

## Architecture after

```
NEX INDONESIA (one universe)
├── BusinessIdentity        (biz_ID_<uuid>) — stable across relocations
├── BusinessPlacement       (pmt_<uuid>)    — 0..N per business per location per time-window
│    ├── location.city_slug ← accommodation-slots normalizer
│    ├── location.province_code ← ISO 3166-2 from data/indonesia/geo/provinces.json
│    ├── world_record_ref   ← optional link to existing WorldRecord.id (accommodation/food/etc)
│    ├── category           ← WorldVertical + sub_category + additional_sub_categories
│    ├── status             ← ACTIVE / STARTING / HISTORICAL / CLOSED / PROVISIONAL / AMBIGUOUS / CONFLICTING
│    ├── effective_from_iso / effective_to_iso   (temporal)
│    └── evidence_ids       (cited)
├── EvidenceRef             (chain of tier + source_key + observed_at_iso + excerpt)
└── ChangeRecord (append-only) — every mutation preserved with previous_value + new_value + confidence

+ Runtime hardening:
  · internet-check.ts     — env-var force NEX_AGENT_INTERNET_FORCE_OFFLINE/ONLINE for cross-process fault injection
  · Scheduled Task        — per-user "NEX-Agent-Runtime-User" registered · Ready state · triggers on logon

Both concerns compose with existing:
  · Wave 5/6/7 conversation (untouched · §37 preserved)
  · NEX Live Phase A + MUSIC/VIDEO + Phase B (untouched · §38 preserved)
  · Programmer Agent (§18 preserved · no cross-agent mutation path)
  · Accommodation Workforce (§19 preserved · no cross-domain mutation path)
  · nex.accommodation_business schema (§39 preserved · zero DB change)
```

## Files shipped — 10 production (2 under §26 cap)

### New (7)
- `src/lib/nex/entity-universe/types.ts` — BusinessIdentity · BusinessPlacement · LocationRef · CategoryAssignment · EvidenceRef · ChangeRecord · PlacementStatus · AttributeFreshnessClass · rateFreshness + DEFAULT_FRESHNESS_TTL_MS
- `src/lib/nex/entity-universe/identity-matching.ts` — matchBusiness(candidate, pool) → MATCH / AMBIGUOUS / NO_MATCH with score_breakdown + competing_matches. Same-city continuity +0.15 · same-province +0.05 · cross-city-name-only -0.20. Force AMBIGUOUS when top-2 within 0.10.
- `src/lib/nex/entity-universe/lifecycle.ts` — decidePlacementIntent (APPEND_NEW_ACTIVE / MOVE_MARK_PRIOR_HISTORICAL / CLOSE_PRIOR / MARK_AMBIGUOUS / NO_CHANGE) · diffPlacementAttributes · diffBusinessIdentity · evolveCategory (retains prior as additional_sub_categories) · canPlacementStatusTransition + assertPlacementStatusTransition
- `src/lib/nex/entity-universe/persistence.ts` — JSONL store · atomic tmp+rename · recordEvidence · upsertBusiness · upsertPlacement · demotePlacementsToHistorical · buildCandidatePool
- `src/lib/nex/entity-universe/query.ts` — readBusinessDetail (composes identity+placements+changes+discovery_flags) · findActiveBusinessesByCity/Province/Category · siblingActiveLocations · historicalLocations
- `src/app/api/nex-entity-universe/business/[id]/route.ts` — GET business detail (public read · honest active/historical/closed separation)
- `scripts/install-nex-agent-scheduled-task.ps1` — per-user (no admin) Task Scheduler registration for `node scripts/nex-agents.mjs start all` at logon of current user
- `scripts/uninstall-nex-agent-scheduled-task.ps1` — companion uninstaller

That's actually 8 new files. Let me recount:
1. types.ts
2. identity-matching.ts
3. lifecycle.ts
4. persistence.ts
5. query.ts
6. /api/nex-entity-universe/business/[id]/route.ts
7. install-nex-agent-scheduled-task.ps1
8. uninstall-nex-agent-scheduled-task.ps1

### Modified (2)
- `src/lib/nex/agent-runtime/internet-check.ts` — added NEX_AGENT_INTERNET_FORCE_OFFLINE / NEX_AGENT_INTERNET_FORCE_ONLINE env-var check at top of `probeInternet()`. Read on every call so a mid-lifetime env flip is picked up.
- `scripts/nex-agents.mjs` — added `universe status | universe business <id> | universe demo` and `scheduled-task install | uninstall | status` subcommands.

**Total production files: 10 of §26 cap of 12.**

### Test file (does not count)
- `src/lib/nex/entity-universe/entity-universe.test.ts` — 40 tests all pass

### Fixtures + reports (do not count)
- `tests/fixtures/conversation-followup-proof/_agent_runtime_phase_b_live_probes.mjs` + `.json` receipt

## Runtime changes

- Internet-check now reads `NEX_AGENT_INTERNET_FORCE_OFFLINE=1` (or `_FORCE_ONLINE=1`) on every probe call. Zero effect when env var is unset — production behaviour unchanged. Enables §29 cross-process live proof.
- No changes to control-plane · registry · heartbeat · event-bus · watchdog · workers.

## Windows persistence

**Installer**: `scripts/install-nex-agent-scheduled-task.ps1`
- **Task name**: `NEX-Agent-Runtime-User`
- **Principal**: `Interactive` · `Limited` run level · CURRENT USER (no admin required)
- **Trigger**: `AtLogOn -User <current_user>` with 30-second delay for filesystem/network readiness
- **Action**: `cmd.exe /c "<node.exe>" "<repo>\scripts\nex-agents.mjs" start all >> "<repo>\data\nex-agent-runtime\scheduled-task-launch.log" 2>&1`
- **Settings**: AllowStartIfOnBatteries · DontStopIfGoingOnBatteries · StartWhenAvailable · RestartCount=5 · RestartInterval=1min · ExecutionTimeLimit=365d · MultipleInstances=IgnoreNew

**Verified via `Get-ScheduledTask -TaskName NEX-Agent-Runtime-User`**:
```
TaskName    : NEX-Agent-Runtime-User
State       : Ready
Description : NEX Agent Runtime - per-user daemon startup at logon - founder-authorized Phase B
Triggers    : 1 trigger(s)
User        : LAPTOP-64CU461J\Victus
Action      : cmd.exe /c "C:\Program Files\nodejs\node.exe" ...
```

**§45 YELLOW disclosure**: I registered the task and verified it via `Get-ScheduledTask`, but I did NOT reboot the machine to prove reboot-survival end-to-end (reboot cannot safely be automated from within Claude Code — it would kill my session and every daemon). **Manual proof procedure**:
```
1.  Log out of Windows.
2.  Log back in (or reboot + auto-logon).
3.  Wait 30 seconds (task delay).
4.  Run: node scripts/nex-agents.mjs status
5.  Expected: PROGRAMMER + ACCOMMODATION both RUNNING with fresh heartbeats
    (spawned by the Task Scheduler at logon).
```

## Internet fault handling

**Live proof captured in `data/nex-agent-runtime/events.jsonl`**:

Phase 1 · accommodation restarted with `NEX_AGENT_INTERNET_FORCE_OFFLINE=1`:
```
11:02:42 WORK_COMPLETED {"work":"freshness_scan","total_records":1,"due":0}   <- LOCAL_SAFE keeps running
11:02:42 WORK_BLOCKED   {"work":"freshness_refresh","reason":"internet_offline_or_unknown"}
11:03:42 WORK_COMPLETED {"work":"freshness_scan",...}
11:03:42 WORK_BLOCKED   {"work":"freshness_refresh","reason":"internet_offline_or_unknown"}
11:04:42 WORK_COMPLETED {"work":"freshness_scan",...}
11:04:42 WORK_BLOCKED   {"work":"freshness_refresh","reason":"internet_offline_or_unknown"}
11:05:42 WORK_COMPLETED {"work":"freshness_scan",...}
11:05:42 WORK_BLOCKED   {"work":"freshness_refresh","reason":"internet_offline_or_unknown"}
11:06:42 WORK_COMPLETED {"work":"freshness_scan",...}
11:06:42 WORK_BLOCKED   {"work":"freshness_refresh","reason":"internet_offline_or_unknown"}
```

Phase 2 · restarted WITHOUT the env var (new run_id):
```
11:06:54 WORK_COMPLETED {"work":"freshness_scan",...,"run_id":"862ce4ad..."}
11:07:54 WORK_COMPLETED {"work":"freshness_scan",...,"run_id":"862ce4ad..."}
```
**No `WORK_BLOCKED` events post-restart** — network work path is unblocked. Recovery confirmed.

Assertion: LOCAL_SAFE work (`freshness_scan`) ran continuously across both phases. NETWORK_REQUIRED work (`freshness_refresh`) was gated OFF during Phase 1 and unblocked in Phase 2. No runaway retries. No process crash.

## Agent control flow

Unchanged from prior slice. START / STOP / STATUS / START ALL / STOP ALL / watchdog-tick all work as before. Verified in the same live proof session (agents currently RUNNING · Programmer PID 29476 · Accommodation PID 37800).

## Programmer separation (§18)

- Programmer Agent modules under `src/lib/nex/programmer-*/` — 4 directories, 29 files — **UNCHANGED**.
- Entity-universe modules have zero imports from `programmer-*/`.
- Programmer worker (`worker-programmer.ts`) has zero imports from `entity-universe/`.
- No cross-agent mutation path exists.

## Accommodation separation (§19)

- Accommodation worker (`worker-accommodation.ts`) — **UNCHANGED**.
- `nex.accommodation_business` Postgres schema — **UNCHANGED** (§39).
- Entity-universe's `world_record_ref` field OPTIONALLY references `WorldRecord.id` for future integration but this slice writes no accommodation records and no linkages.

## Indonesia-wide entity model

Composed with existing primitives per §14:
- **Province codes**: from `data/indonesia/geo/provinces.json` (ISO 3166-2 · 34 provinces).
- **City slugs**: from `accommodation-slots.ts` regex normalizer (yogyakarta/jogja/jogjakarta → "yogyakarta").
- **Vertical**: from `WorldVertical` union (accommodation/food/service/commerce/transport/places).
- **Sub-category**: free string · Phase B ships the shape; per-vertical exhaustive taxonomies belong to Phase C+ slices.

No hard-coded city list. No hard-coded region rules. Extensible to any Indonesian city that has a slug in the normalizer + a province in provinces.json.

## Business identity + location handling

- **Identity** is `business_id` (opaque `biz_ID_<uuid>`), independent of location.
- **Placement** is a distinct concept — a physical/operational placement in a specific city+address for a time-window with a specific status.
- **One business can have 0..N active placements** (§5 multi-location).
- **One placement is bound to a single location** — moving means demoting the old placement to HISTORICAL and creating a new active placement (§4).

## Movement handling (§4 · §23)

Live-proven scenario A: **Business relocation Yogyakarta → Jakarta**
```
Day 1  · business Example Restaurant · placement yog (ACTIVE)
Day 100 · relocation evidence
        · decidePlacementIntent returns MOVE_MARK_PRIOR_HISTORICAL
        · new Jakarta placement created (ACTIVE)
        · yog placement demoted to HISTORICAL
        · STATUS_CHANGED record appended (prev=ACTIVE, new=HISTORICAL, reason=relocated_to_jakarta_owner_attested)

Customer query "restaurants active in Yogyakarta" for this business → 0 results (§4 immutable)
Customer query "restaurants active in Jakarta"    for this business → 1 result
```

## Multi-location handling (§5 · §24)

Live-proven scenario B: **Example Gym in 3 cities**
```
One BusinessIdentity biz_gym
  placement_1 (ACTIVE) · yogyakarta / ID-YO
  placement_2 (ACTIVE) · jakarta    / ID-JK
  placement_3 (ACTIVE) · bandung    / ID-JB
siblingActiveLocations(biz_gym) returns 3 sorted-by-city results
discovery_flags.has_multiple_active_locations = true
discovery_flags.has_any_historical_location   = false
```

## Movement-vs-duplicate handling (§25)

Live-proven scenario C: **"Warung Melati" in yogyakarta vs a candidate observation in surabaya with different phone**
```
matchBusiness(candidate, pool) →
  verdict: NO_MATCH  (or AMBIGUOUS at the border · never MATCH)
  score:   0.45  (below the 0.55 AMBIGUOUS threshold)
  best_business_id: null

Result: no auto-merge · a new BusinessIdentity would be created if the caller decides to persist it, preserving both identities honestly.
```

## Category handling (§6 · §7)

- Vocabulary: WorldVertical + sub_category (string) + additional_sub_categories (string[]).
- Never invents a category — `specificity: "UNKNOWN_NEEDS_CLASSIFICATION"` for unclassified.
- **Evolution preserves history** (live-proven scenario E): a "cafe" that adds "restaurant" as an evolution keeps "cafe" in `additional_sub_categories` — never erased.

## Evidence handling (§10 · §11 · §22)

- Every claim cites `evidence_ids[]`.
- Evidence tiers: OWNER_ATTESTED · PRIMARY_SOURCE · SECONDARY_SOURCE · OBSERVED · USER_SUPPLIED · INFERRED · UNKNOWN.
- Missing evidence = UNVERIFIED, never FALSE.
- Change records include evidence chain for the mutation, not just the new value.

## Freshness (§12)

- Per-attribute-class TTL:
  - STABLE_IDENTITY: 90 days
  - STABLE_LOCATION: 30 days
  - DYNAMIC_CAPABILITY: 7 days
  - LIVE_STATUS: 15 minutes
- `rateFreshness()` returns CURRENT / STALE / UNVERIFIED / CONFLICTING / UNKNOWN.
- `is_conflicting` short-circuits to CONFLICTING regardless of age.
- Null `last_observed_iso` returns UNKNOWN (never guesses).

## Change detection (§11 · §33)

- `diffPlacementAttributes` returns `ChangeRecord[]` for every mutated attribute (phone / whatsapp / website / email / opening_hours / location / category / status). Idempotent — returns `[]` when nothing changed.
- `diffBusinessIdentity` returns `ChangeRecord[]` for name/alternate-name changes.
- Live-proven scenario D: a phone change from `"+62 old"` → `"+62 new"` produced exactly 1 `PHONE_CHANGED` record with previous_value + new_value + change_reason + evidence_ids + confidence.
- `demotePlacementsToHistorical()` writes `STATUS_CHANGED` records atomically.

## Resource governance

Unchanged from prior slice. This slice adds no new concurrency, no new queues, no new external calls. JSONL persistence uses atomic tmp+rename.

## Database changes

**None (§39).** All entity-universe state persists as JSONL under `data/nex-entity-universe/`. Production migration path (row shapes map 1:1 to Postgres tables) is a separate authorization.

## Unit tests

- 40 new tests in `entity-universe.test.ts` cover: freshness · identity matching (owner_nex_id · phone continuity · same-city bonus · cross-city penalty · dual-candidate force-AMBIGUOUS · empty pool) · placement intent · diff functions · category evolution · status transitions · persistence round-trip · multi-location · movement · findByCity/Province/Category · candidate pool · discovery flags.
- All 40 pass first-completed-run (2 initial failures fixed by adding the same-city continuity bonus to the matcher — real signal I wasn't crediting).

## Full regression

```
BEFORE = 4331 passed | 44 skipped | 4375 total (168 files)
AFTER  = 4371 passed | 44 skipped | 4415 total (169 files)
DELTA  = +40 passed (exactly 40 new entity-universe.test.ts tests)
         +1 file
         0 skip Δ · 0 fail · 0 deleted · 0 weakened
```

Every delta explained. New authoritative baseline: **`npx vitest run src/lib/nex/brain src/lib/nex/live src/lib/nex/agent-runtime src/components/nex-app/live src/lib/nex/entity-universe` → 4371 passed | 44 skipped | 4415 total.**

## Live OS proof

**Entity-universe scenarios (5/5 PASS):**
- A · movement Yog → Jak · identity preserved · historical/active correctly separated · customer query honest
- B · multi-location gym in 3 cities · 3 sibling active locations · discovery_flags correct
- C · same name different city with different phone · verdict NO_MATCH · no merge
- D · phone change produces ChangeRecord with prev+new+evidence · no blind overwrite
- E · category evolution retains prior sub_category as additional

**Runtime hardening:**
- Internet cross-process fault injection: OFFLINE via `NEX_AGENT_INTERNET_FORCE_OFFLINE=1` proven across 5 60-second cycles. Recovery proven after restart without env.
- Scheduled Task registered as `NEX-Agent-Runtime-User` · State=Ready · verified via `Get-ScheduledTask`.

**Agent daemons final state:**
- PROGRAMMER PID 29476 · RUNNING · fresh heartbeat
- ACCOMMODATION PID 37800 · RUNNING · fresh heartbeat · internet ONLINE
- Both survived through: stop / start-with-env / stop / start-without-env cycles
- Founder STOP override respected throughout

## Browser proof

**N/A · this slice ships zero UI.** Consistent with §17 spirit — browser proof is mandatory where UI exists; contract-only slices need only unit + live-OS proof.

## Restart/recovery proof

- Programmer daemon survived through the entire test session unchanged (PID 29476 unchanged from prior slice · fresh heartbeat throughout).
- Accommodation daemon went through TWO restart cycles (offline test + recovery) · watchdog respected desired_state each time · new PIDs recorded honestly.
- No crash. No runaway restart. No fabricated recovery.

## Known limitations (§45 YELLOW)

1. **Physical reboot survival not tested end-to-end.** The Scheduled Task is registered and inspectable via `Get-ScheduledTask`, but a real reboot would kill this Claude Code session. Manual verification procedure documented above.
2. **Programmer worker did not integrate with the entity-universe** — Phase B ships the entity-universe as a standalone subsystem consumable by future workers. Wiring accommodation worker to emit `LEARNING_OBSERVED` events specifically about business identity is a Phase C item.
3. **API is public read-only** — POST/PUT/DELETE for the universe requires an authenticated write authorization (separate slice).
4. **No admin-context system Task installed** — only per-user. For headless server / always-on across all sessions, an admin-context installer or Windows Service is a separate authorization.
5. **Test-count reference in the founder authorization §40 ("4256 passed") reflects pre-slice-stack state.** True baseline before this slice was 4331 (after all intervening slices). Regression reconciled honestly against actual baseline.

## Anything not proven

- **Machine reboot survival**: not tested (see limitation 1 above). Registration is verified; automatic-startup-at-logon is the Windows Task Scheduler's documented contract.
- **Cross-agent privilege escalation attempt**: no code path exists for it (§18 §19 preserved structurally); explicit adversarial test deferred to a future security-slice.

## Anything requiring a future authorization

- Migration of accommodation records into the entity-universe (populates `world_record_ref` links).
- Programmer worker integration to observe business-identity events.
- Write endpoints for the universe (POST/PUT/DELETE with authenticated actor).
- Postgres migration for JSONL → tables.
- Full accommodation acquisition pipeline that produces evidence and calls into the universe on every observed record.
- Admin-context Windows Service for always-on across all sessions.
- Change-history query UI for moderator inspection.

## Final verdict

**GREEN** for §1-§14 (Indonesia-wide business universe) · §17-§22 (evidence + freshness + observability) · §25 (movement vs duplicate) · §29 (internet fault injection cross-process) · §30-§34 (resource + observability + no unrestricted autonomy).

**GREEN + YELLOW** for §28 (Windows persistence): Scheduled Task installed and verified · actual reboot proof deferred honestly per §45.

**HARD STOP per §46.** No new agents. No expanded autonomy. No unrelated product work. Awaiting founder direction.
