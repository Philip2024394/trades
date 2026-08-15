// NEX App Builder · Phase 16 · Undo + Change History e2e (Philip 2026-08-14).
//
// Proves:
//   - Undo is a GOVERNED mutation (propose → confirm → apply · never silent)
//   - Applied mutation gains a "Undo this change" possibility
//   - Undo entry links back to the original via undoOfMutationId
//   - Original entry updated with undoneByMutationId
//   - Cannot undo the same mutation twice
//   - Cross-business owner rejected from undo
//   - Customer session rejected
//   - Blueprint state actually restores
//   - Customer chat immediately sees restored value
//   - Blueprint revision monotonic across undo

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

const bc = await import("../../src/lib/nex/business-context/index.ts");
const auth = await import("../../src/lib/nex/auth/index.ts");
const conv = await import("../../src/lib/nex/business-context/conversations.ts");
const muts = await import("../../src/lib/nex/mutations/index.ts");
const signer = await import("../../src/lib/nex/auth/session-signer.ts");
const propose = await import("../../src/app/api/b/[slug]/owner/nex/propose/route.ts");
const apply = await import("../../src/app/api/b/[slug]/owner/nex/apply/route.ts");
const undo = await import("../../src/app/api/b/[slug]/owner/nex/undo/route.ts");
const auditRoute = await import("../../src/app/api/b/[slug]/owner/nex/audit/route.ts");
const customerMessage = await import("../../src/app/api/b/[slug]/customer/message/route.ts");

bc._resetRegistryForTest();
conv._resetConversationsForTest();
auth._resetAccountsForTest();
muts._resetAuditForTest();
muts._resetProposalsForTest();
bc.ensureSeeded();
auth.ensureOwnerAccountsSeeded();

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { console.log("PASS:", msg); pass++; } else { console.error("FAIL:", msg); fail++; } }

const SLUG = "rowan-staircases";
const ownerCookie = signer.signSession({ role: "owner", businessSlug: SLUG, ownerAccountId: "owner_test_1", email: "owner@rowanstaircases.co.uk" });
const custCookie  = signer.signSession({ role: "customer", businessSlug: SLUG, customerId: "cust_test_1", email: "alice@example.com" });
const otherOwnerCookie = signer.signSession({ role: "owner", businessSlug: "harborne-plumbing", ownerAccountId: "owner_test_2", email: "owner@harborne-plumbing.co.uk" });

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

// ─── Setup · apply a real mutation we can undo ─────────────────
console.log("\n---------- SETUP · apply a mutation to have something to undo ----------");
const originalRevision = bc.getBusiness(SLUG).blueprint.meta.revision;
const propRes = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Change the Helix staircase price to £22,995" }, ownerCookie);
assert(propRes.status === 200, `SETUP · propose ok`);
const applyRes = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: propRes.json.proposal.proposalId, confirmed: true }, ownerCookie);
assert(applyRes.status === 200, `SETUP · apply ok`);
const originalMutationId = applyRes.json.audit.mutationId;
console.log(`    Applied mutation ${originalMutationId} · rev ${originalRevision} → ${applyRes.json.newRevision}`);

// Customer sees the new price
const custBefore = await POST(customerMessage, `/api/b/${SLUG}/customer/message`, { text: "How much is the Helix?" }, custCookie);
assert(custBefore.json.reply.text.includes("£22,995"), `SETUP · customer sees new £22,995 price`);

// ─── A · Undo is proposed, not silently applied ────────────────
console.log("\n---------- A · Undo is a GOVERNED mutation ----------");
const undoRes = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: originalMutationId }, ownerCookie);
assert(undoRes.status === 200 && undoRes.json.ok === true, `A1: undo endpoint returns 200 with proposal (got ${undoRes.status})`);
assert(!!undoRes.json.proposal.proposalId, "A1: undo returns a proposalId");
assert(undoRes.json.proposal.requiresApproval === true, "A1: undo proposal requires approval");
assert(undoRes.json.undoOfMutationId === originalMutationId, "A1: undo proposal links to original mutation");
assert(undoRes.json.say.includes("Restore"), `A1: NEX response uses restore language`);
console.log("    NEX: " + undoRes.json.say.split("\n")[0]);

// Blueprint is UNCHANGED after propose-undo · nothing applied yet
const midPrice = bc.getBusiness(SLUG).blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "helix-oak-open-tread").price.amount;
assert(midPrice === 2299500, `A2: pre-undo-apply · price still £22,995 in Blueprint (propose does NOT mutate · got ${midPrice}p)`);

// ─── B · Undo apply restores original value ────────────────────
console.log("\n---------- B · Apply undo · Blueprint restored ----------");
const undoApply = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, {
  proposalId: undoRes.json.proposal.proposalId,
  confirmed: true,
  undoOfMutationId: originalMutationId
}, ownerCookie);
assert(undoApply.status === 200 && undoApply.json.ok === true, `B1: undo apply succeeds (got ${undoApply.status})`);
const undoMutationId = undoApply.json.audit.mutationId;
assert(undoApply.json.audit.undoOfMutationId === originalMutationId, `B1: audit entry marked undoOfMutationId=${originalMutationId}`);

// Blueprint restored
const restoredPrice = bc.getBusiness(SLUG).blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "helix-oak-open-tread").price.amount;
assert(restoredPrice === 14500, `B2: Blueprint · Helix price restored to original £145 (got ${restoredPrice}p)`);

// ─── C · Original audit entry is now marked "undone by X" ──────
console.log("\n---------- C · Original entry marked undone ----------");
const auditAfterUndo = await GET(auditRoute, `/api/b/${SLUG}/owner/nex/audit`, ownerCookie);
const originalEntry = auditAfterUndo.json.entries.find(e => e.mutationId === originalMutationId);
const undoEntry = auditAfterUndo.json.entries.find(e => e.mutationId === undoMutationId);
assert(!!originalEntry && originalEntry.undoneByMutationId === undoMutationId, `C1: original entry linked · undoneByMutationId=${originalEntry?.undoneByMutationId}`);
assert(!!undoEntry && undoEntry.undoOfMutationId === originalMutationId, `C2: undo entry links back · undoOfMutationId=${undoEntry?.undoOfMutationId}`);

// ─── D · Customer sees restored value immediately ──────────────
console.log("\n---------- D · Customer chat reflects restored value ----------");
const custAfter = await POST(customerMessage, `/api/b/${SLUG}/customer/message`, { text: "How much is the Helix?" }, custCookie);
assert(custAfter.json.reply.text.includes("£145"), `D1: customer immediately sees restored £145 price · got "${custAfter.json.reply.text}"`);

// ─── E · Cannot undo the same mutation twice ───────────────────
console.log("\n---------- E · Undo idempotency · already-undone rejected ----------");
const doubleUndo = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: originalMutationId }, ownerCookie);
assert(doubleUndo.status === 400 && /already undone/.test(doubleUndo.json.error), `E1: re-undoing already-undone mutation rejected (got ${doubleUndo.json.error})`);

// ─── F · Undoing an unknown mutation rejected ──────────────────
console.log("\n---------- F · Unknown mutation id rejected ----------");
const unknownUndo = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: "mut_does_not_exist" }, ownerCookie);
assert(unknownUndo.status === 400 && /not found/.test(unknownUndo.json.error), `F1: unknown mutationId rejected`);

// ─── G · Permission gate · undo is owner-only, business-scoped ──
console.log("\n---------- G · Permission gate on undo ----------");
// Apply another mutation to have something for cross-business + customer tests
const p2 = await POST(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Change the Helix price to £999" }, ownerCookie);
const a2 = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: p2.json.proposal.proposalId, confirmed: true }, ownerCookie);
const secondMutationId = a2.json.audit.mutationId;

const anonUndo = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: secondMutationId }, null);
assert(anonUndo.status === 401, `G1: anonymous rejected from undo (got ${anonUndo.status})`);

const custUndo = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: secondMutationId }, custCookie);
assert(custUndo.status === 403, `G2: customer cookie rejected from undo (got ${custUndo.status})`);

const crossBizUndo = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: secondMutationId }, otherOwnerCookie);
assert(crossBizUndo.status === 403, `G3: cross-business owner rejected from undo (got ${crossBizUndo.status})`);

// ─── H · Undo apply also requires explicit confirmation ─────────
console.log("\n---------- H · Undo apply requires confirmed=true ----------");
const noConfirmUndo = await POST(undo, `/api/b/${SLUG}/owner/nex/undo`, { mutationId: secondMutationId }, ownerCookie);
const noConfirmApply = await POST(apply, `/api/b/${SLUG}/owner/nex/apply`, {
  proposalId: noConfirmUndo.json.proposal.proposalId,
  undoOfMutationId: secondMutationId
  // Deliberately omit confirmed
}, ownerCookie);
assert(noConfirmApply.status === 400 && /explicit-approval/.test(noConfirmApply.json.error), `H1: undo apply without confirmed=true rejected`);

// ─── I · Blueprint revision monotonic across undo ──────────────
console.log("\n---------- I · Blueprint revision monotonic ----------");
const finalRev = bc.getBusiness(SLUG).blueprint.meta.revision;
assert(finalRev >= originalRevision + 3, `I1: revision advanced (${originalRevision} → ${finalRev}) · original+undo+second-mutation`);
// Each audit entry's revisionBefore should equal previous entry's revisionAfter (no gaps)
const chrono = auditAfterUndo.json.entries;
for (let i = 1; i < chrono.length; i++) {
  assert(chrono[i].blueprintRevisionBefore === chrono[i - 1].blueprintRevisionAfter,
    `I2: chronological revision continuity at index ${i} (${chrono[i - 1].blueprintRevisionAfter} → ${chrono[i].blueprintRevisionBefore})`);
}

// ─── J · Lifecycle states surfaced clearly ─────────────────────
console.log("\n---------- J · Lifecycle states ----------");
// Refresh audit after cleanup
const auditFinal = await GET(auditRoute, `/api/b/${SLUG}/owner/nex/audit`, ownerCookie);
const applied = auditFinal.json.entries.filter(e => !e.undoOfMutationId && !e.undoneByMutationId);
const undone = auditFinal.json.entries.filter(e => e.undoneByMutationId);
const undos = auditFinal.json.entries.filter(e => e.undoOfMutationId);
console.log(`    Lifecycle · Applied: ${applied.length} · Undone: ${undone.length} · Undo entries: ${undos.length}`);
assert(applied.length + undone.length + undos.length === auditFinal.json.entries.length, "J1: every audit entry classified into a lifecycle state");
assert(undone.length === undos.length, "J2: each Undone entry has a matching Undo entry (linked pairs)");

// ─── Summary ─────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log(`Phase 16 · Undo + Change History · ${pass} passed · ${fail} failed`);
console.log("─".repeat(60));
if (fail > 0) process.exit(1);
