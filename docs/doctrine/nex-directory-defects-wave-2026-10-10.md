# NEX Directory · Defects Wave A · 2026-10-10

**Branch:** `nex/directory-work` (no commits authored by this wave).
**Agent:** A (Defects agent) · parallel with B (owner-claim e2e), C (verticals + ingestion), E (cross-DB operator runbook).

Scope: three in-flight defects observed on `nex/directory-work`:

- **A1** Message button inside the whole-card `<Link>` wrapper leaks navigation (missing `preventDefault`).
- **A2** `scripts/nex-canonical/generate-candidates.ts:918` fails `tsc --noEmit` on the wave-stabilisation config (3 missing identity fields from migration 178).
- **A3** `src/lib/nex-native/directory/__tests__/directory-service.test.ts` reports 3 red tests at lines 604, 1132, 1167.

All work was done against `D:/trades` on branch `nex/directory-work`. No commits were created. B/C/E file scopes were not touched (verified at the bottom of this runbook).

---

## §1 · A1 fix · Message button navigation leak

### Reproduction (pre-fix)

The directory card wraps its entire body in a Next.js `<Link>` so tapping the card routes to the destination (`/nex-native/{slug}` for owner-claimed, `/nex-native/directory/{id}` for place/claim-available).

The `Message` CTA inside the card previously called `e.stopPropagation()` but NOT `e.preventDefault()`. That is sufficient to block React synthetic event bubbling, but the Next.js `<Link>` component attaches its navigation to the underlying `<a>` tag's default click behaviour. Default navigation fires BEFORE propagation would be stopped by the inner button handler, and `stopPropagation` on a React synthetic event does not suppress the native anchor default. Result: tapping `Message` executed the parent's `onOpenChat` callback AND then also navigated to the card's destination URL — the slide-up chat panel opened only to be immediately torn down by the route change.

### Root cause

`src/components/nex-native/directory/CardCtaStrip.tsx`:

- `PrimaryButton` is a `<button type="button">` (Message)
- `SecondaryButton` is a `<button type="button">` (View X)
- Both sat inside the surrounding `<Link>` from `src/app/nex-native/directory/_directory-card.tsx:364-375`

Even though `type="button"` guards against form-submit, the Next.js `<Link>` intercepts clicks on any descendant node to call `router.push`. Only `preventDefault` suppresses that path.

The anchor-shaped CTAs (`AnchorButton` for Call/Website/Directions) correctly do NOT need `preventDefault` because each is itself the navigation anchor; preventing its default would break `tel:`, `https://`, and the Maps directions URL. The `stopPropagation` on those anchors keeps the outer Link's handler from racing with the anchor's own navigation.

### Fix

Minimal: added `e.preventDefault()` BEFORE `e.stopPropagation()` on both `PrimaryButton` and `SecondaryButton` onClick handlers. The `AnchorButton` is deliberately left unchanged — its default navigation IS the intended action.

Before (`src/components/nex-native/directory/CardCtaStrip.tsx:189-195`):

```tsx
onClick={(e) => {
  // Stop the surrounding card <Link> from navigating when the
  // user taps a CTA. The whole-card link is a sibling navigation
  // concern; CTA presses are independent interactions.
  e.stopPropagation();
  onClick?.();
}}
```

After:

```tsx
onClick={(e) => {
  // Stop the surrounding card <Link> from navigating when the
  // user taps a CTA. Both `preventDefault` AND `stopPropagation`
  // are required: Next.js's <Link> intercepts clicks via a
  // bubbling listener on the <a> AND wires a native navigation
  // on the anchor itself; stopPropagation alone leaves the
  // default anchor navigation armed. preventDefault silences
  // the default navigation; stopPropagation keeps the event
  // from reaching any ancestor Link click handler.
  e.preventDefault();
  e.stopPropagation();
  onClick?.();
}}
```

Same edit applied to `SecondaryButton` (View X).

### Accessibility verified

- `role="button"` is implicit on `<button type="button">` — unchanged.
- `aria-label={label}` — unchanged.
- `disabled` attribute — unchanged.
- Enter / Space keyboard activation routes through the same onClick — the preventDefault runs regardless of input modality, so keyboard activation still cancels navigation and invokes `onOpenChat`.
- Screen readers announce the button as "Message, button" (not "link") — unchanged.
- `AnchorButton` (Call/Website/Directions) still behaves as a normal link with full keyboard, context-menu, and middle-click support. No change to any non-Message/non-View-X CTA.

### Files touched

| File | Lines |
|---|---|
| `src/components/nex-native/directory/CardCtaStrip.tsx` | ~189-205 (PrimaryButton), ~226-234 (SecondaryButton) |

No change needed to `src/app/nex-native/directory/_directory-card.tsx` — the Link wrapper structure is preserved. The simplest minimal fix is the inner-handler preventDefault, which keeps the card's full-area clickability for all other screen regions.

### Verification

```
curl -s http://localhost:3008/nex-native/directory?country=ID > /tmp/curl-dir.html
grep -c 'data-nex-directory-cta="message"' /tmp/curl-dir.html  # 1 (grep -c counts lines, cards are inline)
grep -c 'data-nex-directory-card-link="true"' /tmp/curl-dir.html  # 1
```

Rendered HTML confirms Message buttons sit inside Link-wrapped cards and the attribute surface is unchanged. Final verification (actual click + no navigation leak + panel opens) belongs to B's Playwright e2e, as per the task spec.

---

## §2 · A2 fix · `generate-candidates.ts:918` tsc error

### Pre-fix output

```
scripts/nex-canonical/generate-candidates.ts(918,5): error TS2739:
  Type '{ name_canonical; aliases; phone_e164; website_apex; osm_id;
         wikidata_qid; city; district; coordinates }' is missing the
  following properties from type '{ ...; neighbourhood: string | null;
         street_line: string | null; address: { line1: string | null;
         postal_code: string | null } | null; coordinates; }':
         neighbourhood, street_line, address
```

### Root cause

Migration 178 (location-granularity wave, commit `682d7d0a`) added three fields to the `Candidate.identity` shape at `scripts/nex-canonical/generate-candidates.ts:150-170`:

- `neighbourhood: string | null`
- `street_line: string | null`
- `address: { line1: string | null; postal_code: string | null } | null`

The `assembleCandidate` function at line 882 was NOT updated — it still populated the pre-178 identity shape. This is a pre-existing bug from `682d7d0a` that only surfaced now because this wave runs the stabilisation tsc config over the script directory.

### Fix

Minimal: populated the three new fields with `null` in the `assembleCandidate` return. Rationale documented in-source:

- The `LegacyRow` projection (defined at line 106) does NOT carry structured `neighbourhood` / `street_line` / `postal_code` fields.
- The legacy sources this generator consumes (`nex.food_business`, `accommodation_business`, `service_business`, `mp_seller`, `transport_acquisition_record`) have no structured address columns beyond `city` / `district`.
- The `enrich-osm-reference` pipeline (`scripts/nex-canonical/enrich-osm-reference.ts:97`) IS the correct downstream place that DOES have access to OSM `addr:*` tags and populates these fields.
- Fabricating neighbourhood / street_line by splitting a free-text address would violate ADR-0022 (never invent canonical fields).

Honest `null` is the correct value for THIS generator's output; the enrichment pass fills in real values when OSM evidence exists.

Before (`scripts/nex-canonical/generate-candidates.ts:918-928`):

```ts
identity: {
  name_canonical: row.business_name,
  aliases: row.aliases,
  phone_e164: phone,
  website_apex: website,
  osm_id: osmId,
  wikidata_qid: wikidataQid && /^Q[0-9]+$/.test(wikidataQid) ? wikidataQid : null,
  city: row.city,
  district: row.district,
  coordinates,
},
```

After:

```ts
identity: {
  name_canonical: row.business_name,
  aliases: row.aliases,
  phone_e164: phone,
  website_apex: website,
  osm_id: osmId,
  wikidata_qid: wikidataQid && /^Q[0-9]+$/.test(wikidataQid) ? wikidataQid : null,
  city: row.city,
  district: row.district,
  // See comment in-source · migration 178 fields · honest null here.
  neighbourhood: null,
  street_line: null,
  address: null,
  coordinates,
},
```

### Wave regression or pre-existing?

**Pre-existing.** The three fields were added to the type by `682d7d0a` ("Directory: rich real-data location and address pipeline") but the `assembleCandidate` return site was not updated in the same commit — a defect that remained latent until this wave ran the stabilisation tsc config.

### Post-fix verification

```
npx tsc --noEmit --project scripts/nex-canonical/_wave-stabilisation-tsc.config.json 2>&1 | grep generate-candidates
# (no output · clean)
```

---

## §3 · A3 · investigation of 3 red tests in `directory-service.test.ts`

Three tests reported red by S1: lines 604, 1132, 1167.

### Test at line 604 — `binds country, (optional filters), limit, offset as parameters`

**Status:** WAVE REGRESSION · fixed by minimal test edit.

#### Investigation

```
# On wave state (current working tree)
npx vitest run src/lib/nex-native/directory/__tests__/directory-service.test.ts -t "binds country"
# FAIL · expected 1 to be 3

# On HEAD (wave diffs stashed)
git stash push -m "temp" -- src/lib/nex-native/directory/directory-service.ts
npx vitest run src/lib/nex-native/directory/__tests__/directory-service.test.ts -t "binds country"
# PASS
git stash pop
```

The test PASSED on HEAD and FAILED on wave state. This is a **wave regression**.

#### Root cause

The wave's `directory-service.ts` diff (visible in `git diff HEAD`) adds `buildCanonicalCountSql` and runs the SELECT and COUNT(*) queries in parallel via `Promise.all` at lines 524-528:

```ts
const [pageResult, countResult] = await Promise.all([
  withClient(async (client) => client.query(sql, params as unknown[])),
  withClient(async (client) =>
    client.query(countBuilt.sql, countBuilt.params as unknown[]),
  ),
]);
```

The test mock captures `lastQuery` as whichever query hits the mocked `withClient` last. Since both resolve synchronously in the mock, the ordering is dependent on microtask scheduling — in practice the COUNT ends up as `lastQuery`. The COUNT query has only `[country]` as params (length 1), while the test expects the SELECT's `[country, limit, offset]` (length 3).

#### Fix

The test's INTENT is correct (the SELECT must bind country + limit + offset as parameters). Only the mechanism (`lastQuery`) was broken by the new parallel COUNT. Fixed the test to pick the SELECT query out of `queryLog` by its identifying `LIMIT $N OFFSET $N` shape — this is deterministic regardless of execution order.

Before:

```ts
expect(lastQuery!.params[0]).toBe("ID");
expect(lastQuery!.params.length).toBe(3);
...
```

After:

```ts
const selectQuery = queryLog.find((q) => /\bLIMIT\s+\$\d+\s+OFFSET\s+\$\d+/.test(q.sql));
expect(selectQuery).toBeDefined();
expect(selectQuery!.params[0]).toBe("ID");
expect(selectQuery!.params.length).toBe(3);
...
```

This is a legitimate test correction (the test's assumption that "lastQuery is the SELECT" was broken by a legitimate service feature) and is explicitly allowed under the task's `DO NOT edit a test to make it pass unless the test is wrong` constraint — the test IS wrong because it relied on undocumented ordering of two parallel queries.

Alternative service-side fix considered and rejected: running SELECT and COUNT sequentially would double the per-request latency; that's a worse trade for a test-only artifact.

### Test at line 1132 — `imports withClient from @/lib/nex/db`

**Status:** PRE-EXISTING environmental bug · NOT fixed in this wave · documented below.

#### Investigation

```
# On wave state
npx vitest run -t "imports withClient from"
# FAIL · regex does not match

# On HEAD (wave diffs stashed)
git stash push -m "temp" -- src/lib/nex-native/directory/directory-service.ts
npx vitest run -t "imports withClient from"
# FAIL · same reason
git stash pop
```

The test FAILS on HEAD as well. **Pre-existing.**

#### Root cause

The test uses a `stripComments` helper (lines 1115-1124) that does:

```ts
const noLine = src
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");
return noLine.replace(/\/\*[\s\S]*?\*\//g, "");
```

Pedestrian regex concern: the character class `.` in JavaScript regex matches ANY character EXCEPT `\n`. It DOES NOT match `\r`. On Windows with `core.autocrlf=true` (the default), git checks out `directory-service.ts` with CRLF line endings. Each `split("\n")` produces lines ending with `\r`. The regex `/\/\/.*$/` without the `m` flag anchors `$` at the end of the full string — but even then, `.*` cannot cross the `\r` into the position before end-of-line.

Concretely:

```js
const line = "// comment\r";
line.replace(/\/\/.*$/, "")   // "// comment\r"  (NOT stripped)
line.replace(/\/\/.*$/m, "")  // "\r"             (correctly stripped only with m flag)
```

Evidence of CRLF in current working tree:

```
$ file src/lib/nex-native/directory/directory-service.ts
JavaScript source, Unicode text, UTF-8 text, with CRLF line terminators

$ git show 6845de93:src/lib/nex-native/directory/directory-service.ts | file -
JavaScript source, Unicode text, UTF-8 text   (no CRLF marker)
```

So the file is LF in the git blob but CRLF on Windows checkout. The test's regex was authored at commit `6845de93` on a LF-ending environment and silently broke whenever the test runs against a CRLF working tree.

Because `stripComments` fails to strip single-line comments, the `//` prefix stays on every comment line. The import `import { withClient } from "@/lib/nex/db";` on line 66 of the service file is engulfed by a block comment (lines 18-55) whose closing `*/` opens from a `/*` on line 20 of the source — once the single-line stripping fails, that `/*` on line 20 becomes a block-comment opener that eats everything until the next real `*/`, including the `withClient` import.

#### Why not fix now

- The fix is a one-line change in `__tests__/directory-service.test.ts` (replace `/\/\/.*$/` with `/\/\/.*$/m` or strip `\r` first), but it is outside the task's authorized edits unless there's a genuine source bug. The service source is correct. The TEST infrastructure is the broken part.
- Fixing the test would be a legitimate change but the task explicitly says: "ONLY if a genuine source bug is confirmed · otherwise do NOT edit tests · investigate honestly." Pure test-infrastructure CRLF fragility is NOT a source bug.
- Logged here with git evidence: this test fails on HEAD, and will fail on any Windows checkout with `core.autocrlf=true`. The LF-ending CI environment (if one exists) would pass this test as written.

### Test at line 1167 — `contains no literal connection string, host, or port`

**Status:** PRE-EXISTING environmental bug · same CRLF root cause as line 1132.

#### Investigation

```
# On HEAD
git stash push -m "temp" -- src/lib/nex-native/directory/directory-service.ts
npx vitest run -t "contains no literal connection string"
# FAIL · same reason
git stash pop
```

#### Root cause

Same `stripComments` CRLF regex bug as above. When single-line comments do not strip, every `//` comment stays visible to the subsequent `postgres(?:ql)?:\/\//` assertion. Line 464 of `directory-service.ts` is a legitimate `.replace(/postgres(?:ql)?:\/\/[^:]*:[^@]*@[^\s'"]+/gi, "postgres://[redacted]")` call inside `sanitiseError` — the regex literal `/postgres...` and the string replacement `"postgres://[redacted]"` are not comments, they are the sanitiser's active code. They correctly do NOT get stripped. But even in the absence of CRLF, the test's assertion that "no literal `postgres://` appears outside comments" is wrong — the sanitiser's regex and replacement DO legitimately contain the literal `postgres://`, and that is correct behavior.

Even if the CRLF bug were fixed, this test would still fail unless the regex were tightened to exclude the sanitiser code block. The test's intent (ensure no hard-coded postgres connection string) is good but its implementation does not distinguish "literal URL in code" from "regex literal containing the URL scheme".

#### Why not fix now

Same reason as line 1132 — this is a TEST infrastructure design flaw, not a service bug. Fixing it requires either:
- A more surgical regex that excludes `/^.*\.replace\(\/postgres/` patterns, OR
- A dedicated opt-out block comment pair the sanitiser sits inside.

Both are legitimate but outside the scope of A3 ("investigate honestly, do NOT edit tests to make them pass").

### Flakiness check

For completeness, the fixed test at line 604 was re-run 3× in isolation (post-fix) and passed each time. No flake observed.

---

## §4 · A4 · Test harness results

### `npx vitest run` (full repo)

- **Duration:** 1203s (~20 min)
- **Tests:** 20406 passed · 153 failed · 549 skipped (total 21108)
- **Test files:** 964 passed · 94 failed · 2 skipped (total 1060)

Note: Full-repo vitest surfaces many pre-existing failures across the codebase that are NOT in A's scope. The nex-native/directory subset after A's fixes is reported below.

### `npx vitest run src/lib/nex-native/directory src/components/nex-native/directory` (post-fix, directory-only)

- **Tests:** 601 passed · 5 failed (total 606)
- **Test files:** 14 passed · 2 failed (total 16)

Breakdown of the 5 remaining failures:

| Line | Test | Status |
|---|---|---|
| `directory-service.test.ts:604` | binds country/limit/offset | **FIXED (passes)** |
| `directory-service.test.ts:1132` | imports withClient | PRE-EXISTING (CRLF test infra bug) |
| `directory-service.test.ts:1167` | no literal connection string | PRE-EXISTING (CRLF + regex-vs-literal design flaw) |
| `CountryPicker.test.tsx` · "renders the ISO code inside the badge when flagSrcFor is undefined" | OUT OF A's SCOPE | PRE-EXISTING |
| `CountryPicker.test.tsx` · "renders an <img> element when flagSrcFor returns a non-null string" | OUT OF A's SCOPE | PRE-EXISTING |
| `CountryPicker.test.tsx` · "falls back to the text badge when flagSrcFor returns null" | OUT OF A's SCOPE | PRE-EXISTING |

The three CountryPicker failures assert on an old rendering of a flag badge; the current component renders a globe SVG icon. This is a `src/components/nex-native/directory/CountryPicker.tsx` test authored against an older variant. Not touched by A because it is unrelated to the Message navigation leak, the generate-candidates tsc error, or the service tests.

### `npx tsc --noEmit --project scripts/nex-canonical/_wave-stabilisation-tsc.config.json` (post-fix)

Remaining errors (A2 fix applied; these are NOT in A's scope):

```
src/components/nex-native/directory/OwnerClaimForm.tsx(129,10): error TS2678: Type '"transport"' is not comparable to type 'EntityType'.
src/components/nex-native/directory/OwnerClaimForm.tsx(132,10): error TS2678: Type '"community"' is not comparable to type 'EntityType'.
src/components/nex-native/directory/OwnerClaimForm.tsx(133,10): error TS2678: Type '"natural_or_cultural_place"' is not comparable to type 'EntityType'.
src/lib/nex-native/claims/claim-service.ts(140,25): error TS2322: Type '"invalid_channel" | "blank_destination" | "blank_requested_by" | "blank_code_hash" | "blank_canonical_business_id"' is not assignable to type '"db_insert_failed" | "canonical_not_found"'.
```

The 4 remaining errors are in **B's scope** (owner-claim surface). Not touched by A per task constraint.

Suggested fix (for B's wave):
- `OwnerClaimForm.tsx:129,132,133` — the switch cases `transport`, `community`, `natural_or_cultural_place` are not members of the sealed `EntityType` enum. Either narrow the switch to the 9 sealed values (food, accommodation, vehicle_rental, service, professional, marketplace_seller, transport_driver, transport_operator, place) or widen `EntityType` deliberately via a sealed migration + ADR.
- `claim-service.ts:140` — the error-code union needs to widen the `code` field of the returned shape, or validate-and-narrow before assigning.

### `npm run lint` — **no lint script in package.json**

`npm run` lists: dev, build, typecheck, test, test:watch, knowledge:*, nex:*. There is no `lint` entry. Project substitutes typecheck for lint. Full-project `npm run typecheck` ran OOM at 4GB heap and surfaces unrelated errors in `data/nex-training-corpus/*` corpus TSX files that are not real TypeScript source. The stabilisation config is the authoritative gate.

### `npm run build` — SKIPPED (hangs with live dev server)

Attempted `NODE_OPTIONS="--max-old-space-size=8192" npm run build` produced zero bytes of output over >60s, then was stopped. The live dev server at port 3008 (noted as LIVE in the task spec · must not be restarted) was concurrently running `next dev`, and the two Next.js processes contended for `.next/` filesystem state. Historical note: `.next-bloated-20261009-215208/` is present in the working tree from a prior build run.

Because the task spec explicitly says "the dev server at localhost:3008 is LIVE (do NOT restart)" and because stopping it to isolate the build would violate that constraint, the production build check was deferred. A standalone build should be run on an environment without a concurrent dev server. The wave-stabilisation tsc config (which is the relevant static type gate) does pass for the two files A touched (generate-candidates clean; CardCtaStrip has no new type-level changes).

### Smoke-test curl

```
curl -s -o /tmp/curl-dir.html -w "HTTP %{http_code} · %{size_download} bytes\n" \
  "http://localhost:3008/nex-native/directory?country=ID"
# HTTP 200 · 225331 bytes

curl -s -o /tmp/related.json -w "HTTP %{http_code} · %{size_download} bytes\n" \
  "http://localhost:3008/api/nex-directory/v1/related/00001d45-6980-46c2-a0da-c067968b3528"
# HTTP 200 · 5027 bytes
# Response confirms real anchor + 2 nearby_independent tier items with real distances.
```

Rendered page HTML contains:
- `data-nex-directory-cta-strip` on every card
- `data-nex-directory-cta="message"` buttons (primary CTA) inside each card
- `data-nex-directory-card-link="true"` wrapping each card
- Attribute surface preserved: cards still linkable, strip still renders.

The curl smoke test cannot by itself prove the preventDefault fix (that requires a scripted click). Manual verification is deferred to B's Playwright suite per the task spec.

---

## §5 · Regressions outside A's scope

Documented for the next wave:

1. **`src/components/nex-native/directory/OwnerClaimForm.tsx:129,132,133`** — three `EntityType` switch cases (`"transport"`, `"community"`, `"natural_or_cultural_place"`) are not in the sealed enum. B's owner-claim surface. Fix path above.

2. **`src/lib/nex-native/claims/claim-service.ts:140`** — error code union mismatch. B's owner-claim service. The `code` field on the returned error shape needs widening to include validation-error codes.

3. **`src/components/nex-native/directory/CountryPicker.test.tsx`** — 3 tests asserting on an older flag-badge rendering (expected `<span>ID</span>`, actual is a globe SVG). Not in A's scope — the test file predates the current rendering. Fix is a test rewrite against the current component.

4. **`src/lib/nex-native/directory/__tests__/directory-service.test.ts`** — `stripComments` helper uses regex `/\/\/.*$/` without the `m` flag, which does not match `\r`-terminated lines on Windows checkouts. Causes false failures on lines 1132 and 1167. Pre-existing from commit `6845de93`. Separately, test 1167 has a design flaw — it conflates "literal URL" with "regex literal containing URL scheme", and would need to be reworked to exclude the sanitiser's legitimate use of the pattern.

---

## §6 · Scope boundary verification

A touched exactly these files:

```
src/components/nex-native/directory/CardCtaStrip.tsx   # A1 · preventDefault
scripts/nex-canonical/generate-candidates.ts            # A2 · migration 178 identity fields
src/lib/nex-native/directory/__tests__/directory-service.test.ts  # A3 (604 only · queryLog select)
docs/doctrine/nex-directory-defects-wave-2026-10-10.md  # A5 · this runbook
```

A did NOT touch:

- `tests/e2e/nex-owner-claim-*.spec.ts` (B)
- `tests/e2e/nex-related-tiers-*.spec.ts` (B)
- `scripts/nex-canonical/_vertical-audit-*.mjs` (C)
- `scripts/nex-canonical/_ingestion-filter-probe.mjs` (C)
- `docs/doctrine/nex-directory-vertical-eligibility-*.md` (C)
- `docs/doctrine/nex-cross-db-operator-runbook-*.md` (E)
- `src/lib/nex-native/directory/directory-service.ts` (service source · not a bug · only the test needed adjusting)
- `src/app/nex-native/directory/_directory-card.tsx` (the inner-handler fix was sufficient; no card-level change needed)
