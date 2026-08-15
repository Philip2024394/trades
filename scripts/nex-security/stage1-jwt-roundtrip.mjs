// NEX App Builder · Stage 1 verification (Philip 2026-08-14).
//
// Proves the ES256 JWT roundtrip works locally BEFORE any Supabase or
// production integration:
//   1. Load private JWK from env; import
//   2. Load public JWK from env; import
//   3. Sign a merchant-scoped JWT with the private key
//   4. Verify it with the public key
//   5. Assert claims are correct
//
// Prints only assertions (never keys, never full tokens).
// Exit code 0 = all assertions pass. Non-zero = fail.

import { readFileSync } from "node:fs";
import { SignJWT, jwtVerify, importJWK } from "jose";

// Read .env.local manually (no dotenv dep) — get NEX_JWT_* only.
function readEnvLocal() {
  const raw = readFileSync(".env.local", "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2];
  }
  return out;
}
const env = readEnvLocal();
const privRaw = env.NEX_JWT_PRIVATE_KEY_JWK;
const pubRaw  = env.NEX_JWT_PUBLIC_KEY_JWK;
if (!privRaw) { console.error("FAIL: NEX_JWT_PRIVATE_KEY_JWK missing"); process.exit(1); }
if (!pubRaw)  { console.error("FAIL: NEX_JWT_PUBLIC_KEY_JWK missing");  process.exit(1); }

const privJwk = JSON.parse(privRaw);
const pubJwk  = JSON.parse(pubRaw);

// Sanity assertions on shape (never print values)
function assert(cond, msg) { if (!cond) { console.error("FAIL:", msg); process.exit(1); } console.log("PASS:", msg); }

assert(privJwk.kty === "EC",           "private JWK kty=EC");
assert(privJwk.crv === "P-256",        "private JWK crv=P-256");
assert(privJwk.alg === "ES256",        "private JWK alg=ES256");
assert(typeof privJwk.d === "string" && privJwk.d.length > 0, "private JWK has non-empty d");
assert(typeof privJwk.kid === "string" && privJwk.kid.length > 0, "private JWK has kid");
assert(pubJwk.kty === "EC",            "public JWK kty=EC");
assert(pubJwk.crv === "P-256",         "public JWK crv=P-256");
assert(pubJwk.alg === "ES256",         "public JWK alg=ES256");
assert(pubJwk.d === undefined,         "public JWK MUST NOT contain private scalar d");
assert(pubJwk.kid === privJwk.kid,     "public and private JWKs share the same kid");
assert(pubJwk.x === privJwk.x && pubJwk.y === privJwk.y, "public JWK matches private JWK point");

// Import keys
const privateKey = await importJWK(privJwk, "ES256");
const publicKey  = await importJWK(pubJwk,  "ES256");
assert(!!privateKey, "private key imported");
assert(!!publicKey,  "public key imported");

// Sign a test JWT
const testMerchantId = "11111111-1111-1111-1111-111111111111";
const now = Math.floor(Date.now() / 1000);
const jwt = await new SignJWT({ merchant_id: testMerchantId, role: "authenticated" })
  .setProtectedHeader({ alg: "ES256", kid: privJwk.kid, typ: "JWT" })
  .setIssuer("https://thenetworkers.app")
  .setSubject(testMerchantId)
  .setAudience("authenticated")
  .setIssuedAt(now)
  .setExpirationTime(now + 60)
  .sign(privateKey);
assert(typeof jwt === "string" && jwt.split(".").length === 3, "signed JWT is a valid three-part string");
assert(jwt.length > 100 && jwt.length < 2000, "signed JWT length is sane (not empty, not enormous)");

// Verify with public key
const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, {
  issuer: "https://thenetworkers.app",
  audience: "authenticated"
});
assert(protectedHeader.alg === "ES256",       "verified header alg=ES256");
assert(protectedHeader.kid === privJwk.kid,   "verified header kid matches");
assert(payload.merchant_id === testMerchantId, "verified payload merchant_id matches");
assert(payload.role === "authenticated",       "verified payload role=authenticated");
assert(payload.sub === testMerchantId,         "verified payload sub matches");
assert(payload.iss === "https://thenetworkers.app", "verified payload issuer matches");
assert(typeof payload.exp === "number" && payload.exp > now, "exp is in the future");

// Negative test: tampered token must fail verification
const tampered = jwt.split(".");
tampered[1] = Buffer.from(JSON.stringify({ ...payload, merchant_id: "22222222-2222-2222-2222-222222222222" })).toString("base64url");
const tamperedJwt = tampered.join(".");
let tamperedFailed = false;
try {
  await jwtVerify(tamperedJwt, publicKey, { issuer: "https://thenetworkers.app", audience: "authenticated" });
} catch { tamperedFailed = true; }
assert(tamperedFailed, "tampered JWT correctly rejected by public-key verify");

// Negative test: verify against WRONG audience must fail
let wrongAudFailed = false;
try {
  await jwtVerify(jwt, publicKey, { issuer: "https://thenetworkers.app", audience: "wrong" });
} catch { wrongAudFailed = true; }
assert(wrongAudFailed, "wrong-audience verify correctly rejected");

console.log("");
console.log("Stage 1 · JWT roundtrip: ALL ASSERTIONS PASSED");
