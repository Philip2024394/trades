// NEX App Builder · Phase 14 · Mutation engine e2e (Philip 2026-08-14).
//
// Proves the owner→NEX→business→customer loop:
//   Owner instruction → NEX proposes (before/after) → owner approves →
//   NEX applies + audits → customer sees new state.

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

const bc = await import("../../src/lib/nex/business-context/index.ts");
const auth = await import("../../src/lib/nex/auth/index.ts");
const conv = await import("../../src/lib/nex/business-context/conversations.ts");
const muts = await import("../../src/lib/nex/mutations/index.ts");
const signer = await import("../../src/lib/nex/auth/session-signer.ts");
const propose = await import("../../src/app/api/b/[slug]/owner/nex/propose/route.ts");
const apply = await import("../../src/app/api/b/[slug]/owner/nex/apply/route.ts");
const audit = await import("../../src/app/api/b/[slug]/owner/nex/audit/route.ts");
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

// Owner cookie
const ownerCookie = signer.signSession({ role: "owner", businessSlug: SLUG, ownerAccountId: "owner_test_1", email: "owner@rowanstaircases.co.uk" });
const custCookie  = signer.signSession({ role: "customer", businessSlug: SLUG, customerId: "cust_test_1", email: "alice@example.com" });

async function post(route, path, body, cookie) {
  const req = new Request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookie ? `${auth.SESSION_COOKIE_NAME}=${cookie}` : "" },
    body: JSON.stringify(body)
  });
  const res = await route.POST(req, { params: Promise.resolve({ slug: SLUG }) });
  return { status: res.status, json: await res.json() };
}
async function get(route, path, cookie) {
  const req = new Request(`http://test${path}`, {
    method: "GET",
    headers: { cookie: cookie ? `${auth.SESSION_COOKIE_NAME}=${cookie}` : "" }
  });
  const res = await route.GET(req, { params: Promise.resolve({ slug: SLUG }) });
  return { status: res.status, json: await res.json() };
}

// ─── A · Owner instruction → proposal (before/after) · never silent ─
console.log("\n---------- A · Propose · never silently mutate ----------");

// 1. NL instruction
const propNL = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "Change the Helix oak staircase price to £16,995" }, ownerCookie);
assert(propNL.status === 200 && propNL.json.ok === true, `A1: NL propose ok (got ${propNL.status})`);
assert(propNL.json.proposal.kind === "product.price", "A1: interpreter routed NL → product.price");
assert(propNL.json.proposal.before && propNL.json.proposal.after, "A1: proposal includes before + after (NEX never silent)");
assert(propNL.json.proposal.requiresApproval === true, "A1: proposal.requiresApproval === true");
assert(propNL.json.say.includes("Apply?"), "A1: response asks the owner to Apply");
console.log("    NEX: " + propNL.json.say.replace(/\n/g, "\n         "));

const proposalId = propNL.json.proposal.proposalId;
const before = propNL.json.proposal.before;
const after = propNL.json.proposal.after;
assert(typeof before?.amount === "number", `A1: current price captured (amount=${before?.amount}p)`);
assert(after?.amount === 1699500, `A1: proposed price is £16,995 (amount=${after?.amount}p)`);
const originalPrice = before.amount;

// ─── B · Blueprint UNCHANGED before apply ────────────────────────
console.log("\n---------- B · Blueprint unchanged before apply ----------");
const bizPreApply = bc.getBusiness(SLUG);
const preRevision = bizPreApply.blueprint.meta.revision;
const preProducts = bizPreApply.blueprint.data.find(d => d.id === "products").seed;
const helixPre = preProducts.find(p => p.slug === "helix-oak-open-tread");
assert(helixPre.price.amount === originalPrice, `B1: pre-apply · Helix price unchanged (${helixPre.price.amount}p · propose does not mutate)`);

// ─── C · Apply requires explicit confirmation ────────────────────
console.log("\n---------- C · Apply requires confirmed=true ----------");
const applyNoConfirm = await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId }, ownerCookie);
assert(applyNoConfirm.status === 400 && /explicit-approval-required/.test(applyNoConfirm.json.error), `C1: apply without confirmed=true rejected 400 (got ${applyNoConfirm.status} · ${applyNoConfirm.json.error})`);

// ─── D · Apply with confirmation ────────────────────────────────
console.log("\n---------- D · Apply · records audit · updates Blueprint ----------");
const applyOk = await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId, confirmed: true }, ownerCookie);
assert(applyOk.status === 200 && applyOk.json.ok === true, `D1: confirmed apply succeeds (got ${applyOk.status})`);
assert(applyOk.json.audit && applyOk.json.audit.mutationId.startsWith("mut_"), "D1: audit entry returned with mutationId");
assert(applyOk.json.newRevision === preRevision + 1, `D1: Blueprint revision bumped ${preRevision} → ${applyOk.json.newRevision}`);
assert(applyOk.json.say.includes("Done"), "D1: NEX confirms Done");

// Blueprint reflects new value
const bizPostApply = bc.getBusiness(SLUG);
const helixPost = bizPostApply.blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "helix-oak-open-tread");
assert(helixPost.price.amount === 1699500, "D2: Blueprint mutated · Helix price now £16,995");
assert(bizPostApply.blueprint.provenance["data.products.0.price"]?.source?.startsWith("owner-mutation:"), "D3: provenance source updated to owner-mutation:<id>");

// Proposal consumed (can't re-apply)
const applyAgain = await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId, confirmed: true }, ownerCookie);
assert(applyAgain.status === 400 && /not found|expired/.test(applyAgain.json.error), `D4: re-applying consumed proposal rejected (got ${applyAgain.json.error})`);

// ─── E · Customer-side reflection · asks about the product ──────
console.log("\n---------- E · Customer sees updated state ----------");
const custMsg = await post(customerMessage, `/api/b/${SLUG}/customer/message`, { text: "How much is the Helix oak staircase?" }, custCookie);
assert(custMsg.status === 200 && custMsg.json.ok === true, `E1: customer message accepted (got ${custMsg.status})`);
assert(custMsg.json.reply.text.includes("£16,995"), `E1: customer sees NEW price · reply="${custMsg.json.reply.text}"`);
console.log("    Customer: \"How much is the Helix oak staircase?\"");
console.log("    Rowan:    \"" + custMsg.json.reply.text + "\"");

// ─── F · 4 more mutation types (proves generic · not hard-coded) ─
console.log("\n---------- F · Other mutation types via same code path ----------");

// F1. product.description via structured proposal
const propDesc = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.description", selector: { slug: "meridian-walnut-cantilever" }, newValue: "Cantilevered American walnut · seamless concealed steel spine · frameless glass balustrade · 8-week lead time." }
}, ownerCookie);
assert(propDesc.status === 200 && propDesc.json.ok === true, `F1: description propose ok`);
await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: propDesc.json.proposal.proposalId, confirmed: true }, ownerCookie);
const bizF1 = bc.getBusiness(SLUG);
const meridian = bizF1.blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "meridian-walnut-cantilever");
assert(meridian.description.includes("frameless glass balustrade"), "F1: description mutated");

// F2. product.image
const propImg = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.image", selector: { slug: "ashcombe-oak-traditional" }, newValue: "hero://staircase-victorian-oak-turned-newels" }
}, ownerCookie);
assert(propImg.status === 200, "F2: image propose ok");
await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: propImg.json.proposal.proposalId, confirmed: true }, ownerCookie);

// F3. page.heading
const propHead = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "page.heading", selector: { pageId: "home" }, newValue: "Handmade staircases · built to outlast your house" }
}, ownerCookie);
assert(propHead.status === 200, "F3: page.heading propose ok");
await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: propHead.json.proposal.proposalId, confirmed: true }, ownerCookie);
const bizF3 = bc.getBusiness(SLUG);
const homeHero = bizF3.blueprint.pages.find(p => p.id === "home").sections.find(s => s.registryId.startsWith("hero"));
assert(homeHero.props.headline === "Handmade staircases · built to outlast your house", "F3: home hero headline mutated");

// F4. product.add
const propAdd = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.add", selector: {}, newValue: {
    slug: "sable-black-metal", name: "Sable · black metal", description: "Powder-coated steel stringer with reclaimed oak treads.",
    price: { amount: 89000, currency: "GBP" }, images: ["hero://staircase-cantilever-black-metal-modern"], featured: false
  }}
}, ownerCookie);
assert(propAdd.status === 200, "F4: product.add propose ok");
await post(apply, `/api/b/${SLUG}/owner/nex/apply`, { proposalId: propAdd.json.proposal.proposalId, confirmed: true }, ownerCookie);
const bizF4 = bc.getBusiness(SLUG);
const products = bizF4.blueprint.data.find(d => d.id === "products").seed;
assert(products.some(p => p.slug === "sable-black-metal"), "F4: new product added to catalogue");

// ─── G · Validation refuses fabrication ─────────────────────────
console.log("\n---------- G · Validation refuses fabrication ----------");

// Unknown product
const badProduct = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.price", selector: { slug: "does-not-exist" }, newValue: { amount: 10000, currency: "GBP" } }
}, ownerCookie);
assert(badProduct.status === 400 && /no product matches/.test(badProduct.json.error), `G1: unknown product rejected (got ${badProduct.json.error})`);

// Duplicate slug
const dupSlug = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.add", selector: {}, newValue: { slug: "sable-black-metal", name: "dup", description: "dup", price: { amount: 100, currency: "GBP" }, images: ["hero://x"] } }
}, ownerCookie);
assert(dupSlug.status === 400 && /already exists/.test(dupSlug.json.error), `G2: duplicate slug rejected`);

// Invalid price
const badPrice = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.price", selector: { slug: "helix-oak-open-tread" }, newValue: -100 }
}, ownerCookie);
assert(badPrice.status === 400, `G3: negative price rejected`);

// Unknown mutation kind
const badKind = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, {
  proposal: { kind: "product.delete", selector: { slug: "helix-oak-open-tread" }, newValue: true }
}, ownerCookie);
assert(badKind.status === 400 && /unknown mutation kind/.test(badKind.json.error), `G4: unknown mutation kind rejected (registry defines what's allowed)`);

// ─── H · Permission gate · customer / anonymous / cross-business ─
console.log("\n---------- H · Permission gate ----------");
const custProp = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "cheat" }, custCookie);
assert(custProp.status === 403, `H1: customer cookie rejected from propose (got ${custProp.status})`);

const anonProp = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "cheat" }, null);
assert(anonProp.status === 401, `H2: anonymous rejected from propose (got ${anonProp.status})`);

// Cross-business owner
const otherOwnerCookie = signer.signSession({ role: "owner", businessSlug: "harborne-plumbing", ownerAccountId: "owner_test_2", email: "owner@harborne-plumbing.co.uk" });
const crossBiz = await post(propose, `/api/b/${SLUG}/owner/nex/propose`, { instruction: "change price" }, otherOwnerCookie);
assert(crossBiz.status === 403, `H3: cross-business owner rejected (got ${crossBiz.status})`);

// ─── I · Audit log is owner-only + complete ─────────────────────
console.log("\n---------- I · Audit log ----------");
const auditRes = await get(audit, `/api/b/${SLUG}/owner/nex/audit`, ownerCookie);
assert(auditRes.status === 200, "I1: owner audit list accessible");
assert(auditRes.json.total >= 5, `I1: audit has all applied mutations (>=5 · got ${auditRes.json.total})`);
const kinds = new Set(auditRes.json.entries.map(e => e.kind));
for (const k of ["product.price", "product.description", "product.image", "page.heading", "product.add"]) {
  assert(kinds.has(k), `I1: audit includes ${k}`);
}
for (const e of auditRes.json.entries) {
  assert(e.blueprintRevisionAfter === e.blueprintRevisionBefore + 1, `I2: audit revision bump consistent for ${e.mutationId}`);
  assert(e.ownerAccountId, `I3: audit records owner identity for ${e.mutationId}`);
  assert(e.at, `I4: audit has timestamp for ${e.mutationId}`);
}
const anonAudit = await get(audit, `/api/b/${SLUG}/owner/nex/audit`, null);
assert(anonAudit.status === 401, "I5: audit endpoint anonymous rejected");
const custAudit = await get(audit, `/api/b/${SLUG}/owner/nex/audit`, custCookie);
assert(custAudit.status === 403, "I6: customer cookie can't read audit");

// ─── J · Blueprint revision monotonically increasing ─────────────
console.log("\n---------- J · Blueprint revision monotonic ----------");
const finalBiz = bc.getBusiness(SLUG);
assert(finalBiz.blueprint.meta.revision >= preRevision + 5, `J1: revision advanced ≥5 (${preRevision} → ${finalBiz.blueprint.meta.revision})`);

// ─── Summary ─────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log(`Phase 14 · Mutation engine · ${pass} passed · ${fail} failed`);
console.log("Registered mutation kinds: " + muts.listMutationKinds().join(", "));
console.log("─".repeat(60));
if (fail > 0) process.exit(1);
