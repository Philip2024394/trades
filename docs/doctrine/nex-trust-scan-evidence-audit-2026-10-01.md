# NEX Trust Scan · Evidence/Data Mapping Audit · 2026-10-01

**Status:** Phase 2 pre-build audit · founder-requested before the live
data provider is wired. See
`memory/nex_trust_scan_doctrine_2026_10_01.md` for the sealed design.

**Rule:** every field exposed in a Trust Scan must prove *why NEX is
allowed to show that aggregate to the scanning user* — not just that
the database contains it. Below each row is one line proving
authorisation (RLS or service-role aggregation), one line of privacy
classification, and one line stating the UI behaviour when the value
is unavailable (which per sealed Phase 2 doctrine must be `unknown`,
never caution/warning).

## Legend

| Marker | Meaning |
|--------|---------|
| ✅ | Safe to expose today under current schema + sealed doctrine |
| 🛠 | Needs new RLS policy or Server Action wrapper before shipping |
| 🚧 | Missing infrastructure · field stays `unknown` until schema lands |
| ⛔ | Doctrine-protected · must NEVER be exposed to the scanning user |

Privacy classifications:
- **Public reputation** · intentionally visible to any user who finds the account (per Terms § 5)
- **Aggregate-only** · count/stats visible, individual rows forbidden
- **Self-pair** · viewer may read only when they are a participant in the pair
- **Internal** · service-role or moderation surface only

---

## Block 1 · Identity (TrustScanIdentity.tsx)

| Field | Source | Current access | Safe to expose? | Rationale | Required change | Displayed wording | Unknown behaviour |
|---|---|---|---|---|---|---|---|
| `accountAgeDays` | `nex_account.created_at` | authenticated·self (RLS `nex_account_self_read`) | ✅ via service-role aggregation | Age is a reputation signal (Phase 1 doctrine); not PHI | Server Action calling admin client, returns `days` only | "Account age · 2y 4m" | NULL → `unknown` ("Account age unavailable") |
| `countryDeclared` | `nex_account.phone_country_code` ONLY | authenticated·self | ✅ (country code), ⛔ (number) | Country code is a legitimate declared-country signal (safe-trade doctrine 2026-09-28). Phone number itself is sealed-private-doctrine. | Server Action must SELECT country_code only, never number | "Country declared · ID" | NULL → "—" ("Country unavailable") |
| `countryConsistency` | derived (declared vs connection region) | n/a | 🚧 deferred | Sealed network-consistency doctrine not yet reopened | None in Phase 1 · engine already emits ⚪ "Network consistency unavailable" | n/a | always `unknown` (⚪) until founder reopens IP doctrine |
| `businessVerified` | `nex_business.verified_at` | public (`nex_business_public_read`) | ✅ | Admin-set public business signal (Bridge 30 doctrine 2026-09-28). | None | "Business · Verified / Unverified / N/A" | NULL → "N/A" when account has no `nex_business` row |
| `businessVerifiedAt` | `nex_business.verified_at` | public | ✅ | Same as above · date shown for context | None | "verified 18 Apr 2025" | omit when NULL |
| `profileCompleteness` | derived from `nex_account_profile` fields (avatar_url, display_name, daily_activity, avatar_face_verified) | public when `is_public = true` | ✅ as composite % | Each contributing field is public-when-is_public; aggregated % does not re-expose detail | Server Action must check `is_public = true` gate before computing | "Profile completeness · 85%" | missing → `unknown` ("Profile detail unavailable") |
| `claimed` | `nex_account.claimed_at` NULL vs not-NULL | authenticated·self | ✅ via Server Action | Bridge 99 doctrine 2026-09-30: claimed vs provisional is a lifecycle STATE scanning users need | Server Action returns boolean only | "Account status · Claimed / Provisional" | always resolvable (NULL = provisional) |
| **⛔ `phone_national_number`** | `nex_account.phone_national_number` | authenticated·self | ⛔ never | Identity doctrine 2026-09-23 + 024 seal: phone IS a credential attribute, NEVER displayed | Provider must SELECT country_code only; add CHECK or column list to query | never shown | n/a |
| **⛔ `supabase_user_id`** | `nex_account.supabase_user_id` | authenticated·self | ⛔ never | Credential↔identity anchor isolation | Provider must NEVER SELECT this column | never shown | n/a |
| **⛔ `verified_note`** | `nex_business.verified_note` | public (readable but internal) | ⛔ never | Bridge 30: internal admin note (e.g. "checked NPWP") | Explicit column exclusion in query | never shown | n/a |
| **⛔ `daily_activity_detail`** | `nex_account_profile.daily_activity_detail` | public when is_public | ⛔ never | JSONB with employer / institution text · personal privacy doctrine | Explicit column exclusion | never shown | n/a |
| **⛔ `safe_trade_consent_version`** | `nex_account.safe_trade_consent_version` | authenticated·self | ⛔ never | Internal tracking; only the FACT of consent is a signal | Provider surfaces `safe_trade_consent_at IS NOT NULL` boolean only | never shown | n/a |

---

## Block 2 · NEX History (TrustScanHistory.tsx)

Current state: `nex_report` and `nex_friend_edge` have **no authenticated RLS policies**. All reads go through `nexSupabaseAdmin` (service-role). `countPendingReportsAgainst()` in `report-service.ts` is already structured correctly: uses service-role, returns only COUNT, no rows.

| Field | Source | Current access | Safe to expose? | Rationale | Required change | Displayed wording | Unknown behaviour |
|---|---|---|---|---|---|---|---|
| `reportsReceived` | `COUNT(*) nex_report WHERE reported_account_id = scanned` | service-role only | ✅ via Server Action | Aggregate · no reporter identity · sealed anti-retaliation | Server Action `getTrustScanReportCounts(scannedId)` returning `{total, substantiated, pending, dismissed}` | "Reports received · 3 · 2 substantiated" | 0 → `unknown` ("No reports recorded by NEX") per Phase 2 doctrine |
| `reportsSubstantiated` | same + `status IN ('action_taken','escalated_to_law')` | service-role only | ✅ | Substantiation is a stronger signal than raw count | Same Server Action | rolled into row above | 0 while reports>0 → shown as 0 |
| `blocksReceived` | `COUNT(*) nex_friend_edge WHERE b_account_id = scanned AND status = 'blocked' AND requested_by != b_account_id` | service-role only | ✅ via Server Action | Aggregate · no blocker identity | Server Action `getTrustScanBlockCount(scannedId)` | "Blocks received · 7" | NULL → `unknown` |
| `reportCategories` | GROUP BY `nex_report.reason` + category-level substantiation | service-role only | ✅ | Category breakdown is aggregate; no row identity | Server Action returns `[{category, count, substantiated}]` | pills: `spam · 1`, `off_doctrine_payment · 1 (0)` | empty → omit section |
| `confirmedViolations` | 🚧 no `nex_account.confirmed_violations` column or equivalent | n/a | 🚧 missing infra | No field yet | Add `nex_account.confirmed_violations_count` admin-maintained column, or compute from `nex_report.status = 'action_taken'` | "Confirmed violations · 0" | always 0 for now, UI treats as `unknown` + reads tooltip "under review" |
| `suspensions` | 🚧 no `nex_account.suspended_at` or `nex_account.suspension_count` column | n/a | 🚧 missing infra | Admin UI exists at `/admin/.../UserSuspendButton.tsx` but no public column | Add `nex_account.suspended_at` (public SELECT policy with service-role-write) | "Suspensions · 0" | always 0 for now → `unknown` |
| `completedOrders` / `refundedOrders` / `cancelledOrders` | see Block 3 (counts live under Trading section) | — | ✅ via Server Action | Public reputation (Terms § 5 opt-in) | shared Server Action | — | — |
| `disputes` / `disputesResolved` | 🚧 no dispute table or column | n/a | 🚧 missing infra | NEX schema has no dispute concept distinct from order state | New table `nex_order_dispute` with (order_id, opener_id, opened_at, status, resolved_at) + RLS | "Disputes · 0 total · 0 resolved" | always 0 → `unknown` ("No dispute history available") |
| **⛔ reporter identity** | `nex_report.reporter_account_id` row-level | service-role only | ⛔ never | Sealed Phase 2 doctrine: anti-retaliation | Explicitly SELECT only aggregate counts; never return reporter_account_id to any client caller | never shown | n/a |
| **⛔ blocker identity** | `nex_friend_edge.requested_by` row-level for the scanned party's blocks | service-role only | ⛔ never | Anti-retaliation applies to blocks the same as reports | Aggregate query only | never shown | n/a |

---

## Block 3 · Trading Reputation (TrustScanTrading.tsx)

| Field | Source | Current access | Safe to expose? | Rationale | Required change | Displayed wording | Unknown behaviour |
|---|---|---|---|---|---|---|---|
| `completedTrades` | `COUNT(*) nex_order WHERE seller_account_id = scanned AND state = 'completed'` | service-role (no stranger-read RLS) | ✅ via Server Action | Seller reputation is public per Terms § 5 | Server Action `getTrustScanOrderAggregates(scannedId)` returns `{completed, refunded, cancelled}` | "Completed trades · 127" | 0 → `unknown` ("No trades on record") |
| `completionRate` | derived: completed / (completed + refunded + cancelled) | — | ✅ | Composite of public aggregates | Same Server Action computes rate | "Completion rate · 96%" | 0 trades → omit % and show `unknown` |
| `refunds` | `COUNT(*) nex_order WHERE seller_account_id = scanned AND state = 'refunded'` | service-role | ✅ | Public reputation | Same Server Action | "Refunds · 3" | NULL → `unknown` |
| `unresolvedDisputes` | 🚧 no dispute infra | n/a | 🚧 missing infra | — | Depends on new `nex_order_dispute` table | "Unresolved disputes · 0" | always 0 → `unknown` |
| `confirmedFraudFindings` | 🚧 no fraud flag on nex_order | n/a | 🚧 missing infra | — | Add `nex_order.fraud_confirmed_at` or separate `nex_order_fraud` table + admin-only write | "Confirmed fraud findings · 0" | always 0 → `unknown` |
| `safeTradeAcknowledged` | `nex_account.safe_trade_consent_at IS NOT NULL` | authenticated·self | ✅ via Server Action | Boolean · presence of consent, never version | Server Action returns boolean | "Safe Trade acknowledged · Yes / No" | NULL → "No" (never seen the modal yet) |
| `sellerActivity` | `nex_business.last_seller_activity_at` + `is_away` + `archived_at` | **public read** (`nex_business_public_read`) ✅ | ✅ direct | Bridge 13 sealed: activity + away is a public opt-in signal | None · can read directly from public RLS | "Seller activity · active / slow / away / archived" | no `nex_business` row → "N/A" (personal account) |

---

## Block 4 · Your Relationship History (TrustScanRelationship.tsx)

Pair-scoped: viewer must be one of the two parties. These reads should remain **self-pair**: viewer-authenticated with pair-filter in the WHERE clause.

| Field | Source | Current access | Safe to expose? | Rationale | Required change | Displayed wording | Unknown behaviour |
|---|---|---|---|---|---|---|---|
| `firstContactedAt` | MIN `created_at` of `nex_peer_conversation` where pair = (viewer, scanned) | `nex_peer_conversation_select`: viewer-is-participant RLS ✅ | ✅ direct | Metadata-only; content stays E2E | None | "First contacted · 14 May 2026" | no conversation → relationship block renders "No prior interaction on record" |
| `messagesExchanged` | COUNT `nex_peer_message` where `conversation_id` in pair's conversations | RLS allows participant SELECT; but client-side enumeration is wasteful + risky | ✅ via Server Action aggregate | Count is metadata; content never exposed | Server Action returns COUNT only, never rows | "Messages exchanged · 48" | NULL → `unknown` |
| `previousTransactions` | COUNT `nex_order` where ((seller=scanned ∧ buyer=viewer) ∨ (seller=viewer ∧ buyer=scanned)) | 🛠 current `nex_order` RLS gates by customer-OR-business-owner · viewer-is-seller case is covered; viewer-is-buyer case needs a `nex_order_customer_read` policy using viewer identity | ✅ once RLS added | Pair-scoped: viewer is one of the two parties | Add viewer-filtered customer RLS to `nex_order` OR add Server Action with service-role doing pair-filter | "Previous transactions · 2" | missing data → `unknown` |
| `previousDisputes` | 🚧 depends on dispute infra | n/a | 🚧 missing infra | — | New dispute table | "Previous disputes · 0" | always 0 → `unknown` |
| `blockedByYou` | `nex_friend_edge WHERE requested_by = viewer AND b_account_id = scanned AND status = 'blocked'` | 🛠 no authenticated RLS on `nex_friend_edge` | ✅ once RLS added | Self-pair · viewer reads only their own edge rows | Add `nex_friend_edge_viewer_read` RLS: `USING (requested_by IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()))` | "Blocked by you · Yes / No" | NULL → `unknown` |
| `previousReportsByYou` | `COUNT(*) nex_report WHERE reporter_account_id = viewer AND reported_account_id = scanned` | 🛠 no authenticated RLS on `nex_report` | ✅ once RLS added | Self-pair · viewer reads only their own report rows | Add `nex_report_reporter_self_read` RLS: `USING (reporter_account_id IN (SELECT id FROM nex_account WHERE supabase_user_id = auth.uid()))` | "Previous reports by you · 1" | NULL → `unknown` |

---

## Phase 2 blocking work (summary punch list)

Before `trust-scan-live-provider.ts` can be wired, the following must land:

### A · New Server Actions (service-role aggregation API)
1. `getTrustScanAccountCore(scannedId)` → identity block fields with explicit column exclusion for the 5 ⛔ columns
2. `getTrustScanReportAggregates(scannedId)` → `{total, substantiated, pending, dismissed, byCategory[]}`
3. `getTrustScanBlockCount(scannedId)` → aggregate blocks received
4. `getTrustScanOrderAggregates(scannedId)` → `{completed, refunded, cancelled, completionRate}`
5. `getTrustScanRelationshipHistory(viewerId, scannedId)` → `{firstContactedAt, messagesExchanged, previousTransactions, blockedByYou, previousReportsByYou}` · all pair-filtered

### B · New RLS policies
1. `nex_report` · `nex_report_reporter_self_read` (viewer may read rows they filed)
2. `nex_friend_edge` · `nex_friend_edge_viewer_read` (viewer may read rows where they are requested_by or b_account_id)
3. `nex_order` · extend customer RLS so viewer-as-customer can read their own orders when scanned party is the seller

### C · Missing infrastructure (field stays `unknown` until built)
1. 🚧 `nex_order_dispute` table (fields: order_id, opener_account_id, opened_at, status, resolved_at)
2. 🚧 `nex_order.fraud_confirmed_at` (admin-only write)
3. 🚧 `nex_account.suspended_at` + public SELECT policy

### D · Doctrine enforcement at the provider layer
- Provider MUST explicitly SELECT allowed columns · never `SELECT *`
- Provider MUST derive `country_code` only · never read `phone_national_number`
- Provider MUST never return `reporter_account_id` / `requested_by` / `verified_note` / `daily_activity_detail` / `supabase_user_id` / `safe_trade_consent_version`
- Any aggregate that cannot be computed MUST return `unknown` to the UI, never a caution/warning signal (sealed Phase 2 four-state rule)

---

## Doctrine references
- `memory/nex_trust_scan_doctrine_2026_10_01.md` (full Trust Scan doctrine)
- `memory/doctrine_phone_is_database_sealed_2026_09_29.md` (phone / content never on server)
- `memory/doctrine_nex_never_handles_payments_2026_09_28.md` (safe-trade boundary)
- `memory/personal_vs_business_doctrine_sealed_2026_09_28.md` (verified_at semantics)
- `memory/bridge99_sealed_2026_09_30.md` (claimed vs provisional lifecycle)
- Terms of Use § 5 (public business content opt-in)
- Terms of Use § 13 (NEX Safe Community & Trust · sealed 2026-10-01)
