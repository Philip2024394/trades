// Inline verification that the System A isolation guard fires as intended.
// Duplicates the exact 6-line guard from scripts/walkers/*.mjs and proves
// both states (fail-closed when unset, pass with substitution when set).

function guard(env) {
  const TAX_URL = env.NEX_TAXONOMY_POSTGRES_URL;
  if (!TAX_URL || TAX_URL.trim().length === 0) {
    return { ok: false, code: "missing-tax-url" };
  }
  const child_env = { ...env, NEX_POSTGRES_URL: TAX_URL };
  return { ok: true, child_NEX_POSTGRES_URL: child_env.NEX_POSTGRES_URL, redacted: TAX_URL.replace(/:[^:@/]+@/, ":****@") };
}

const NEX_PROD_URL = "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres";
const TAX_LOCAL_URL = "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

// Case 1 · production NEX_POSTGRES_URL is present but NEX_TAXONOMY_POSTGRES_URL missing
const r1 = guard({ NEX_POSTGRES_URL: NEX_PROD_URL });
console.log("Case 1 · tax unset:", JSON.stringify(r1));
if (r1.ok) { console.error("FAIL · should have fail-closed"); process.exit(1); }

// Case 2 · both set → child receives the taxonomy URL, prod URL discarded
const r2 = guard({ NEX_POSTGRES_URL: NEX_PROD_URL, NEX_TAXONOMY_POSTGRES_URL: TAX_LOCAL_URL });
console.log("Case 2 · both set:", JSON.stringify(r2));
if (!r2.ok) { console.error("FAIL · should have passed"); process.exit(1); }
if (r2.child_NEX_POSTGRES_URL !== TAX_LOCAL_URL) {
  console.error(`FAIL · substitution did not happen · child got ${r2.child_NEX_POSTGRES_URL}`);
  process.exit(1);
}
if (r2.child_NEX_POSTGRES_URL === NEX_PROD_URL) {
  console.error("FAIL · child still receives PROD URL");
  process.exit(1);
}

// Case 3 · only taxonomy set (no prod URL) → still passes (System A does not need prod URL)
const r3 = guard({ NEX_TAXONOMY_POSTGRES_URL: TAX_LOCAL_URL });
console.log("Case 3 · only tax:", JSON.stringify(r3));
if (!r3.ok || r3.child_NEX_POSTGRES_URL !== TAX_LOCAL_URL) { console.error("FAIL"); process.exit(1); }

// Case 4 · whitespace-only taxonomy URL treated as unset
const r4 = guard({ NEX_TAXONOMY_POSTGRES_URL: "   " });
console.log("Case 4 · whitespace-only:", JSON.stringify(r4));
if (r4.ok) { console.error("FAIL · whitespace-only should fail-closed"); process.exit(1); }

console.log("\nALL PASS · guard fails closed when NEX_TAXONOMY_POSTGRES_URL missing, substitutes correctly when set.");
