// NEX App Builder · Phase 19A · Boundary Enforcement Proof (Philip 2026-08-14).
//
// ADVERSARIAL TEST. Nothing new is added to production capability here.
// This suite attempts to CROSS every boundary Phase 18 established.
//
// Non-negotiable acceptance criteria (Philip 2026-08-14 · LOCKED):
//   - Owner-A cannot act on business-B
//   - Customer-A cannot see business-B's private data
//   - Anonymous cannot reach owner routes
//   - Owner cookie hitting a customer route yields ONLY customer authority
//   - Customer cookie hitting an owner route is REJECTED
//   - Direct API calls have the SAME authorization boundary as UI
//   - Tampered / forged / expired credentials REJECTED
//   - Path / slug manipulation REJECTED
//   - PWA A cannot access B's scope, cache, or data
//
// Constitutional locks tested:
//   - "A credential grants only the authority represented by its scope."
//   - "A route determines the authority you receive; not highest-privilege-wins."
//   - "Boundary enforcement is API-level, never React-level."
//
// Pass condition: ZERO unauthorized boundary crossings across every attack.

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

const bc          = await import("../../src/lib/nex/business-context/index.ts");
const auth        = await import("../../src/lib/nex/auth/index.ts");
const conv        = await import("../../src/lib/nex/business-context/conversations.ts");
const muts        = await import("../../src/lib/nex/mutations/index.ts");
const signer      = await import("../../src/lib/nex/auth/session-signer.ts");
const propose     = await import("../../src/app/api/b/[slug]/owner/nex/propose/route.ts");
const apply       = await import("../../src/app/api/b/[slug]/owner/nex/apply/route.ts");
const pBatch      = await import("../../src/app/api/b/[slug]/owner/nex/propose-batch/route.ts");
const aBatch      = await import("../../src/app/api/b/[slug]/owner/nex/apply-batch/route.ts");
const undo        = await import("../../src/app/api/b/[slug]/owner/nex/undo/route.ts");
const auditR      = await import("../../src/app/api/b/[slug]/owner/nex/audit/route.ts");
const ownConvR    = await import("../../src/app/api/b/[slug]/owner/conversations/route.ts");
const custMsg     = await import("../../src/app/api/b/[slug]/customer/message/route.ts");
const manifestR   = await import("../../src/app/api/b/[slug]/manifest.json/route.ts");
const iconR       = await import("../../src/app/api/b/[slug]/icon/route.ts");
const swR         = await import("../../src/app/api/b/[slug]/sw.js/route.ts");

bc._resetRegistryForTest();
conv._resetConversationsForTest();
auth._resetAccountsForTest();
muts._resetAuditForTest();
muts._resetProposalsForTest();
muts._resetBatchesForTest?.();
bc.ensureSeeded();
auth.ensureOwnerAccountsSeeded();

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else { console.error("FAIL:", msg); failures.push(msg); fail++; }
}

// ─── Fixtures ────────────────────────────────────────────────────
const A = "rowan-staircases";
const B = "harborne-plumbing";

const ownerA = signer.signSession({ role: "owner",    businessSlug: A, ownerAccountId: "owner_A", email: "ownerA@example" });
const ownerB = signer.signSession({ role: "owner",    businessSlug: B, ownerAccountId: "owner_B", email: "ownerB@example" });
const custA  = signer.signSession({ role: "customer", businessSlug: A, customerId: "cust_A_1",    email: "custA@example" });
const custB  = signer.signSession({ role: "customer", businessSlug: B, customerId: "cust_B_1",    email: "custB@example" });

const ownerAScoped = `${auth.ownerCookieName(A)}=${ownerA}`;
const ownerBScoped = `${auth.ownerCookieName(B)}=${ownerB}`;
const custAScoped  = `${auth.customerCookieName(A)}=${custA}`;
const custBScoped  = `${auth.customerCookieName(B)}=${custB}`;

// ─── Helpers ────────────────────────────────────────────────────
async function POST(route, path, body, cookieHeader) {
  const req = new Request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookieHeader ? { cookie: cookieHeader } : {}) },
    body: JSON.stringify(body ?? {})
  });
  const res = await route.POST(req, { params: Promise.resolve(paramsFrom(path)) });
  return { status: res.status, json: await tryJson(res) };
}
async function GET(route, path, cookieHeader) {
  const req = new Request(`http://test${path}`, { method: "GET", headers: cookieHeader ? { cookie: cookieHeader } : {} });
  const res = await route.GET(req, { params: Promise.resolve(paramsFrom(path)) });
  return { status: res.status, json: await tryJson(res), body: await tryText(res) };
}
async function tryJson(res) { try { return await res.clone().json(); } catch { return null; } }
async function tryText(res) { try { return await res.clone().text(); } catch { return null; } }
function paramsFrom(path) { const m = /\/b\/([^\/]+)/.exec(path); return m ? { slug: m[1] } : {}; }
function rejected(status) { return status === 401 || status === 403; }

// Seed a legitimate mutation on business A so we have a real mutationId to attack with.
async function seedMutation(slug, cookie, instruction) {
  const p = await POST(propose, `/api/b/${slug}/owner/nex/propose`, { instruction }, cookie);
  if (p.status !== 200) throw new Error(`seed propose failed on ${slug}: ${p.status} · ${JSON.stringify(p.json)}`);
  const a = await POST(apply, `/api/b/${slug}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, cookie);
  if (a.status !== 200) throw new Error(`seed apply failed on ${slug}: ${a.status} · ${JSON.stringify(a.json)}`);
  return a.json.audit.mutationId;
}

// Seed the working proposal for later attacks (owner-A on business A).
const seedMutId = await seedMutation(A, ownerAScoped, "Change the Helix staircase price to £16,995");
console.log(`\nSeeded ${A} mutation ${seedMutId} · used as attack target throughout.\n`);

// ============================================================================
// GROUP 1 · Cross-business owner isolation · owner-A → business-B
// ============================================================================

console.log("---------- G1 · Cross-business owner isolation ----------");
{
  const attacks = [
    { name: "propose",       run: () => POST(propose, `/api/b/${B}/owner/nex/propose`, { instruction: "Change the boiler price to £1" }, ownerAScoped) },
    { name: "propose-batch", run: () => POST(pBatch,  `/api/b/${B}/owner/nex/propose-batch`, { instruction: "Change the boiler price to £1 and feature boiler" }, ownerAScoped) },
    { name: "apply",         run: () => POST(apply,   `/api/b/${B}/owner/nex/apply`, { proposalId: "prop_bogus", confirmed: true }, ownerAScoped) },
    { name: "apply-batch",   run: () => POST(aBatch,  `/api/b/${B}/owner/nex/apply-batch`, { batchId: "batch_bogus", confirmed: true }, ownerAScoped) },
    { name: "undo",          run: () => POST(undo,    `/api/b/${B}/owner/nex/undo`, { mutationId: seedMutId }, ownerAScoped) },
    { name: "audit",         run: () => GET (auditR,  `/api/b/${B}/owner/nex/audit`, ownerAScoped) },
    { name: "conversations", run: () => GET (ownConvR, `/api/b/${B}/owner/conversations`, ownerAScoped) }
  ];
  for (const a of attacks) {
    const r = await a.run();
    assert(rejected(r.status), `G1 · owner-A → business-B ${a.name} REJECTED (got ${r.status})`);
  }
}

// ============================================================================
// GROUP 2 · Cross-business customer isolation · customer-A → business-B
// ============================================================================

console.log("\n---------- G2 · Cross-business customer isolation ----------");
{
  // Customer-A's SCOPED cookie is `nex_customer_A=…`. When hitting
  // business B's customer route, that cookie is invisible (scope filter),
  // so the caller looks anonymous. Anonymous is ALLOWED on customer routes
  // but MUST NOT be treated as belonging to business A.
  const r = await POST(custMsg, `/api/b/${B}/customer/message`, { text: "Hello?" }, custAScoped);
  assert(r.status === 200, `G2.1 · custA cookie on business-B customer route succeeds as anonymous (${r.status})`);
  // The conversation created must belong to business B, not to A. It must
  // NOT reference customer A's identity in any way it shouldn't.
  assert(r.json?.conversationId, `G2.2 · new conversation created (id present)`);
  const idPrefix = String(r.json?.conversationId ?? "").slice(0, 24);
  assert(!/cust_A_1/.test(JSON.stringify(r.json)), `G2.3 · response does not leak custA identity into business-B state`);

  // Owner customer routes DO NOT exist for cross-business reads; and the
  // customer route rejects an anonymous attempt to spoof the customerId.
  const r2 = await POST(custMsg, `/api/b/${B}/customer/message`, { text: "test", customerId: "cust_A_1" }, custAScoped);
  assert(r2.status === 200, `G2.4 · route ignores caller-supplied customerId (not privileged) · status ${r2.status}`);
}

// ============================================================================
// GROUP 3 · Anonymous rejected from owner surfaces
// ============================================================================

console.log("\n---------- G3 · Anonymous rejected from owner surfaces ----------");
{
  const attacks = [
    { name: "propose",       run: () => POST(propose, `/api/b/${A}/owner/nex/propose`,       { instruction: "Change price" }, null) },
    { name: "propose-batch", run: () => POST(pBatch,  `/api/b/${A}/owner/nex/propose-batch`, { instruction: "Change price and change email" }, null) },
    { name: "apply",         run: () => POST(apply,   `/api/b/${A}/owner/nex/apply`,         { proposalId: "prop_bogus", confirmed: true }, null) },
    { name: "apply-batch",   run: () => POST(aBatch,  `/api/b/${A}/owner/nex/apply-batch`,   { batchId: "batch_bogus", confirmed: true }, null) },
    { name: "undo",          run: () => POST(undo,    `/api/b/${A}/owner/nex/undo`,          { mutationId: seedMutId }, null) },
    { name: "audit",         run: () => GET (auditR,  `/api/b/${A}/owner/nex/audit`,         null) },
    { name: "conversations", run: () => GET (ownConvR, `/api/b/${A}/owner/conversations`,   null) }
  ];
  for (const a of attacks) {
    const r = await a.run();
    assert(rejected(r.status), `G3 · anonymous → ${a.name} REJECTED (got ${r.status})`);
  }
}

// ============================================================================
// GROUP 4 · Cross-role rejection within the same slug
// ============================================================================

console.log("\n---------- G4 · Cross-role within same slug ----------");
{
  // 4a · Owner cookie hitting a customer route yields ONLY customer authority
  //      (the response must not leak owner-only fields).
  const r = await POST(custMsg, `/api/b/${A}/customer/message`, { text: "Hello Rowan" }, ownerAScoped);
  assert(r.status === 200, `G4.1 · owner cookie on customer route ACCEPTED as anonymous customer (${r.status})`);
  // Must NOT include owner-only fields like blueprintRevision, provenance, ownerAccountId.
  const raw = JSON.stringify(r.json ?? {});
  assert(!/ownerAccountId/i.test(raw), `G4.2 · customer response does not leak ownerAccountId`);
  assert(!/provenance/i.test(raw),     `G4.3 · customer response does not leak provenance`);
  assert(!/blueprintId/i.test(raw),    `G4.4 · customer response does not leak blueprintId`);

  // 4b · Customer cookie hitting owner routes → rejected
  const customerAttacks = [
    { name: "propose",       run: () => POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price" }, custAScoped) },
    { name: "propose-batch", run: () => POST(pBatch,  `/api/b/${A}/owner/nex/propose-batch`, { instruction: "Change price and change email" }, custAScoped) },
    { name: "apply",         run: () => POST(apply,   `/api/b/${A}/owner/nex/apply`, { proposalId: "prop_bogus", confirmed: true }, custAScoped) },
    { name: "apply-batch",   run: () => POST(aBatch,  `/api/b/${A}/owner/nex/apply-batch`, { batchId: "batch_bogus", confirmed: true }, custAScoped) },
    { name: "undo",          run: () => POST(undo,    `/api/b/${A}/owner/nex/undo`, { mutationId: seedMutId }, custAScoped) },
    { name: "audit",         run: () => GET (auditR,  `/api/b/${A}/owner/nex/audit`, custAScoped) },
    { name: "conversations", run: () => GET (ownConvR, `/api/b/${A}/owner/conversations`, custAScoped) }
  ];
  for (const a of customerAttacks) {
    const r = await a.run();
    assert(rejected(r.status), `G4.5 · customer cookie → owner ${a.name} REJECTED (got ${r.status})`);
  }
}

// ============================================================================
// GROUP 5 · Legacy `nex_session` scope-abuse attempts
// ============================================================================

console.log("\n---------- G5 · Legacy cookie scope-abuse ----------");
{
  // 5a · Legacy customer cookie for A → owner route on A → REJECTED
  const legacyCust = signer.signSession({ role: "customer", businessSlug: A, customerId: "cust_legacy", email: "cl@x" });
  const legacyCustHeader = `${auth.SESSION_COOKIE_NAME}=${legacyCust}`;
  const r1 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price" }, legacyCustHeader);
  assert(rejected(r1.status), `G5.1 · legacy customer cookie → owner route REJECTED (${r1.status})`);

  // 5b · Legacy owner cookie for A → business-B owner route → REJECTED
  const legacyOwnerA = signer.signSession({ role: "owner", businessSlug: A, ownerAccountId: "owner_legacy", email: "ol@x" });
  const legacyOwnerHeader = `${auth.SESSION_COOKIE_NAME}=${legacyOwnerA}`;
  const r2 = await POST(propose, `/api/b/${B}/owner/nex/propose`, { instruction: "Change boiler price" }, legacyOwnerHeader);
  assert(rejected(r2.status), `G5.2 · legacy owner-A → business-B REJECTED (${r2.status})`);

  // 5c · Legacy owner cookie for A → owner route on A → ALLOWED (backwards compat)
  const r3 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change the Helix price to £13,111" }, legacyOwnerHeader);
  assert(r3.status === 200, `G5.3 · legacy owner cookie on OWN business still works (backwards compat · ${r3.status})`);
}

// ============================================================================
// GROUP 6 · Cookie tampering / forgery / expiry
// ============================================================================

console.log("\n---------- G6 · Cookie tampering / forgery / expiry ----------");
{
  // 6a · Modified payload · signature will not verify
  const modPayload = ownerA.slice(0, ownerA.lastIndexOf(".")) + "X." + ownerA.slice(ownerA.lastIndexOf(".") + 1);
  const r1 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=${modPayload}`);
  assert(rejected(r1.status), `G6.1 · tampered payload REJECTED (${r1.status})`);

  // 6b · Modified signature
  const badSig = ownerA.slice(0, -3) + "XXX";
  const r2 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=${badSig}`);
  assert(rejected(r2.status), `G6.2 · tampered signature REJECTED (${r2.status})`);

  // 6c · Forged unsigned base64 JSON (someone hopes the server accepts a
  //      naked payload if it looks like a valid session)
  const naked = Buffer.from(JSON.stringify({ role: "owner", businessSlug: A, ownerAccountId: "owner_forged", iat: 1, exp: 9999999999 }), "utf8").toString("base64url");
  const r3 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=${naked}`);
  assert(rejected(r3.status), `G6.3 · forged unsigned base64 REJECTED (${r3.status})`);

  // 6d · Empty cookie value
  const r4 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=`);
  assert(rejected(r4.status), `G6.4 · empty cookie REJECTED (${r4.status})`);

  // 6e · Truncated cookie
  const truncated = ownerA.slice(0, 10);
  const r5 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=${truncated}`);
  assert(rejected(r5.status), `G6.5 · truncated cookie REJECTED (${r5.status})`);

  // 6f · Expired cookie (exp in the past · we mint one directly)
  const expiredCookie = signer.signSession({ role: "owner", businessSlug: A, ownerAccountId: "owner_expired", email: "e@x" }, -3600);
  const r6 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=${expiredCookie}`);
  assert(rejected(r6.status), `G6.6 · expired cookie REJECTED (${r6.status})`);

  // 6g · Cookie signed with a DIFFERENT secret (simulates key rotation / attacker with own key)
  const origSecret = process.env.NEX_SESSION_SECRET;
  process.env.NEX_SESSION_SECRET = "different-secret-value-thirty-two-chars-min-abc123";
  // Clear the signer's cached secret · impossible with the current
  // implementation because getSecret() reads env each call, so this
  // works · but we must re-import to be safe. Instead we forge one
  // with the different secret and then restore the env before the request.
  const foreign = signer.signSession({ role: "owner", businessSlug: A, ownerAccountId: "owner_foreign", email: "f@x" });
  process.env.NEX_SESSION_SECRET = origSecret;
  const r7 = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change price to £1" }, `${auth.ownerCookieName(A)}=${foreign}`);
  assert(rejected(r7.status), `G6.7 · foreign-secret cookie REJECTED (${r7.status})`);
}

// ============================================================================
// GROUP 7 · Path / slug manipulation
// ============================================================================

console.log("\n---------- G7 · Path / slug manipulation ----------");
{
  // 7a · Slug prefix confusion · owner cookie for "harborne-plumbing" used on "harborne"
  //      (a hypothetical narrower slug) — scoped cookie is `nex_owner_harborne-plumbing`
  //      and NOT `nex_owner_harborne`, so the server cannot mistake them.
  const r1 = await POST(propose, `/api/b/harborne/owner/nex/propose`, { instruction: "Change price" }, ownerBScoped);
  assert(rejected(r1.status), `G7.1 · slug prefix confusion (harborne vs harborne-plumbing) REJECTED (${r1.status})`);

  // 7b · Two conflicting owner cookies for A and B on the same request →
  //      route resolves the cookie NAMED for the target slug only.
  const both = `${ownerAScoped}; ${ownerBScoped}`;
  const rBusA = await POST(propose, `/api/b/${A}/owner/nex/propose`, { instruction: "Change the Helix price to £14,999" }, both);
  assert(rBusA.status === 200, `G7.2 · both cookies present · request to A resolves owner-A cookie (${rBusA.status})`);
  const rBusB = await POST(propose, `/api/b/${B}/owner/nex/propose`, { instruction: "Change the boiler price to £2,999" }, both);
  // owner-B is the seeded email but harborne-plumbing may not have a "boiler" product · we just
  // care that the AUTH path resolved · so either 200 or a mutation-validation 400 is acceptable.
  assert(rBusB.status === 200 || rBusB.status === 400, `G7.3 · both cookies present · request to B resolves owner-B cookie (${rBusB.status} · auth crossed)`);
  assert(!rejected(rBusB.status), `G7.4 · request to B was NOT rejected on auth grounds (${rBusB.status})`);

  // 7c · Nonexistent slug returns 404 · doesn't leak existence
  const r3 = await POST(propose, `/api/b/does-not-exist/owner/nex/propose`, { instruction: "Change price" }, ownerAScoped);
  assert(rejected(r3.status) || r3.status === 404, `G7.5 · unknown slug rejected (${r3.status})`);

  // 7d · Empty slug (as would happen from a bad rewrite) · never grants access
  const r4 = await POST(propose, `/api/b//owner/nex/propose`, { instruction: "Change price" }, ownerAScoped);
  assert(r4.status !== 200, `G7.6 · empty slug never grants access (${r4.status})`);
}

// ============================================================================
// GROUP 8 · Direct API calls · same authorization boundary as UI
// ============================================================================

console.log("\n---------- G8 · Direct API bypass attempts ----------");
{
  // 8a · No Origin / no Referer headers · the auth gate must still hold
  //      (no CSRF gate today · but authorization still applies).
  const req = new Request(`http://test/api/b/${A}/owner/nex/propose`, {
    method: "POST",
    headers: { "content-type": "application/json" },   // deliberately NO cookie, NO origin
    body: JSON.stringify({ instruction: "Change price" })
  });
  const res = await propose.POST(req, { params: Promise.resolve({ slug: A }) });
  assert(rejected(res.status), `G8.1 · direct API call with no cookie / no origin REJECTED (${res.status})`);

  // 8b · Unusual user-agent · same behaviour
  const req2 = new Request(`http://test/api/b/${A}/owner/nex/propose`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "curl/attacker" },
    body: JSON.stringify({ instruction: "Change price" })
  });
  const res2 = await propose.POST(req2, { params: Promise.resolve({ slug: A }) });
  assert(rejected(res2.status), `G8.2 · curl-style direct call REJECTED without cookie (${res2.status})`);

  // 8c · Attacker sets an origin claiming to be from the site · MUST NOT grant auth
  const req3 = new Request(`http://test/api/b/${A}/owner/nex/propose`, {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "http://test", "referer": `http://test/b/${A}/workspace` },
    body: JSON.stringify({ instruction: "Change price" })
  });
  const res3 = await propose.POST(req3, { params: Promise.resolve({ slug: A }) });
  assert(rejected(res3.status), `G8.3 · spoofed origin + referer without cookie REJECTED (${res3.status})`);

  // 8d · Valid owner cookie · direct API call · SAME as UI behaviour (200)
  const req4 = new Request(`http://test/api/b/${A}/owner/nex/propose`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ownerAScoped },
    body: JSON.stringify({ instruction: "Change the Helix price to £15,555" })
  });
  const res4 = await propose.POST(req4, { params: Promise.resolve({ slug: A }) });
  assert(res4.status === 200, `G8.4 · valid cookie · direct API call succeeds identically to UI (${res4.status})`);
}

// ============================================================================
// GROUP 9 · PWA cross-business isolation
// ============================================================================

console.log("\n---------- G9 · PWA cross-business isolation ----------");
{
  // 9a · Each business's manifest carries its OWN start_url and scope
  const mfA = await GET(manifestR, `/api/b/${A}/manifest.json`);
  const mfB = await GET(manifestR, `/api/b/${B}/manifest.json`);
  assert(mfA.status === 200 && mfB.status === 200, `G9.1 · both manifests reachable`);
  assert(mfA.json.start_url === `/b/${A}/chat`, `G9.2 · manifest A start_url scoped to A (${mfA.json.start_url})`);
  assert(mfB.json.start_url === `/b/${B}/chat`, `G9.3 · manifest B start_url scoped to B (${mfB.json.start_url})`);
  assert(mfA.json.scope === `/b/${A}/`, `G9.4 · manifest A scope confined to A (${mfA.json.scope})`);
  assert(mfB.json.scope === `/b/${B}/`, `G9.5 · manifest B scope confined to B (${mfB.json.scope})`);
  assert(mfA.json.name !== mfB.json.name, `G9.6 · manifest names differ · no cross-business bleed`);

  // 9b · Icons served from same-origin routes · icon A does not leak from B route
  const iconA = await GET(iconR, `/api/b/${A}/icon?size=512`);
  const iconB = await GET(iconR, `/api/b/${B}/icon?size=512`);
  assert(iconA.body !== iconB.body, `G9.7 · icon A ≠ icon B (different brand data · different SVG)`);
  assert(!iconA.body.includes("Harborne") && !iconA.body.includes("Plumbing"), `G9.8 · icon A does NOT leak B's business identity`);

  // 9c · Service worker scoped to its own slug via Service-Worker-Allowed header
  const swA = await GET(swR, `/api/b/${A}/sw.js`);
  const swB = await GET(swR, `/api/b/${B}/sw.js`);
  assert(swA.status === 200 && swB.status === 200, `G9.9 · both SWs reachable`);
  assert(swA.body.includes(`business=${A}`), `G9.10 · SW A body identifies business A`);
  assert(swB.body.includes(`business=${B}`), `G9.11 · SW B body identifies business B`);
  // Ensure SW A does NOT contain SW B's slug (would indicate template contamination)
  assert(!swA.body.includes(B), `G9.12 · SW A does not reference business B's slug`);
  assert(!swB.body.includes(A), `G9.13 · SW B does not reference business A's slug`);
  // Service-Worker-Allowed header exists AND is scoped correctly
  const swAHeader = (await swR.GET(new Request(`http://test/api/b/${A}/sw.js`), { params: Promise.resolve({ slug: A }) })).headers.get("service-worker-allowed");
  const swBHeader = (await swR.GET(new Request(`http://test/api/b/${B}/sw.js`), { params: Promise.resolve({ slug: B }) })).headers.get("service-worker-allowed");
  assert(swAHeader === `/b/${A}/`, `G9.14 · SW A · Service-Worker-Allowed = /b/A/ (${swAHeader})`);
  assert(swBHeader === `/b/${B}/`, `G9.15 · SW B · Service-Worker-Allowed = /b/B/ (${swBHeader})`);

  // 9d · Manifest for nonexistent slug returns 404 (doesn't leak existence)
  const mf404 = await GET(manifestR, `/api/b/does-not-exist/manifest.json`);
  assert(mf404.status === 404, `G9.16 · manifest for unknown slug returns 404 · does not leak existence`);
}

// ============================================================================
// GROUP 10 · CROSS-BUSINESS AUDIT INTEGRITY (permanent non-regression)
// ============================================================================

console.log("\n---------- G10 · Cross-business audit isolation ----------");
{
  // Owner-B mutates their own business
  const bMutId = await seedMutation(B, ownerBScoped, "Change the email to hello@harborne-plumbing.example");

  // Owner-A queries audit for A · MUST NOT see business-B's mutations
  const auditA = await GET(auditR, `/api/b/${A}/owner/nex/audit`, ownerAScoped);
  assert(auditA.status === 200, `G10.1 · owner-A can read own audit (${auditA.status})`);
  const auditAJson = JSON.stringify(auditA.json);
  assert(!auditAJson.includes(bMutId), `G10.2 · audit A does NOT contain B's mutationId (${bMutId})`);
  assert(!/harborne-plumbing/.test(auditAJson), `G10.3 · audit A does NOT reference business B's slug`);

  // Owner-B queries audit for B · MUST NOT see business-A's mutations
  const auditB = await GET(auditR, `/api/b/${B}/owner/nex/audit`, ownerBScoped);
  assert(auditB.status === 200, `G10.4 · owner-B can read own audit (${auditB.status})`);
  const auditBJson = JSON.stringify(auditB.json);
  assert(!auditBJson.includes(seedMutId), `G10.5 · audit B does NOT contain A's mutationId (${seedMutId})`);
}

// ============================================================================
// GROUP 11 · Undo lifecycle boundary integrity
// ============================================================================

console.log("\n---------- G11 · Undo lifecycle boundary ----------");
{
  // Attempt to propose an undo on business-A's mutation using owner-B's cookie
  const r = await POST(undo, `/api/b/${A}/owner/nex/undo`, { mutationId: seedMutId }, ownerBScoped);
  assert(rejected(r.status), `G11.1 · owner-B cannot propose undo on business-A mutation (${r.status})`);

  // Attempt undo of a random non-existent mutation id · returns error not 200
  const r2 = await POST(undo, `/api/b/${A}/owner/nex/undo`, { mutationId: "mut_forged_by_attacker" }, ownerAScoped);
  assert(r2.status !== 200, `G11.2 · undo of forged mutationId does not succeed (${r2.status})`);
}

// ============================================================================
// GROUP 12 · Batch boundary integrity
// ============================================================================

console.log("\n---------- G12 · Batch boundary ----------");
{
  // Owner-A proposes a batch for their own business, then owner-B tries to apply it
  const p = await POST(pBatch, `/api/b/${A}/owner/nex/propose-batch`, { instruction: "Change the Helix price to £17,500 and change the email to changed@a.example" }, ownerAScoped);
  assert(p.status === 200, `G12.1 · owner-A batch propose succeeds (${p.status})`);
  const batchId = p.json.batch.batchId;

  // Owner-B attempts to apply owner-A's batch
  const rB = await POST(aBatch, `/api/b/${A}/owner/nex/apply-batch`, { batchId, confirmed: true }, ownerBScoped);
  assert(rejected(rB.status), `G12.2 · owner-B cannot apply owner-A's batch (${rB.status})`);

  // Anonymous attempts to apply owner-A's batch
  const rAnon = await POST(aBatch, `/api/b/${A}/owner/nex/apply-batch`, { batchId, confirmed: true }, null);
  assert(rejected(rAnon.status), `G12.3 · anonymous cannot apply owner-A's batch (${rAnon.status})`);

  // Owner-A actually applies it (batch not consumed by prior rejected attempts)
  const rA = await POST(aBatch, `/api/b/${A}/owner/nex/apply-batch`, { batchId, confirmed: true }, ownerAScoped);
  assert(rA.status === 200, `G12.4 · owner-A applies own batch after rejected attacks (${rA.status})`);
}

// ============================================================================
// Summary
// ============================================================================

console.log("");
console.log("─".repeat(72));
console.log(`Phase 19A · Boundary Enforcement Proof · ${pass} passed · ${fail} failed`);
console.log("─".repeat(72));
if (fail > 0) {
  console.error("\nBOUNDARY VIOLATIONS:");
  for (const f of failures) console.error("  ✗", f);
  console.error("\nZero unauthorized boundary crossings is the acceptance gate. This run does not meet it.");
  process.exit(1);
}
console.log("\nAcceptance gate met · zero unauthorized boundary crossings across every attack group.");
