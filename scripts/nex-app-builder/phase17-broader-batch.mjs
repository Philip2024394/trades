// NEX App Builder · Phase 17 · Broader mutation surface + grouped batches (Philip 2026-08-14).
//
// Proves:
//   17A · six new mutation kinds propose+apply cleanly through the SAME
//         governed engine (no engine changes · pure registry additions).
//   17B · a compound owner instruction is split, interpreted, validated,
//         proposed as a batch with ONE approval, applied together, each
//         sub-change gains its own audit entry stamped with the batchId.
//   17C · constitutional ambiguity handling · unclear fragments surface
//         as clarification requests · nothing is silently dropped.
//   17D · batch respects permission gate (customer/other-owner rejected).
//   17E · batch respects explicit confirmed=true rule.
//   17F · every previous invariant preserved (audit still linked, revision
//         monotonic, customer sees the new state).

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

const bc      = await import("../../src/lib/nex/business-context/index.ts");
const auth    = await import("../../src/lib/nex/auth/index.ts");
const conv    = await import("../../src/lib/nex/business-context/conversations.ts");
const muts    = await import("../../src/lib/nex/mutations/index.ts");
const signer  = await import("../../src/lib/nex/auth/session-signer.ts");
const propose = await import("../../src/app/api/b/[slug]/owner/nex/propose/route.ts");
const apply   = await import("../../src/app/api/b/[slug]/owner/nex/apply/route.ts");
const pBatch  = await import("../../src/app/api/b/[slug]/owner/nex/propose-batch/route.ts");
const aBatch  = await import("../../src/app/api/b/[slug]/owner/nex/apply-batch/route.ts");
const auditR  = await import("../../src/app/api/b/[slug]/owner/nex/audit/route.ts");
const custMsg = await import("../../src/app/api/b/[slug]/customer/message/route.ts");

bc._resetRegistryForTest();
conv._resetConversationsForTest();
auth._resetAccountsForTest();
muts._resetAuditForTest();
muts._resetProposalsForTest();
muts._resetBatchesForTest();
bc.ensureSeeded();
auth.ensureOwnerAccountsSeeded();

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { console.log("PASS:", msg); pass++; } else { console.error("FAIL:", msg); fail++; } }

const SLUG = "rowan-staircases";
const ownerCookie = signer.signSession({ role: "owner", businessSlug: SLUG, ownerAccountId: "owner_test_1", email: "owner@rowanstaircases.co.uk" });
const custCookie  = signer.signSession({ role: "customer", businessSlug: SLUG, customerId: "cust_test_1", email: "alice@example.com" });
const otherOwner  = signer.signSession({ role: "owner", businessSlug: "harborne-plumbing", ownerAccountId: "owner_test_2", email: "owner@harborne-plumbing.co.uk" });

async function POST(route, path, body, cookie) {
  const req = new Request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookie ? `${auth.SESSION_COOKIE_NAME}=${cookie}` : "" },
    body: JSON.stringify(body)
  });
  const res = await route.POST(req, { params: Promise.resolve({ slug: SLUG }) });
  return { status: res.status, json: await res.json() };
}
async function GET(route, path, cookie) {
  const req = new Request(`http://test${path}`, {
    method: "GET",
    headers: { cookie: cookie ? `${auth.SESSION_COOKIE_NAME}=${cookie}` : "" }
  });
  const res = await route.GET(req, { params: Promise.resolve({ slug: SLUG }) });
  return { status: res.status, json: await res.json() };
}

// ============================================================================
// 17A · New mutation kinds · each proposed + applied through same engine
// ============================================================================

console.log("\n---------- 17A · New mutation kinds ----------");

// A1 · contact.email (natural-language parse)
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Change our email to hello@rowanstaircases.com" }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "contact.email", `A1.1 · contact.email proposed (kind=${p.json.proposal?.kind})`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200 && a.json.audit.after === "hello@rowanstaircases.com", `A1.2 · email applied (after=${a.json.audit.after})`);
  assert(bc.getBusiness(SLUG).blueprint.identity.contact.primaryEmail === "hello@rowanstaircases.com", `A1.3 · Blueprint has new email`);
}

// A2 · contact.phone (natural-language parse)
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Update our phone to +44 20 8000 1234" }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "contact.phone", `A2.1 · contact.phone proposed`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200 && String(a.json.audit.after).includes("8000 1234"), `A2.2 · phone applied`);
}

// A3 · brand.primary-color (natural-language parse · hex validation)
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Change our primary colour to #8b5a2b" }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "brand.primary-color", `A3.1 · brand.primary-color proposed`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200 && a.json.audit.after === "#8b5a2b", `A3.2 · brand colour applied`);

  // Constitutional reject · non-hex value
  const bad = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { proposal: { kind: "brand.primary-color", selector: {}, newValue: "orange-ish" } }, ownerCookie);
  assert(bad.status === 400 && /6-digit hex/.test(bad.json.error), `A3.3 · non-hex colour rejected honestly`);
}

// A4 · service.add
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, {
    proposal: { kind: "service.add", selector: {}, newValue: { name: "Restoration & refacing", summary: "We restore existing staircases without full replacement." } }
  }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "service.add", `A4.1 · service.add proposed`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200, `A4.2 · service applied`);
  const svc = bc.getBusiness(SLUG).blueprint.data.find(d => d.id === "services").seed;
  assert(svc.some(s => s.name === "Restoration & refacing"), `A4.3 · new service present in Blueprint`);
}

// A5 · service.description
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, {
    proposal: { kind: "service.description", selector: { name: "In-house manufacture" }, newValue: "Every staircase built by our own joiners in our Herefordshire workshop." }
  }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "service.description", `A5.1 · service.description proposed`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200 && String(a.json.audit.after).includes("Herefordshire"), `A5.2 · service description applied`);
}

// A6 · seo.title-template
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, {
    proposal: { kind: "seo.title-template", selector: {}, newValue: "%s · Rowan Staircases · UK" }
  }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "seo.title-template", `A6.1 · seo.title-template proposed`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200 && a.json.audit.after === "%s · Rowan Staircases · UK", `A6.2 · title template applied`);
}

// A7 · product.feature (natural-language "make X featured")
{
  const p = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Make the Meridian featured" }, ownerCookie);
  assert(p.status === 200 && p.json.proposal?.kind === "product.feature", `A7.1 · product.feature proposed (kind=${p.json.proposal?.kind})`);
  const a = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p.json.proposal.proposalId, confirmed: true }, ownerCookie);
  assert(a.status === 200 && a.json.audit.after === true, `A7.2 · product featured applied`);
}

// ============================================================================
// 17B · Grouped batch changes · one approval, N applies
// ============================================================================

console.log("\n---------- 17B · Grouped batch ----------");

// B1 · Compound instruction · 3 changes in one message
const compound = "Change the Helix price to £24,500, update the Coastal price to £9,999, and make Ashcombe featured";
const b1 = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: compound }, ownerCookie);
assert(b1.status === 200 && b1.json.batch?.proposals?.length === 3, `B1.1 · batch has 3 proposals (got ${b1.json.batch?.proposals?.length})`);
assert(b1.json.say.startsWith("I've prepared 3 changes"), `B1.2 · NEX response uses grouped language ("${b1.json.say.split("\n")[0]}")`);

// Blueprint unchanged after propose-batch · nothing applied yet
const helixPreBatch = bc.getBusiness(SLUG).blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "helix-oak-open-tread").price.amount;
assert(helixPreBatch === 14500, `B1.3 · Blueprint unchanged after propose-batch (Helix still £145 · got ${helixPreBatch}p)`);

// B2 · Apply-all with single approval
const b1apply = await POST(aBatch, `/api/b/${SLUG}/owner/nex/apply-batch`, { batchId: b1.json.batch.batchId, confirmed: true }, ownerCookie);
assert(b1apply.status === 200 && b1apply.json.audits?.length === 3, `B2.1 · apply-all succeeded with 3 audit entries`);

// Every audit entry stamped with the batchId
const stampedCount = b1apply.json.audits.filter(a => a.batchId === b1.json.batch.batchId).length;
assert(stampedCount === 3, `B2.2 · all 3 audit entries stamped with batchId (${stampedCount}/3)`);

// Distinct mutationIds inside the batch (each is its own audit record)
const mutationIds = new Set(b1apply.json.audits.map(a => a.mutationId));
assert(mutationIds.size === 3, `B2.3 · each mutation gets a unique mutationId (${mutationIds.size} unique)`);

// Blueprint reflects all three changes
const productsAfter = bc.getBusiness(SLUG).blueprint.data.find(d => d.id === "products").seed;
const helixAfter    = productsAfter.find(p => p.slug === "helix-oak-open-tread");
const coastalAfter  = productsAfter.find(p => p.slug === "coastal-painted");
const ashcombeAfter = productsAfter.find(p => p.slug === "ashcombe-oak-traditional");
assert(helixAfter.price.amount === 2450000,    `B2.4 · Helix price now £24,500 (got ${helixAfter.price.amount}p)`);
assert(coastalAfter.price.amount === 999900,   `B2.5 · Coastal price now £9,999 (got ${coastalAfter.price.amount}p)`);
assert(ashcombeAfter.featured === true,        `B2.6 · Ashcombe featured (got ${ashcombeAfter.featured})`);

// B3 · Customer chat immediately reflects a batch change
const custQ = await POST(custMsg, `/api/b/${SLUG}/customer/message`, { text: "How much is the Helix?" }, custCookie);
assert(/24,500|24500/.test(custQ.json.reply.text), `B3.1 · customer sees Helix at new price · reply="${custQ.json.reply.text}"`);

// ============================================================================
// 17C · Constitutional ambiguity handling · unclear fragments surfaced
// ============================================================================

console.log("\n---------- 17C · Ambiguity handling ----------");

// One valid fragment + one nonsense fragment · batch must NOT apply
const ambiguous = "Change the Coastal price to £5,500 and rejig the widget flange to blorbium";
const c1 = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: ambiguous }, ownerCookie);
assert(c1.status === 400, `C1.1 · ambiguous batch rejected · not silently applied (status=${c1.status})`);
assert(c1.json.needsClarification === true, `C1.2 · marked as needsClarification`);
assert((c1.json.unclearFragments ?? []).some(f => /blorbium|widget flange/i.test(f)), `C1.3 · unclear fragment surfaced honestly (fragments=${JSON.stringify(c1.json.unclearFragments)})`);
assert(/rephrase|clarify/i.test(c1.json.say ?? ""), `C1.4 · NEX asks for clarification rather than guessing ("${(c1.json.say ?? "").split("\n")[0]}")`);

// Blueprint DID NOT mutate the valid half (all-or-nothing)
const coastalStillAtBatchPrice = bc.getBusiness(SLUG).blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "coastal-painted").price.amount;
assert(coastalStillAtBatchPrice === 999900, `C1.5 · valid fragment NOT silently applied · Coastal still at £9,999 (got ${coastalStillAtBatchPrice}p)`);

// ============================================================================
// 17D · Permission gate on batch endpoints
// ============================================================================

console.log("\n---------- 17D · Permission gate ----------");

const compoundLegit = "Change the Helix price to £30,000 and make Coastal featured";

const anonPropose = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: compoundLegit }, null);
assert(anonPropose.status === 401, `D1 · anonymous rejected from propose-batch (${anonPropose.status})`);

const custPropose = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: compoundLegit }, custCookie);
assert(custPropose.status === 403, `D2 · customer cookie rejected from propose-batch (${custPropose.status})`);

const crossPropose = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: compoundLegit }, otherOwner);
assert(crossPropose.status === 403, `D3 · cross-business owner rejected from propose-batch (${crossPropose.status})`);

// Owner-legit propose → then attack the apply endpoint
const ownerPropose = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: compoundLegit }, ownerCookie);
assert(ownerPropose.status === 200, `D4 · owner propose ok`);
const batchIdForAttack = ownerPropose.json.batch.batchId;

const anonApply = await POST(aBatch, `/api/b/${SLUG}/owner/nex/apply-batch`, { batchId: batchIdForAttack, confirmed: true }, null);
assert(anonApply.status === 401, `D5 · anonymous rejected from apply-batch (${anonApply.status})`);

const custApply = await POST(aBatch, `/api/b/${SLUG}/owner/nex/apply-batch`, { batchId: batchIdForAttack, confirmed: true }, custCookie);
assert(custApply.status === 403, `D6 · customer rejected from apply-batch (${custApply.status})`);

const crossApply = await POST(aBatch, `/api/b/${SLUG}/owner/nex/apply-batch`, { batchId: batchIdForAttack, confirmed: true }, otherOwner);
assert(crossApply.status === 403, `D7 · cross-business owner rejected from apply-batch (${crossApply.status})`);

// Ensure the batch is still applicable by the legit owner (not consumed by rejected attempts)
const legitApply = await POST(aBatch, `/api/b/${SLUG}/owner/nex/apply-batch`, { batchId: batchIdForAttack, confirmed: true }, ownerCookie);
assert(legitApply.status === 200, `D8 · legit owner apply succeeds after cross-role attacks (${legitApply.status})`);

// ============================================================================
// 17E · confirmed=true required
// ============================================================================

console.log("\n---------- 17E · Explicit approval required ----------");

const eProp = await POST(pBatch, `/api/b/${SLUG}/owner/nex/propose-batch`, { instruction: "Change the Helix price to £11,111 and make Meridian featured" }, ownerCookie);
assert(eProp.status === 200, `E1 · propose ok`);

const noConfirm = await POST(aBatch, `/api/b/${SLUG}/owner/nex/apply-batch`, { batchId: eProp.json.batch.batchId /* deliberately omit confirmed */ }, ownerCookie);
assert(noConfirm.status === 400 && /explicit-approval/.test(noConfirm.json.error), `E2 · apply without confirmed=true rejected`);

// ============================================================================
// 17F · Full audit integrity across single + batch mutations
// ============================================================================

console.log("\n---------- 17F · Audit integrity ----------");

const auditFinal = await GET(auditR, `/api/b/${SLUG}/owner/nex/audit`, ownerCookie);
assert(auditFinal.status === 200, `F1 · audit endpoint ok`);
const entries = auditFinal.json.entries;

// Every entry has a monotonic revision · no gaps
let monotonic = true;
for (let i = 1; i < entries.length; i++) {
  if (entries[i].blueprintRevisionBefore !== entries[i - 1].blueprintRevisionAfter) { monotonic = false; break; }
}
assert(monotonic, `F2 · blueprint revisions monotonic across ${entries.length} audit entries`);

// Batch-linked entries have batchId, single-instruction entries do not
const batchLinked = entries.filter(e => e.batchId).length;
const singleLinked = entries.filter(e => !e.batchId).length;
assert(batchLinked >= 3 && singleLinked >= 7, `F3 · lifecycle counts (batch-stamped=${batchLinked}, single=${singleLinked}) both non-zero`);

// Distinct batchIds should form small groups (one batch per group)
const byBatch = new Map();
for (const e of entries) if (e.batchId) byBatch.set(e.batchId, (byBatch.get(e.batchId) ?? 0) + 1);
assert([...byBatch.values()].every(n => n >= 2), `F4 · every stamped batchId groups >= 2 entries · confirms group cohesion (groups=${JSON.stringify([...byBatch.entries()])})`);

// ============================================================================
// Summary
// ============================================================================

console.log("");
console.log("─".repeat(60));
console.log(`Phase 17 · Broader surface + batches · ${pass} passed · ${fail} failed`);
console.log("─".repeat(60));
if (fail > 0) process.exit(1);
