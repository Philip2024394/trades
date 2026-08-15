// NEX App Builder · Phase 13 · Real auth e2e (Philip 2026-08-14).
//
// Tests the signed-cookie session layer end-to-end.
// Does NOT set NODE_ENV=test — this suite exercises PRODUCTION signature path.

// Ensure fresh state
process.env.NEX_SESSION_SECRET = "test-secret-do-not-use-in-prod-abcdefghij1234567890"; // 32+ chars

const bc = await import("../../src/lib/nex/business-context/index.ts");
const auth = await import("../../src/lib/nex/auth/index.ts");
const conv = await import("../../src/lib/nex/business-context/conversations.ts");
const signer = await import("../../src/lib/nex/auth/session-signer.ts");
const customerLogin = await import("../../src/app/api/b/[slug]/customer/login/route.ts");
const ownerLogin = await import("../../src/app/api/nex/owner/login/route.ts");
const logout = await import("../../src/app/api/nex/logout/route.ts");
const customerMessage = await import("../../src/app/api/b/[slug]/customer/message/route.ts");
const ownerConversations = await import("../../src/app/api/b/[slug]/owner/conversations/route.ts");

bc._resetRegistryForTest();
conv._resetConversationsForTest();
auth._resetAccountsForTest();
bc.ensureSeeded();
auth.ensureOwnerAccountsSeeded();

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { console.log("PASS:", msg); pass++; } else { console.error("FAIL:", msg); fail++; } }

// ─── A · Sign/verify roundtrip ─────────────────────────────────────
console.log("\n---------- A · Signed session roundtrip ----------");
const signed = signer.signSession({ role: "customer", businessSlug: "rowan-staircases", customerId: "cust_A", email: "a@example.com" });
assert(typeof signed === "string" && signed.includes("."), "signSession returns dot-separated token");
const verified = signer.verifySession(signed);
assert(verified !== null, "verifySession accepts a fresh signed session");
assert(verified.role === "customer", "verified role preserved");
assert(verified.customerId === "cust_A", "verified customerId preserved");
assert(verified.exp > Math.floor(Date.now() / 1000), "verified exp in the future");

// Tampered token
const tamperedBody = signed.split(".")[0] + "XX." + signed.split(".")[1];
assert(signer.verifySession(tamperedBody) === null, "tampered body rejected");
const tamperedSig = signed.split(".")[0] + "." + signed.split(".")[1].slice(0, -3) + "XXX";
assert(signer.verifySession(tamperedSig) === null, "tampered signature rejected");

// Expired token
const expired = signer.signSession({ role: "customer", businessSlug: "rowan-staircases" }, -60);
assert(signer.verifySession(expired) === null, "expired token rejected");

// ─── B · Customer login → signed cookie → request works ─────────────
console.log("\n---------- B · Customer login flow ----------");
async function callCustomerLogin(slug, body, sessionCookie) {
  const headers = { "content-type": "application/json" };
  if (sessionCookie) headers["cookie"] = `${auth.SESSION_COOKIE_NAME}=${sessionCookie}`;
  const req = new Request(`http://test/api/b/${slug}/customer/login`, { method: "POST", headers, body: JSON.stringify(body) });
  return customerLogin.POST(req, { params: Promise.resolve({ slug }) });
}
const loginRes = await callCustomerLogin("rowan-staircases", { email: "alice@example.com" });
assert(loginRes.status === 200, `customer login returns 200 (got ${loginRes.status})`);
const setCookieHdr = loginRes.headers.get("set-cookie");
assert(!!setCookieHdr && setCookieHdr.startsWith(auth.SESSION_COOKIE_NAME + "="), "set-cookie header includes signed session");
const custCookieValue = setCookieHdr.split(";")[0].split("=").slice(1).join("=");
assert(!!signer.verifySession(custCookieValue), "cookie value verifies");

// Use the cookie to hit the customer message endpoint
async function callCustomerMessageWithCookie(slug, cookie, body) {
  const req = new Request(`http://test/api/b/${slug}/customer/message`, {
    method: "POST",
    headers: { "content-type": "application/json", "cookie": `${auth.SESSION_COOKIE_NAME}=${cookie}` },
    body: JSON.stringify(body)
  });
  const res = await customerMessage.POST(req, { params: Promise.resolve({ slug }) });
  return { status: res.status, json: await res.json() };
}
const msgRes = await callCustomerMessageWithCookie("rowan-staircases", custCookieValue, { text: "hi with real cookie" });
assert(msgRes.status === 200 && msgRes.json.ok === true, `signed-cookie session gets 200 on customer message (got ${msgRes.status})`);
assert(!!msgRes.json.reply, "business reply present");

// ─── C · Bad email rejected, invalid email rejected ─────────────────
console.log("\n---------- C · Login validation ----------");
const badEmail = await callCustomerLogin("rowan-staircases", { email: "not-an-email" });
assert(badEmail.status === 400, `invalid email rejected 400 (got ${badEmail.status})`);
const unknownBiz = await callCustomerLogin("unknown-biz", { email: "x@x.com" });
assert(unknownBiz.status === 404, `unknown business login rejected 404 (got ${unknownBiz.status})`);

// ─── D · Owner login (email must be in owner registry for that business) ─
console.log("\n---------- D · Owner login flow ----------");
async function callOwnerLogin(body) {
  const req = new Request("http://test/api/nex/owner/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return ownerLogin.POST(req);
}
const ownerOk = await callOwnerLogin({ email: "owner@rowanstaircases.co.uk", businessSlug: "rowan-staircases" });
assert(ownerOk.status === 200, `real owner login 200 (got ${ownerOk.status})`);
const ownerCookieHdr = ownerOk.headers.get("set-cookie");
const ownerCookieValue = ownerCookieHdr.split(";")[0].split("=").slice(1).join("=");
const ownerVerified = signer.verifySession(ownerCookieValue);
assert(ownerVerified && ownerVerified.role === "owner", "owner cookie verifies as owner");
assert(ownerVerified.businessSlug === "rowan-staircases", "owner cookie scoped to business");

// Wrong owner for business → 403
const wrongOwner = await callOwnerLogin({ email: "owner@harborne-plumbing.co.uk", businessSlug: "rowan-staircases" });
assert(wrongOwner.status === 403, `wrong owner for business rejected 403 at LOGIN time (got ${wrongOwner.status})`);

// Unknown email → 403
const unknownOwner = await callOwnerLogin({ email: "hacker@example.com", businessSlug: "rowan-staircases" });
assert(unknownOwner.status === 403, `unknown owner email rejected 403 (got ${unknownOwner.status})`);

// ─── E · Owner cookie hits owner endpoint, blocked from customer endpoint, blocked cross-business ─
console.log("\n---------- E · Cross-role + cross-business rejection with REAL sessions ----------");
async function callOwnerConversations(slug, cookie) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = `${auth.SESSION_COOKIE_NAME}=${cookie}`;
  const req = new Request(`http://test/api/b/${slug}/owner/conversations`, { method: "GET", headers });
  const res = await ownerConversations.GET(req, { params: Promise.resolve({ slug }) });
  return { status: res.status, json: await res.json() };
}
async function callCustomerMessage(slug, cookie, body) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers["cookie"] = `${auth.SESSION_COOKIE_NAME}=${cookie}`;
  const req = new Request(`http://test/api/b/${slug}/customer/message`, { method: "POST", headers, body: JSON.stringify(body) });
  const res = await customerMessage.POST(req, { params: Promise.resolve({ slug }) });
  return { status: res.status, json: await res.json() };
}
const ownerOwn = await callOwnerConversations("rowan-staircases", ownerCookieValue);
assert(ownerOwn.status === 200, `real owner cookie sees own business conversations (got ${ownerOwn.status})`);

const ownerHittingCustomer = await callCustomerMessage("rowan-staircases", ownerCookieValue, { text: "as owner" });
assert(ownerHittingCustomer.status === 403, `owner cookie rejected 403 on customer POST (got ${ownerHittingCustomer.status})`);

// Owner tries to see ANOTHER business's owner endpoint · signed cookie says role=owner but businessSlug=rowan
const crossBiz = await callOwnerConversations("harborne-plumbing", ownerCookieValue);
assert(crossBiz.status === 403, `real owner cookie rejected 403 on cross-business (got ${crossBiz.status})`);

// Customer tries owner endpoint
const custHittingOwner = await callOwnerConversations("rowan-staircases", custCookieValue);
assert(custHittingOwner.status === 403, `customer cookie rejected 403 on owner GET (got ${custHittingOwner.status})`);

// Anonymous (no cookie)
const anonOwner = await callOwnerConversations("rowan-staircases", null);
assert(anonOwner.status === 401, `anonymous rejected 401 on owner GET (got ${anonOwner.status})`);

// ─── F · Cookie tampering rejected at API layer ─────────────────────
// Under Phase 18 the customer route accepts anonymous · so we test cookie
// tampering against an OWNER route where anonymous IS rejected. A 401
// there proves the tampered cookie was NOT honoured (it fell through to
// anonymous · anonymous is rejected on owner surface).
console.log("\n---------- F · Cookie tampering ----------");
const tamperedCookie = custCookieValue.slice(0, -3) + "XXX";
const tamperedReq = await callOwnerConversations("rowan-staircases", tamperedCookie);
assert(tamperedReq.status === 401, `tampered cookie treated as anonymous on OWNER surface → 401 (got ${tamperedReq.status})`);

// ─── G · Logout clears session ──────────────────────────────────────
console.log("\n---------- G · Logout ----------");
const logoutRes = await logout.POST();
assert(logoutRes.status === 200, `logout returns 200 (got ${logoutRes.status})`);
const logoutCookie = logoutRes.headers.get("set-cookie");
assert(logoutCookie.includes("Max-Age=0"), "logout cookie has Max-Age=0 (clears browser cookie)");

// ─── H · Prior header-based test path retained for Phase 12 compat ───
console.log("\n---------- H · Test-header path still works when NODE_ENV=test ----------");
const origEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "test";
const testSession = bc.encodeSession({ role: "customer", businessSlug: "rowan-staircases", customerId: "cust_test" });
const testHeaderReq = new Request("http://test/api/b/rowan-staircases/customer/message", {
  method: "POST",
  headers: { "content-type": "application/json", "x-nex-session": testSession },
  body: JSON.stringify({ text: "test header path" })
});
const testHeaderRes = await customerMessage.POST(testHeaderReq, { params: Promise.resolve({ slug: "rowan-staircases" }) });
assert(testHeaderRes.status === 200, `NODE_ENV=test allows unsigned test header (got ${testHeaderRes.status})`);
process.env.NODE_ENV = origEnv;

// And the SAME unsigned header is rejected outside test mode. Under
// Phase 18 the customer route accepts anonymous callers · so to prove
// the forgery invariant we hit an OWNER surface where anonymous IS
// rejected · that way a 200 would only be possible if the fake test
// header was honoured (which would be the security bug we're guarding).
process.env.NODE_ENV = "production";
const audit = await import("../../src/app/api/b/[slug]/owner/nex/audit/route.ts");
const prodReq = new Request("http://test/api/b/rowan-staircases/owner/nex/audit", {
  method: "GET",
  headers: { "x-nex-session": testSession }
});
const prodRes = await audit.GET(prodReq, { params: Promise.resolve({ slug: "rowan-staircases" }) });
assert(prodRes.status === 401, `production env rejects unsigned test header on OWNER surface (got ${prodRes.status}) · CANNOT forge sessions in prod`);
process.env.NODE_ENV = origEnv;

// ─── Summary ─────────────────────────────────────────────────────
console.log("");
console.log("─".repeat(60));
console.log(`Phase 13 · Real auth e2e · ${pass} passed · ${fail} failed`);
console.log("─".repeat(60));
if (fail > 0) process.exit(1);
