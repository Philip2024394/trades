// Search-path matrix test for Slice 4.1 v2 OID-based CHECK-constraint postflight.
// Proves the assertion is display-independent under all three relevant search_path
// shapes: portable · Project B default · hardened SECDEF.
// READ-ONLY against portable cluster · NO Project B contact.

import pg from "pg";

const ASSERTION = `
DO $body$
DECLARE
  v_constraint_oid oid;
  v_digest_count   integer;
  v_digest_schema  text;
  v_digest_args    text;
BEGIN
  SELECT oid INTO v_constraint_oid FROM pg_constraint
   WHERE conname='evidence_id_consistency' AND conrelid='nex_workforce.evidence_record'::regclass;
  IF v_constraint_oid IS NULL THEN
    RAISE EXCEPTION 'Slice 4.1 postflight FAILED · constraint missing';
  END IF;
  SELECT count(*) INTO v_digest_count FROM pg_depend d JOIN pg_proc p ON p.oid=d.refobjid
   WHERE d.classid='pg_constraint'::regclass AND d.objid=v_constraint_oid
     AND d.refclassid='pg_proc'::regclass AND p.proname='digest';
  IF v_digest_count = 0 THEN RAISE EXCEPTION 'ZERO digest dependencies'; END IF;
  IF v_digest_count > 1 THEN RAISE EXCEPTION '% digest dependencies (expected 1)', v_digest_count; END IF;
  SELECT n.nspname, pg_get_function_identity_arguments(p.oid) INTO v_digest_schema, v_digest_args
    FROM pg_depend d JOIN pg_proc p ON p.oid=d.refobjid JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE d.classid='pg_constraint'::regclass AND d.objid=v_constraint_oid
     AND d.refclassid='pg_proc'::regclass AND p.proname='digest';
  IF v_digest_schema <> 'extensions' THEN
    RAISE EXCEPTION 'schema is % (expected extensions)', v_digest_schema;
  END IF;
  IF v_digest_args <> 'text, text' THEN
    RAISE EXCEPTION 'signature is % (expected text, text)', v_digest_args;
  END IF;
  RAISE NOTICE 'OID-based check PASSED · schema=% args=%', v_digest_schema, v_digest_args;
END $body$;
`;

async function test(label, spSql) {
  const c = new pg.Client({ host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" });
  await c.connect();
  const notices = [];
  c.on("notice", (n) => notices.push(n.message));
  await c.query(`SET search_path TO ${spSql}`);
  const spNow = (await c.query("SHOW search_path")).rows[0].search_path;
  let verdict = "PASS";
  let err = "";
  try {
    await c.query(ASSERTION);
  } catch (e) {
    verdict = "FAIL";
    err = e.message;
  }
  await c.end();
  const status = verdict === "PASS" ? "✅" : "❌";
  console.log(`${status} ${label} [search_path = ${spNow}]`);
  if (notices.length) for (const n of notices) console.log(`     ${n}`);
  if (err) console.log(`     ERROR: ${err}`);
  return verdict === "PASS";
}

const results = [];
results.push(await test("A. Portable                 ", `"$user", public`));
results.push(await test("B. Project B default (sim)  ", `"$user", public, extensions`));
results.push(await test("C. Hardened SECDEF          ", `pg_catalog, pg_temp`));

console.log("\n─── Matrix summary ───");
console.log(`A (portable)                 · ${results[0] ? "PASS" : "FAIL"}`);
console.log(`B (Project B default sim)    · ${results[1] ? "PASS" : "FAIL"}`);
console.log(`C (hardened SECDEF)          · ${results[2] ? "PASS" : "FAIL"}`);

if (results.every(x => x)) {
  console.log("\n🟢 OID-based assertion is display-INDEPENDENT · all 3 shapes PASS");
  process.exit(0);
} else {
  console.log("\n🔴 Search-path matrix has failures · assertion is not display-independent");
  process.exit(1);
}
