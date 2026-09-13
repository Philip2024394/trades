# WO-HQ-AGENTS-01 · NEX HQ Agents live-observation page

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — the explicit gate is at the end of this document.**

**Doctrine anchor:** P-Q (correction never creates authority) + P-U (more intelligence ≠ more authority) — this page is **read-only observation**. No button on this page can create, modify, or activate any capability.

**Programme track:** parallel with WO-WORKSTATION-14/15 and WO-INTELLIGENCE-02. Small, well-scoped UI + data-plumbing WO.

---

## 1 · Purpose

Founder request:
> "we need page in hq that displaying the agents and their names and pipe wire line and their processing details live"

Delivers a single HQ page that shows, at a glance:

- Every named NEX agent that exists in the current build
- A wireline pipeline diagram connecting them (who feeds whom)
- Live processing details for each — last action timestamp, current state, evidence counts
- All observed from real GB storage — no fabricated data

## 2 · Non-goals

- **Not** a control surface. No "start / stop / configure / authorise" buttons. Observation only.
- **Not** an authorisation gate. Cannot sign / promote / approve anything from this page.
- **Not** a substrate modification.
- **Not** a real-time push system. Slice 1 uses polling; slice 2+ may add SSE.
- **Not** a mobile experience — HQ is founder-desktop scope.
- **Not** a public page. Behind existing NEX HQ auth.

## 3 · Route + placement

- Route: **`/nex-head-quarters/agents`**
- File: `src/app/nex-head-quarters/agents/page.tsx`
- Existing HQ pattern matched (see `src/app/nex-head-quarters/audit/page.tsx` for prior art)

## 4 · Named agents to display (slice 1 initial set)

These are the agents that currently exist as real code paths in the repo. Each has a live state derivable from GB.

| Agent name | Kind | GB source for live state |
|---|---|---|
| **NEX1 Master Engineer** | Orchestrator | `nex1_workflow_traces`, `nex1_audit_events` |
| **WO-03 Code Generation Pipeline** | Author-stage | `nex1_execution_reports` (bundle emission) |
| **WO-04 Broker Executor** | Write-stage | `nex1_execution_reports` |
| **WO-05 Build Executor** | Build-stage | `nex1_build_reports` |
| **WO-06 Runtime Executor** | Runtime-stage | `nex1_runtime_reports` |
| **WO-07 Node-Syntax Specialist** | Validation-stage | `nex1_specialist_results` |
| **WO-09 Corrector** | Correction-stage | derived from cycle history |
| **WO-13 Substrate Guard** | Enforcement | (health-signal read from cache) |
| **NEX Intelligence · Crawler** | Data collection | `nex_intelligence_sources`, `nex_intelligence_crawler_audit` |
| **NEX Intelligence · Discovery Engine** | Discovery | `nex_intelligence_knowledge_objects` (discovery kind) |
| **NEX Intelligence · Hypothesis Engine** | Hypothesis | `nex_intelligence_hypotheses` |
| **NEX Intelligence · Experiment Engine** | Experiment | `nex_intelligence_experiments` |
| **NEX Intelligence · Scoring / Promotion** | Scoring | `nex_intelligence_knowledge_objects` |
| **NEX Intelligence · Proposal Generator** | Proposal | `nex_intelligence_proposals` |

Slice 2+ may add Guardian (Phase 14), Vision (Phase 9), Twin agents (Phase 13) — each additional agent is a new WO.

## 5 · Wireline pipeline visualisation

Deterministic diagram (SVG or CSS-grid) showing message flow between agents. Two lanes:

```
NEX1 ORCHESTRATOR LANE
[NEX1 Master Engineer] → [WO-03] → [WO-04] → [WO-05] → [WO-06] → [WO-07] → [WO-09]
                                     │
                                     ▼
                            [WO-13 Substrate Guard]

NEX INTELLIGENCE LANE
[Crawler] → [Ingestion] → [Discovery] → [Hypothesis] → [Experiment] → [Scoring] → [Proposal]
```

Each node is a rectangle labelled with the agent name + a small live-state indicator:
- Colour: green (recent activity), amber (idle > N minutes), grey (never observed this session)
- Numeric badge: total records observed for that agent
- Right-side detail: last activity timestamp

Edges between nodes are static (they represent code-level wiring, not runtime state). Slice 2 may show a heartbeat pulse when a record flows edge-adjacent.

## 6 · Live processing details

For each agent, the page shows:

- **Name** (from the table in §4)
- **Kind** (from the table in §4)
- **Last activity** — most recent `*_at` timestamp from the underlying collection
- **Total records observed** — count in the collection
- **Recent record IDs** (latest 3, id-only, no PII)
- **Health signal** — derived colour (see §5)

## 7 · Data source discipline

- Reads exclusively from existing GB collections via `getStorage()` — no new collection is created for this page
- **Zero writes** to any collection (grep-verified in the adversarial tests §9)
- No fetch to any external URL
- No inclusion of any LLM SDK
- Polling interval: 5 seconds (configurable via URL query `?poll=Nms`, capped to 1s min / 60s max)

## 8 · Route implementation shape

- Server component fetches the initial snapshot on request
- Client component polls a small internal API route (`/nex-head-quarters/agents/api/live-state`) at the configured interval
- API route reads from GB storage collections; returns a bounded snapshot JSON
- No caching layer beyond the browser's default (avoids stale data)
- Errors surface as visible red state on the specific agent card — page keeps rendering

## 9 · Adversarial acceptance tests (slice 1)

Every test in the "secretly try to do X → refused" shape.

1. **A-1** · The page and its API route contain zero calls to `getStorage().save(*)` (grep-verified)
2. **A-2** · The page and its API route contain zero calls to any signing helper (`signAuthorization`, `signCrawlerManifest`, `signFounderKeyManifest`)
3. **A-3** · The API route only READS from the specific approved collections; grep-verified against an allowlist
4. **A-4** · No mutating HTTP methods (POST/PUT/DELETE/PATCH) are handled on the agents API route; a POST attempt returns 405 Method Not Allowed
5. **A-5** · The page contains zero external LLM SDK imports (`openai`, `@anthropic-ai`, `@google-ai`, `cohere`, `mistral`, `@aws-sdk/client-bedrock`)
6. **A-6** · The page contains no external URL fetch (`fetch(`, `axios`, `node:http.request` etc.) other than to same-origin `/nex-head-quarters/agents/api/live-state`
7. **A-7** · The page returns 401/403 to unauthenticated requests (reuses the existing HQ auth pattern — grep-verified same guard as `audit/page.tsx`)
8. **A-8** · The page does NOT reveal secret material: `attestation_signature_hex`, `founder_key_id`, `raw_content_ref` are stripped from responses (grep-verified in the API route serialiser)

Plus positive tests:
- **P-1** · When each collection contains ≥ 1 record, the page's snapshot shows the right agent as `green` with correct counts
- **P-2** · When a collection is empty, the corresponding agent shows `grey` state (never a false-positive green)
- **P-3** · Deterministic snapshot format — same GB state → identical API JSON (byte-for-byte after key sort)

## 10 · Success criteria

1. Route `/nex-head-quarters/agents` renders 14 agents in the two lanes shown in §5
2. Live state polls every 5s by default
3. All 8 adversarial tests pass
4. All 3 positive tests pass
5. Existing 227-test suite unaffected (regression: 227 + N new tests all pass)
6. Zero writes, zero external calls, zero LLM imports (grep-verified)
7. Page is reachable behind existing NEX HQ auth

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-INTELLIGENCE-01 complete (satisfied) — supplies half the agents shown
- **May run in parallel with:** WO-INTELLIGENCE-02, WO-WORKSTATION-14, WO-WORKSTATION-15
- **Does NOT depend on:** Phase 9 Vision, Phase 14 Guardian (their agents can be added in slice-2+ WOs)
- **Does NOT block anything**

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI will not:
- Create any file under `src/app/nex-head-quarters/agents/`
- Create any API route
- Add any new storage collection
- Add any new dependency to `package.json`

Until the founder explicitly authorises WO-HQ-AGENTS-01 execution by one of:

- "Authorise WO-HQ-AGENTS-01 execution" (full)
- "Authorise WO-HQ-AGENTS-01 with modification: [specific]" (spec-adjusted)
- "Refine [specific section] first" (spec revision)
- "Not now" (deferred; specification remains on record)
- Something else you direct

---

**End of specification. Awaiting founder authorisation to proceed.**
