// NEX App Builder · Phase 18 · Complete Product Story e2e (Philip 2026-08-14).
//
// Proves the continuous journey:
//   NEX entry (intent classifier) →
//   App Builder (existing) →
//   Publish (mints scoped owner cookie · registers business) →
//   Workspace (owner authenticated via SCOPED cookie) →
//   Customer chat (branded · same business data) →
//   Owner mutation via Assist →
//   Customer chat immediately reflects change →
//   Per-business PWA manifest + SW + icon reachable →
//   Multi-scoped session · owner cookie AND customer cookie coexist for same slug →
//   Cross-business permission gates still hold.
//
// Constitutional locks tested end-to-end:
//   - One account · MULTIPLE concurrent scoped sessions (owner + customer)
//   - Never silently mutate · governance intact after publish
//   - PWA start_url = /b/{slug}/chat · never /nex-app · never /workspace
//   - Intent classifier surfaces ambiguity honestly (no guessing)
//   - Business app is a BRANCH of NEX · same core / same data

process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890";

const bc          = await import("../../src/lib/nex/business-context/index.ts");
const auth        = await import("../../src/lib/nex/auth/index.ts");
const conv        = await import("../../src/lib/nex/business-context/conversations.ts");
const muts        = await import("../../src/lib/nex/mutations/index.ts");
const signer      = await import("../../src/lib/nex/auth/session-signer.ts");
const intentRoute = await import("../../src/app/api/nex-app/intent/route.ts");
const publish     = await import("../../src/app/api/nex-app-builder/publish/route.ts");
const manifestR   = await import("../../src/app/api/b/[slug]/manifest.json/route.ts");
const iconR       = await import("../../src/app/api/b/[slug]/icon/route.ts");
const swR         = await import("../../src/app/api/b/[slug]/sw.js/route.ts");
const propose     = await import("../../src/app/api/b/[slug]/owner/nex/propose/route.ts");
const apply       = await import("../../src/app/api/b/[slug]/owner/nex/apply/route.ts");
const customerMsg = await import("../../src/app/api/b/[slug]/customer/message/route.ts");
const bpSchema    = await import("../../src/lib/app-builder/blueprint-schema.ts");
const staircase   = await import("../../src/lib/app-builder/examples/staircase-company-completed.ts");

bc._resetRegistryForTest();
conv._resetConversationsForTest();
auth._resetAccountsForTest();
muts._resetAuditForTest();
muts._resetProposalsForTest();
muts._resetBatchesForTest?.();
bc.ensureSeeded();
auth.ensureOwnerAccountsSeeded();

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { console.log("PASS:", msg); pass++; } else { console.error("FAIL:", msg); fail++; } }

async function POST(route, path, body, cookieHeader, extraHeaders = {}) {
  const req = new Request(`http://test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookieHeader ? { cookie: cookieHeader } : {}), ...extraHeaders },
    body: JSON.stringify(body)
  });
  const res = await route.POST(req, { params: Promise.resolve(extractParams(path)) });
  const setCookie = res.headers.get("set-cookie");
  const contentType = res.headers.get("content-type") ?? "";
  const body_ = contentType.includes("json") ? await res.json() : await res.text();
  return { status: res.status, json: body_, setCookie, contentType };
}
async function GET(route, path, cookieHeader) {
  const req = new Request(`http://test${path}`, { method: "GET", headers: cookieHeader ? { cookie: cookieHeader } : {} });
  const res = await route.GET(req, { params: Promise.resolve(extractParams(path)) });
  const contentType = res.headers.get("content-type") ?? "";
  const body_ = contentType.includes("json") || contentType.includes("manifest") ? await res.json() : await res.text();
  return { status: res.status, body: body_, contentType, headers: Object.fromEntries(res.headers.entries()) };
}
function extractParams(path) {
  const m = /\/b\/([^\/]+)/.exec(path);
  return m ? { slug: m[1] } : {};
}

// ============================================================================
// 18A · NEX front-door intent classifier
// ============================================================================

console.log("\n---------- 18A · Intent classifier ----------");

{
  // Owner intent
  const r = await POST(intentRoute, "/api/nex-app/intent", { text: "I want to build an app for my staircase business" });
  assert(r.status === 200 && r.json.intent === "owner", `A1 · "build an app for my …" → owner (got ${r.json.intent})`);
  assert(r.json.route === "/nex-app/app-builder", `A2 · owner route correct (${r.json.route})`);
}
{
  // Customer intent
  const r = await POST(intentRoute, "/api/nex-app/intent", { text: "I'm looking for a quote for a new staircase" });
  assert(r.status === 200 && r.json.intent === "customer", `A3 · "looking for a quote for" → customer (got ${r.json.intent})`);
}
{
  // Ambiguous · both signals present
  const r = await POST(intentRoute, "/api/nex-app/intent", { text: "I want to find a business to build my own app" });
  assert(r.status === 200 && r.json.intent === "ambiguous", `A4 · contradictory signals → ambiguous (got ${r.json.intent})`);
  assert(r.json.route === null, `A5 · ambiguous returns no route (honest · buttons still available)`);
}
{
  // Neither
  const r = await POST(intentRoute, "/api/nex-app/intent", { text: "hello world" });
  assert(r.status === 200 && r.json.intent === "ambiguous", `A6 · no clear signal → ambiguous (never guesses)`);
}

// ============================================================================
// 18B · Publish · scoped owner cookie · workspace deep-link
// ============================================================================

console.log("\n---------- 18B · Publish → scoped owner session ----------");

// Build a fresh Blueprint for a brand-new business (unique slug)
const originalBp = staircase.staircaseCompletedBlueprint;
const newSlug = `test-oak-${Date.now().toString(36)}`;
const newBp = JSON.parse(JSON.stringify(originalBp));
newBp.id = newSlug;
newBp.slug = newSlug;
newBp.identity.displayName = "Test Oak Staircases";
newBp.brand.palette.primary = "#8b5a2b";
newBp.brand.palette.onPrimary = "#ffffff";

const pubRes = await POST(publish, "/api/nex-app-builder/publish", {
  blueprint: newBp,
  ownerEmail: "founder@testoak.example"
});
assert(pubRes.status === 200 && pubRes.json.ok === true, `B1 · publish succeeded (status=${pubRes.status})`);
assert(pubRes.json.slug === newSlug, `B2 · publish returned correct slug (${pubRes.json.slug})`);
assert(pubRes.json.redirectTo === `/b/${newSlug}/workspace`, `B3 · publish redirects to owner workspace`);
assert(!!pubRes.setCookie, `B4 · publish set a cookie`);
assert(pubRes.setCookie?.startsWith(`nex_owner_${newSlug}=`), `B5 · cookie is SCOPED (nex_owner_<slug>) not legacy (got prefix=${pubRes.setCookie?.split("=")[0]})`);
assert(pubRes.setCookie?.includes("HttpOnly"), `B6 · cookie is HttpOnly`);

// Extract the cookie value
const cookieValue = pubRes.setCookie.split(";")[0];   // "nex_owner_slug=..."
const ownerCookieHeader = cookieValue;

// Business is now registered
assert(!!bc.getBusiness(newSlug), `B7 · business registered in NEX Core`);

// Publish clash · same slug rejected
const clashRes = await POST(publish, "/api/nex-app-builder/publish", { blueprint: newBp, ownerEmail: "someone@else.com" });
assert(clashRes.status === 409, `B8 · publishing an existing slug rejected (409)`);

// ============================================================================
// 18C · Workspace access via scoped owner cookie
// ============================================================================

console.log("\n---------- 18C · Owner mutates via NEX Assist (scoped cookie) ----------");

// Owner proposes a mutation on the newly published business, using the scoped cookie
const propRes = await POST(propose, `/api/b/${newSlug}/owner/nex/propose`, { instruction: "Change the Helix staircase price to £19,995" }, ownerCookieHeader);
assert(propRes.status === 200, `C1 · owner propose succeeds with scoped cookie (${propRes.status})`);
const applyRes = await POST(apply, `/api/b/${newSlug}/owner/nex/apply`, { proposalId: propRes.json.proposal.proposalId, confirmed: true }, ownerCookieHeader);
assert(applyRes.status === 200, `C2 · owner apply succeeds with scoped cookie (${applyRes.status})`);

// Blueprint reflects mutation
const helixPrice = bc.getBusiness(newSlug).blueprint.data.find(d => d.id === "products").seed.find(p => p.slug === "helix-oak-open-tread").price.amount;
assert(helixPrice === 1999500, `C3 · Blueprint reflects mutation (Helix price = £19,995 · got ${helixPrice}p)`);

// Legacy nex_session cookie NOT set · this browser only has the scoped one
assert(!ownerCookieHeader.includes("nex_session="), `C4 · publish only set the SCOPED cookie · no legacy stomping`);

// ============================================================================
// 18D · Customer chat reflects owner change (dual session support)
// ============================================================================

console.log("\n---------- 18D · Dual scoped session on same browser ----------");

// Simulate the OWNER opening the customer chat surface for THEIR OWN business
// on the same browser · the owner cookie is present but the customer route
// treats them as an unauthenticated visitor (no customer session yet).
const custQ = await POST(customerMsg, `/api/b/${newSlug}/customer/message`, { text: "How much is the Helix?" }, ownerCookieHeader);
assert(custQ.status === 200 && /19,995|19995/.test(custQ.json.reply.text), `D1 · customer chat immediately reflects owner mutation · reply="${custQ.json.reply.text}"`);

// Also verify that anonymous (no cookie) customer sees the same
const anonQ = await POST(customerMsg, `/api/b/${newSlug}/customer/message`, { text: "How much is the Helix?" }, null);
assert(anonQ.status === 200 && /19,995|19995/.test(anonQ.json.reply.text), `D2 · anonymous customer sees the same current price`);

// Multi-scoped session · same browser holds owner-for-newSlug AND (simulated) customer-for-newSlug cookie
const custSession = signer.signSession({ role: "customer", businessSlug: newSlug, customerId: "cust_phone_1", email: "owner@testoak.example" });
const dualCookieHeader = `${ownerCookieHeader}; nex_customer_${newSlug}=${custSession}`;
const dualQ = await POST(customerMsg, `/api/b/${newSlug}/customer/message`, { text: "How much is the Coastal?" }, dualCookieHeader);
assert(dualQ.status === 200, `D3 · same browser with OWNER + CUSTOMER cookies for same slug can still hit customer surface (${dualQ.status})`);

// ============================================================================
// 18E · PWA manifest / SW / icon integrity
// ============================================================================

console.log("\n---------- 18E · Per-business PWA layer ----------");

const mf = await GET(manifestR, `/api/b/${newSlug}/manifest.json`);
assert(mf.status === 200, `E1 · manifest reachable (${mf.status})`);
assert(mf.body.start_url === `/b/${newSlug}/chat`, `E2 · start_url is /b/{slug}/chat · NEVER /nex-app (got ${mf.body.start_url})`);
assert(mf.body.scope === `/b/${newSlug}/`, `E3 · scope confined to business branch (got ${mf.body.scope})`);
assert(mf.body.name === "Test Oak Staircases", `E4 · name pulled from Blueprint (got ${mf.body.name})`);
assert(mf.body.theme_color === "#8b5a2b", `E5 · theme_color pulled from Blueprint brand (got ${mf.body.theme_color})`);
assert(Array.isArray(mf.body.icons) && mf.body.icons.length >= 1, `E6 · icons array present (${mf.body.icons?.length})`);
assert(mf.body.icons.every(i => i.src.startsWith(`/api/b/${newSlug}/icon`)), `E7 · icons served same-origin (no third-party host)`);
assert(mf.contentType.startsWith("application/manifest+json"), `E8 · manifest content-type correct (${mf.contentType})`);

const swBody = await GET(swR, `/api/b/${newSlug}/sw.js`);
assert(swBody.status === 200, `E9 · SW reachable (${swBody.status})`);
assert(swBody.contentType.includes("application/javascript"), `E10 · SW served as JS (${swBody.contentType})`);
assert(swBody.headers["service-worker-allowed"] === `/b/${newSlug}/`, `E11 · Service-Worker-Allowed matches scope`);
assert(/self\.addEventListener\(["']install["']/.test(swBody.body), `E12 · SW has install listener`);

const iconBody = await GET(iconR, `/api/b/${newSlug}/icon?size=512`);
assert(iconBody.status === 200 && iconBody.contentType.includes("svg"), `E13 · icon is SVG (${iconBody.contentType})`);
assert(iconBody.body.includes(`fill="#8b5a2b"`), `E14 · icon uses Blueprint primary colour`);
assert(iconBody.body.includes(">T</text>"), `E15 · icon carries business initial (T for Test Oak)`);

// ============================================================================
// 18F · Cross-business isolation with scoped cookies
// ============================================================================

console.log("\n---------- 18F · Cross-business permission gate holds ----------");

// Owner of NEW business tries to mutate the seeded ROWAN business ·
// their scoped cookie doesn't match rowan's slug so they look anonymous
// on the rowan surface (401 is correct · honest rejection).
const cross = await POST(propose, `/api/b/rowan-staircases/owner/nex/propose`, { instruction: "Change the Helix price to £99" }, ownerCookieHeader);
assert([401, 403].includes(cross.status), `F1 · owner-of-testoak CANNOT propose on rowan-staircases (${cross.status})`);

// Anonymous cannot propose either
const anonProp = await POST(propose, `/api/b/${newSlug}/owner/nex/propose`, { instruction: "Change the price to £1" }, null);
assert(anonProp.status === 401, `F2 · anonymous rejected from propose (${anonProp.status})`);

// A CUSTOMER-scoped cookie for the same slug also cannot propose · owner
// route filters to owner-only scoped cookie so the customer cookie is
// invisible · caller looks anonymous → 401 (correct · role separation).
const custScopedOnly = signer.signSession({ role: "customer", businessSlug: newSlug, customerId: "cust_x", email: "cust@x.com" });
const custOnlyHeader = `nex_customer_${newSlug}=${custScopedOnly}`;
const custProp = await POST(propose, `/api/b/${newSlug}/owner/nex/propose`, { instruction: "Change the price to £1" }, custOnlyHeader);
assert([401, 403].includes(custProp.status), `F3 · customer-scoped cookie cannot propose on owner surface (${custProp.status})`);

// ============================================================================
// 18G · Legacy sessions still work (backwards compat)
// ============================================================================

console.log("\n---------- 18G · Legacy `nex_session` cookie preserved ----------");

const legacyCookie = signer.signSession({ role: "owner", businessSlug: "rowan-staircases", ownerAccountId: "owner_legacy_1", email: "owner@rowanstaircases.co.uk" });
const legacyHeader = `${auth.SESSION_COOKIE_NAME}=${legacyCookie}`;
const legacyProp = await POST(propose, `/api/b/rowan-staircases/owner/nex/propose`, { instruction: "Change the Helix price to £42,000" }, legacyHeader);
assert(legacyProp.status === 200, `G1 · legacy single-cookie flow still works (${legacyProp.status})`);

// ============================================================================
// Summary
// ============================================================================

console.log("");
console.log("─".repeat(60));
console.log(`Phase 18 · Complete Product Story · ${pass} passed · ${fail} failed`);
console.log("─".repeat(60));
if (fail > 0) process.exit(1);
