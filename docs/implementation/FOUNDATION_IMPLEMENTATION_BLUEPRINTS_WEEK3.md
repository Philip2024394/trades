# Foundation Implementation Blueprints · Week 3

**Engineering-execution specs · 2026-07-23**
**Purpose:** for each of the 4 foundation items in Week 3 Priority 2, the concrete implementation-ready blueprint. Engineers execute directly from these upon ADR acceptance.

**Migration files prepared in `docs/implementation/pending-migrations/`** — promoted to `supabase/migrations/` on ADR acceptance.

---

## Item 1 · Data Portability Workflow

### Depends on
- ADR-0016 Accepted
- Migration `gdpr_requests.sql` promoted

### Scope
- Merchant Owner initiates export via Settings → Data → Export My Business
- Async job assembles per-tenant-table JSON exports + media asset manifest
- Zip file delivered via signed URL with 7-day expiry
- Email notification when ready
- Full audit trail

### Files to create

```
src/lib/nex/gdpr/
├── index.ts                      # Barrel
├── types.ts                      # GdprRequest, PortabilityExport
├── portability/
│   ├── initiate.ts               # POST /api/nex/settings/data/export handler
│   ├── worker.ts                 # Background job assembling export
│   ├── table-registry.ts         # Registry of tenant tables + serializers
│   ├── media-manifest.ts         # Collect media asset references
│   └── delivery.ts               # Signed URL + email
├── audit.ts                      # Audit log entries
└── portability.test.ts           # Test suite
```

### Key implementation notes

**Table registry pattern:**
```typescript
// table-registry.ts
export const EXPORTABLE_TABLES = [
  { table: 'hammerex_nex_projects', scope: 'merchant_slug', pii_columns: ['customer_id'] },
  { table: 'hammerex_nex_customers', scope: 'merchant_slug', pii_columns: ['email','phone','address'] },
  { table: 'hammerex_nex_memory_company', scope: 'merchant_slug', pii_columns: [] },
  // ...
] as const;
```

Registry pattern ensures every new tenant table added to the platform requires explicit inclusion decision (default: not exported until reviewed).

**Signed URL:**
- Generated via Supabase Storage `createSignedUrl(path, 60 * 60 * 24 * 7)`
- Delivery email includes single-use magic link
- URL logged in `hammerex_nex_platform_gdpr_requests.export_url`

**Worker:**
- Serverless function on Vercel with 15-minute timeout
- Large exports (>500MB): chunked into multiple files, tar.gz at end
- Progress reported via Supabase Realtime channel `gdpr:<request_id>`

### Tests required

- Export includes all rows for merchant_slug
- Export excludes rows for other merchants (isolation verified)
- Export format matches import-compatible schema
- Signed URL expires after 7 days
- Concurrent request prevention (409)
- Failed export handled gracefully with retry

### Definition of Done

- 5 pilot merchants complete export successfully
- Third-party JSON validator passes on output
- Legal Counsel signs off on export scope covering GDPR Art. 20
- Advisory panel confirms UX clarity

### Engineering estimate

3 engineer-weeks

---

## Item 2 · Right to be Forgotten Workflow

### Depends on
- ADR-0016 Accepted
- Migration `gdpr_requests.sql` promoted
- Data Portability workflow deployed (audit precedent)

### Scope
- Merchant Owner initiates via Settings → Data → Delete My Business
- 30-day appeal window during which merchant can reverse
- After appeal: cascade delete across all tenant tables
- Media asset deletion from Storage
- Memory rollup regeneration triggered
- Audit log rows retained with PII redacted per jurisdiction floor

### Files to create

```
src/lib/nex/gdpr/
├── rtbf/
│   ├── initiate.ts               # POST /api/nex/settings/data/delete
│   ├── appeal.ts                 # Reverse decision within 30-day window
│   ├── cascade-delete.ts         # Orchestrator for all tenant tables
│   ├── media-delete.ts           # Storage asset removal
│   ├── audit-redact.ts           # Redact PII in audit log rows (per jurisdiction)
│   ├── rollup-regen.ts           # Trigger memory rollup recomputation
│   └── notify.ts                 # Confirmation email + logging
└── rtbf.test.ts
```

### Key implementation notes

**Cascade delete order:**
1. Cancel active subscriptions (Stripe)
2. Revoke API tokens
3. Delete session tokens
4. Delete tenant table rows in FK-safe order (children before parents)
5. Delete media assets from Storage buckets
6. Redact PII in `hammerex_nex_platform_audit_log` per jurisdiction floor
7. Remove from cross-tenant rollups + trigger regen
8. Notify merchant + team members
9. Update `hammerex_nex_platform_gdpr_requests.status = 'complete'`

**Jurisdiction-aware retention floors:**
```typescript
const RETENTION_FLOORS: Record<string, number> = {
  UK: 6 * 365,   // 6 years HMRC tax
  IE: 6 * 365,   // 6 years Irish Revenue
  AU: 7 * 365,   // 7 years ATO
  US_default: 4 * 365, // 4 years IRS
};
```

Audit rows older than floor are hard-deleted. Newer rows retained with PII columns nulled.

**Appeal reversal:**
- Status returns to 'cancelled'
- No cascade action taken
- Merchant receives confirmation

### Tests required

- Full cascade delete completes for pilot merchant
- No orphaned rows in any tenant table
- Media assets removed from Storage
- Audit log rows correctly redacted (PII null, IDs preserved)
- Rollup regeneration correctly excludes deleted merchant
- Appeal within window reverses cleanly
- Appeal after window fails cleanly
- Concurrent requests handled correctly

### Definition of Done

- 1 test merchant successfully cascade-deleted in staging
- All 20+ tenant tables verified empty for test merchant
- Legal Counsel signs off on jurisdiction handling
- Advisory panel confirms 30-day appeal UX clarity

### Engineering estimate

4 engineer-weeks (higher complexity than portability due to cascade + audit + rollup regen)

---

## Item 3 · RBAC V0

### Depends on
- ADR-0019 Accepted
- Migration `rbac_v0.sql` promoted

### Scope
- 3 roles: Owner · Manager · Member
- Permission matrix enforced at application layer + RLS
- Team invitation flow via email
- Team member management UI in Studio
- Every API endpoint enforces permissions

### Files to create

```
src/lib/nex/auth/
├── index.ts                      # Barrel
├── types.ts                      # Role, Permission, TeamMember
├── permissions.ts                # Permission matrix + check functions
├── middleware.ts                 # Route handler middleware for permission enforcement
├── invitation/
│   ├── invite.ts                 # POST /api/nex/merchants/<slug>/team
│   ├── accept.ts                 # POST /api/nex/invitations/<token>/accept
│   └── revoke.ts                 # DELETE /api/nex/merchants/<slug>/team/<id>
├── rls-templates.ts              # Shared RLS policy generator
└── permissions.test.ts
```

### Key implementation notes

**Permission matrix (from RBAC migration seed):**
```typescript
// permissions.ts
export type Role = 'owner' | 'manager' | 'member';
export type Action = 'read' | 'write' | 'approve' | 'delete';

export function can(
  role: Role,
  moduleScope: string[] | null,  // Manager's assigned modules
  action: Action,
  target: { module: string; ownedByUserId?: string; currentUserId: string }
): boolean {
  if (role === 'owner') return true;

  if (role === 'manager') {
    if (!moduleScope || !moduleScope.includes(target.module)) return false;
    return action !== 'delete' || target.module !== 'merchant'; // Cannot delete the merchant itself
  }

  if (role === 'member') {
    if (action === 'read') return true;                       // Members read within their assigned module
    if (action === 'write') return target.ownedByUserId === target.currentUserId;
    return false;
  }

  return false;
}
```

**Middleware pattern:**
```typescript
// middleware.ts
export function requirePermission(module: string, action: Action) {
  return async (req: Request, ctx: Context) => {
    const user = await getUser(req);
    const membership = await getMembership(user.id, ctx.merchant_slug);
    if (!can(membership.role, membership.module_scope, action, { module, currentUserId: user.id })) {
      return json({ ok: false, errors: [{ code: 'not_authorised', ... }] }, { status: 403 });
    }
    // continue
  };
}
```

Every API route wraps with `requirePermission(...)`.

**Invitation flow:**
- Owner invites via email address
- Signed invitation token emailed to invitee
- Invitee accepts via link
- Row created in `hammerex_nex_team_members` with `status='active'`

### Tests required

- Owner has all permissions in their merchant
- Manager restricted to assigned module scope
- Member can only read module + write own records
- Cross-merchant permission attempts blocked
- Invitation token single-use
- Expired invitations reject cleanly
- Revoked members cannot access

### Definition of Done

- 5 pilot merchants configure team with mix of roles
- Permission enforcement verified at API layer
- RLS policies verified via adversarial tests
- Advisory panel confirms permission UX clarity

### Engineering estimate

4 engineer-weeks (biggest of the 4 · touches every API endpoint)

---

## Item 4 · AI Model Failure Handling

### Depends on
- ES-04 §11 Accepted (part of ES-04 completion)
- Migration `ai_provider_status.sql` promoted
- Existing `src/lib/studio/aiGateway.ts` extended

### Scope
- Per-capability fallback ladder
- Circuit breaker per provider per capability
- Cached similar response mechanism for Vision + Embeddings
- Canned polite response ultimate fallback
- Graceful merchant UX during degradation

### Files to touch / create

```
src/lib/studio/aiGateway.ts             # EXTEND (existing)
src/lib/nex/ai/                         # NEW module (thin orchestration layer)
├── index.ts
├── types.ts                            # FallbackTier, CircuitState
├── router.ts                           # Routes by capability + fallback ladder
├── circuit-breaker.ts                  # Per-provider circuit state
├── cache/
│   ├── similar-image.ts                # Cached Vision responses
│   └── similar-prompt.ts               # Cached LLM responses
├── fallback/
│   ├── canned-responses.ts             # Ultimate polite fallback
│   └── manual-queue.ts                 # Requeue for later processing
├── budget/
│   └── enforcement.ts                  # Per-merchant daily budget
└── router.test.ts
```

### Key implementation notes

**Extend existing aiGateway:**
The existing `aiGateway` already picks by task support + health + budget. Additions needed:

1. **Circuit breaker state persistence** — read/write from `hammerex_nex_platform_ai_provider_status`
2. **Fallback ladder awareness** — after primary fails, walk the ladder from `hammerex_nex_platform_ai_fallback_ladder`
3. **Domain context logging** — every call logs `context_domains: string[]` per ADR-0021

**Router flow:**
```typescript
// router.ts
async function complete(request: AiCompleteRequest): Promise<AiCompleteResponse> {
  const ladder = await loadFallbackLadder(request.capability);
  for (const tier of ladder) {
    if (tier.strategy === 'canned_response') return cannedResponse(request);
    if (tier.strategy === 'cached_similar') return cachedSimilar(request);
    if (tier.strategy === 'manual_queue') return manualQueue(request);

    const provider = await lookupProvider(tier.provider_id);
    const circuitOk = await checkCircuit(provider.id, request.capability);
    if (!circuitOk) continue;

    try {
      const result = await withTimeout(provider.complete(request), 5000);
      await recordSuccess(provider.id, request.capability, result);
      await auditLog(request, result, tier.tier);
      return { ok: true, ...result };
    } catch (err) {
      await recordFailure(provider.id, request.capability, err);
      // Continue to next tier
    }
  }
  return { ok: false, error: { code: 'all_providers_failed' } };
}
```

**Merchant-facing UX during degradation:**
- Subtle banner: "AI service is degraded · some features slower than usual"
- Feature-level fallback labels ("Using cached response · original service temporarily unavailable")
- Cost impact honest (fallback tier may skip cost for canned responses)

### Tests required

- Primary provider healthy: routes to primary, records success
- Primary unhealthy, fallback healthy: routes to fallback tier 2, logs both
- All live providers fail: canned response returned honestly
- Circuit breaker opens after 3 consecutive failures
- Circuit breaker closes after 5-minute cooldown
- Budget cap enforced at merchant level
- Domain context logged in every call

### Definition of Done

- Chaos test: Anthropic API simulated 100% outage · fallback ladder engaged · merchants see banner but continue working
- Monthly chaos test cadence established
- Circuit breaker state persists across deploys
- Cost per merchant per day dashboarded

### Engineering estimate

3 engineer-weeks (moderate complexity · reuses existing gateway abstraction)

---

## Total Foundation Implementation Effort

- Data Portability: 3 weeks
- Right to be Forgotten: 4 weeks
- RBAC V0: 4 weeks
- Model Failure Handling: 3 weeks
- **Total: 14 engineer-weeks · 3-4 engineers parallelised over Weeks 3-6**

Realistic delivery:
- **End Week 4:** RBAC V0 + Model Failure Handling shipped (foundation for Workforce V0)
- **End Week 6:** Data Portability + Right to be Forgotten shipped (foundation for Memory V1 cross-tenant)

Memory V1 rollup implementation (Phase 1 Week 5-10) can begin as soon as GDPR workflows are shipping.

---

## Trade Brain Author Tooling MVP Status

Per Priority 3 request:

Migration `brain_content_v0.sql` prepared. Author tooling structure specified in `docs/TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`.

**Next action** upon ADR-0017 acceptance:
- Promote migration to `supabase/migrations/`
- Scaffold `src/apps/authors/` app under `authors.thenetworkers.app`
- Build Craft + Regulations module editors (MVP scope · Weeks 3-4)
- Onboard first Author (Electrician) with pair-programming Day 1

**Author tooling engineering estimate:** 17 engineer-weeks total (per Trade Brain Author Tooling Spec §9). MVP subset (Craft + Regulations only) achievable in 4 weeks with 2 engineers.

---

## Priority 4 · Domain Separation Rule

✅ **Delivered as ADR-0021 in prior turn.** Signoff scheduled Monday of Week 3.

`docs/DECISIONS/0021-intelligence-domain-separation.md` + `docs/NEX_INTELLIGENCE_STORAGE_ARCHITECTURE.md` provide the full specification.

Migration `brain_content_v0.sql` reflects the domain separation principle (brain_slug primary key propagates to every content row).

---

**End of Foundation Implementation Blueprints.**

*Ready for engineer execution the moment ADRs 0016-0021 are Accepted (target: end of Week 3).*
