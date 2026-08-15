// NEX App Builder · Phase 12 · Two-surface e2e (Philip 2026-08-14).
// Phase 13 note: the session reader now prefers signed cookies. Setting
// NODE_ENV="test" enables the unsigned header fallback used by this suite.
process.env.NODE_ENV = "test";
//
// Proves the Customer / Owner separation without a running dev server —
// exercises the API route handlers + permission gates directly.
//
// Test buckets (per Philip's spec):
//   CUSTOMER   — branded chat works · gets NEX-powered response · can continue
//   OWNER      — workspace sees the conversation · full trail · branded per business
//   SECURITY   — customer → owner rejected · customer → other business rejected ·
//                owner → other business rejected · anonymous → rejected

import { readFile } from "node:fs/promises";

// Import the whole app-builder + business context modules
await import("../../src/lib/studio/sections/index.ts");
const bc = await import("../../src/lib/nex/business-context/index.ts");
const convs = await import("../../src/lib/nex/business-context/conversations.ts");
const customerRoute = await import("../../src/app/api/b/[slug]/customer/message/route.ts");
const ownerRoute = await import("../../src/app/api/b/[slug]/owner/conversations/route.ts");

// Reset registry + conversations between test runs so this is deterministic.
bc._resetRegistryForTest();
convs._resetConversationsForTest();
bc.ensureSeeded();

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else      { console.error("FAIL:", msg); fail++; }
}

// Helpers
function mkReq({ url, method = "POST", session, body }) {
  const headers = { "content-type": "application/json" };
  if (session) headers["x-nex-session"] = bc.encodeSession(session);
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}
async function callCustomer(slug, session, body) {
  const req = mkReq({ url: `http://test/api/b/${slug}/customer/message`, session, body });
  const res = await customerRoute.POST(req, { params: Promise.resolve({ slug }) });
  return { status: res.status, json: await res.json() };
}
async function callOwner(slug, session) {
  const req = mkReq({ url: `http://test/api/b/${slug}/owner/conversations`, method: "GET", session });
  const res = await ownerRoute.GET(req, { params: Promise.resolve({ slug }) });
  return { status: res.status, json: await res.json() };
}

// ─────────────────────────────────────────────────────────────
// BUCKET A · CUSTOMER experience
// ─────────────────────────────────────────────────────────────
console.log("\n---------- A · CUSTOMER experience ----------");

const rowan = bc.getBusiness("rowan-staircases");
assert(!!rowan, "Rowan Architectural Staircases registered from seed");

const customerId1 = "cust_test_1";
const customerSession = { role: "customer", businessSlug: "rowan-staircases", customerId: customerId1 };

// A1. Send first message · get NEX-powered response
const r1 = await callCustomer("rowan-staircases", customerSession, { text: "Hi, do you make oak staircases?" });
assert(r1.status === 200 && r1.json.ok === true, `A1: customer message accepted (status=${r1.status})`);
assert(!!r1.json.conversationId, "A1: conversationId returned");
assert(!!r1.json.reply && r1.json.reply.author === "business", "A1: business reply present");
assert(r1.json.reply.text.includes("Rowan Architectural Staircases"), "A1: reply is BRANDED with business name (not 'NEX')");
assert(!r1.json.reply.text.toLowerCase().includes("nex"), "A1: reply does NOT mention NEX to customer");
console.log("    Customer: \"Hi, do you make oak staircases?\"");
console.log("    " + rowan.blueprint.identity.displayName + ": \"" + r1.json.reply.text + "\"");
const convId = r1.json.conversationId;

// A2. Continue the conversation
const r2 = await callCustomer("rowan-staircases", customerSession, { text: "What area do you cover?", conversationId: convId });
assert(r2.status === 200 && r2.json.conversationId === convId, "A2: continue same conversation");
assert(r2.json.reply.text.length > 0, "A2: business replies again");
console.log("    Customer: \"What area do you cover?\"");
console.log("    " + rowan.blueprint.identity.displayName + ": \"" + r2.json.reply.text + "\"");

// A3. Send an enquiry
const r3 = await callCustomer("rowan-staircases", customerSession, { text: "Can you give me a quote?", conversationId: convId });
assert(r3.json.reply.text.toLowerCase().includes("quote") || r3.json.reply.text.toLowerCase().includes("details"), "A3: quote intent recognised");

// ─────────────────────────────────────────────────────────────
// BUCKET B · OWNER experience
// ─────────────────────────────────────────────────────────────
console.log("\n---------- B · OWNER experience ----------");

const ownerSession = { role: "owner", businessSlug: "rowan-staircases", ownerAccountId: "owner_test_1" };

// B1. Owner sees the customer's conversation
const o1 = await callOwner("rowan-staircases", ownerSession);
assert(o1.status === 200 && o1.json.ok === true, `B1: owner conversations endpoint returns 200 (got ${o1.status})`);
assert(o1.json.total >= 1, `B1: owner sees ${o1.json.total} conversation(s)`);
assert(o1.json.business.displayName === "Rowan Architectural Staircases", "B1: response identifies the correct business");

const conv = o1.json.conversations.find(c => c.id === convId);
assert(!!conv, "B1: owner sees the specific conversation");
assert(conv.messages.length === 6, `B1: full message trail (3 customer + 3 business = 6 · got ${conv.messages.length})`);
assert(conv.messages[0].text === "Hi, do you make oak staircases?", "B1: first customer message preserved verbatim");

// B2. Owner sees provenance on business messages
const businessMessages = conv.messages.filter(m => m.author === "business");
assert(businessMessages.every(m => !!m.provenance), "B2: every business message carries provenance");
assert(businessMessages.some(m => m.provenance.source === "business-identity" || m.provenance.source === "template"), "B2: provenance sources are legitimate (no fabrication)");

// ─────────────────────────────────────────────────────────────
// BUCKET C · SECURITY · permission separation enforced technically
// ─────────────────────────────────────────────────────────────
console.log("\n---------- C · SECURITY (technical enforcement) ----------");

// C1. Anonymous customer POST → 200. Per Phase 18 constitutional lock,
// the branded customer chat accepts anonymous visitors · they never gain
// admin functionality (owner routes still reject anonymous).
const anonReq = await callCustomer("rowan-staircases", null, { text: "hi there" });
assert(anonReq.status === 200, `C1 (Phase 18): anonymous customer message accepted on branded chat (got ${anonReq.status})`);

// C2. Anonymous owner GET → 401
const anonOwn = await callOwner("rowan-staircases", null);
assert(anonOwn.status === 401, `C2: anonymous owner GET rejected 401 (got ${anonOwn.status})`);

// C3. Customer session hitting OWNER endpoint → 403
const custHittingOwner = await callOwner("rowan-staircases", customerSession);
assert(custHittingOwner.status === 403, `C3: customer trying to read owner conversations rejected 403 (got ${custHittingOwner.status})`);

// C4. Owner session hitting CUSTOMER endpoint → 403
const ownerHittingCustomer = await callCustomer("rowan-staircases", ownerSession, { text: "as owner" });
assert(ownerHittingCustomer.status === 403, `C4: owner trying to POST as customer rejected 403 (got ${ownerHittingCustomer.status})`);

// C5. Customer of Rowan trying to see Harborne owner data → 403
const otherOwnerReq = await callOwner("harborne-plumbing", customerSession);
assert(otherOwnerReq.status === 403, `C5: customer of Rowan cannot see Harborne owner data (got ${otherOwnerReq.status})`);

// C6. Owner of Rowan trying to see Harborne owner data → 403 (cross-business)
const crossBusinessOwner = await callOwner("harborne-plumbing", ownerSession);
assert(crossBusinessOwner.status === 403, `C6: Rowan owner cannot access Harborne owner data (cross-business rejected · got ${crossBusinessOwner.status})`);

// C7. Rowan customer sending message to Harborne → 403
const crossBizCustomer = await callCustomer("harborne-plumbing", customerSession, { text: "cross" });
assert(crossBizCustomer.status === 403, `C7: Rowan customer cannot post to Harborne chat (got ${crossBizCustomer.status})`);

// C8. Rowan owner listing Rowan conversations · but Harborne customer conversation excluded (verify isolation)
// First, seed a customer conversation on Harborne
const harborneCustomer = { role: "customer", businessSlug: "harborne-plumbing", customerId: "cust_test_2" };
await callCustomer("harborne-plumbing", harborneCustomer, { text: "boiler broken" });
const harborneOwner = { role: "owner", businessSlug: "harborne-plumbing", ownerAccountId: "owner_test_2" };
const rowanConvs = await callOwner("rowan-staircases", ownerSession);
const harborneConvs = await callOwner("harborne-plumbing", harborneOwner);
const rowanIds = new Set(rowanConvs.json.conversations.map(c => c.id));
const harborneIds = new Set(harborneConvs.json.conversations.map(c => c.id));
const overlap = [...rowanIds].filter(id => harborneIds.has(id));
assert(overlap.length === 0, `C8: no conversation appears in BOTH owner views · isolation intact (overlap=${overlap.length})`);
assert(rowanConvs.json.conversations.every(c => c.messages.every(m => !m.text.includes("boiler"))), "C8: Rowan owner does NOT see Harborne customer's content");

// ─────────────────────────────────────────────────────────────
// BUCKET D · Business identity injection · reusable across businesses
// ─────────────────────────────────────────────────────────────
console.log("\n---------- D · Business identity injection ----------");

const rowanCust = bc.toCustomerIdentity(bc.getBusiness("rowan-staircases"));
const harborneCust = bc.toCustomerIdentity(bc.getBusiness("harborne-plumbing"));

assert(rowanCust.displayName !== harborneCust.displayName, "D1: two businesses have distinct customer identities");
assert(rowanCust.brand.primary !== harborneCust.brand.primary, "D2: brand primary colours differ between businesses");
assert(rowanCust.vertical.slug !== harborneCust.vertical.slug, "D3: vertical taxonomies differ");

// Customer-safe projection · does NOT leak owner-only fields
assert(!("blueprintId" in rowanCust), "D4: customer identity does NOT expose blueprintId");
assert(!("provenanceKeys" in rowanCust), "D5: customer identity does NOT expose provenance keys");

// Owner identity DOES include those
const rowanOwn = bc.toOwnerIdentity(bc.getBusiness("rowan-staircases"));
assert(!!rowanOwn.blueprintId, "D6: owner identity DOES include blueprintId (permitted)");
assert(Array.isArray(rowanOwn.provenanceKeys), "D7: owner identity includes provenance keys");

// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log(`Phase 12 · Two-surface e2e · ${pass} passed · ${fail} failed`);
console.log("─".repeat(60));
if (fail > 0) process.exit(1);
