#!/usr/bin/env node
// NEX ObjectStorage · reference verification
//
// Round-trips a real object through the ObjectStorage abstraction and
// asserts every layer behaved correctly. Same discipline as
// scripts/verify-storage-pilot.ts but for binary blobs.
//
// USAGE
//   npm run nex:verify-objects
//   (or) npx tsx scripts/verify-object-storage.ts
//
// WHAT IT PROVES
//   · registry picks an object backend without throwing
//   · put() writes bytes + metadata + auto-flips the current pointer
//   · content_hash matches sha256(body) exactly
//   · head() returns metadata without downloading bytes
//   · get() round-trips bytes byte-for-byte
//   · list() surfaces the object under the correct prefix
//   · listVersions() returns each version we wrote
//   · presign() returns a valid URL
//   · soft delete hides the object from get() but leaves versions intact
//   · hard delete removes the whole key
//   · manifest row lands in the record store (nex.object_manifest)
//
// EXIT CODES  0 = all assertions pass  ·  1 = any assertion fails
//
// SAFE TO RUN REPEATEDLY. Each run writes to a unique test key so
// concurrent runs don't collide, and the hard-delete at the end cleans
// up its own bytes.

import { createHash, randomUUID } from "node:crypto";
import { getObjectStorage } from "../src/lib/nex/storage/object-registry";
import { getStorage } from "../src/lib/nex/storage/registry";
import { BUCKETS } from "../src/lib/nex/storage/object-types";
import { COLLECTIONS } from "../src/lib/nex/storage/types";

type Check = { name: string; pass: boolean; detail?: string };

async function main(): Promise<void> {
  const runId = randomUUID();
  const bucket = BUCKETS.uploads;
  const key = `verify-object-storage/${runId}.txt`;
  const bodyText = `NEX object storage verification · run ${runId} · Contract §12`;
  const body = Buffer.from(bodyText, "utf8");
  const expectedHash = createHash("sha256").update(body).digest("hex");

  const objects = getObjectStorage();
  const records = getStorage();

  console.log("── NEX ObjectStorage Verification ──");
  console.log(`  backend       : ${objects.name}`);
  console.log(`  bucket        : ${bucket}`);
  console.log(`  test key      : ${key}`);
  console.log(`  run id        : ${runId}`);
  console.log("");

  const checks: Check[] = [];

  // 1 · put ──────────────────────────────────────────────────────────
  const put = await objects.put(bucket, key, {
    body,
    mime_type: "text/plain",
    uploaded_by: "verify-script",
    business_id: null,
    source_ref: `verify:${runId}`,
    custom: { runId },
  });
  checks.push({
    name: "put() returns bucket + key + version_id + content_hash",
    pass: put.bucket === bucket && put.key === key
      && !!put.version_id && put.content_hash === expectedHash,
    detail: `version_id=${put.version_id} · content_hash=${put.content_hash.slice(0, 12)}...`,
  });

  // 2 · content_hash correctness ────────────────────────────────────
  checks.push({
    name: "content_hash equals sha256(body)",
    pass: put.content_hash === expectedHash,
    detail: `expected ${expectedHash.slice(0, 12)}... · got ${put.content_hash.slice(0, 12)}...`,
  });

  // 3 · head ────────────────────────────────────────────────────────
  const meta = await objects.head(bucket, key);
  checks.push({
    name: "head() returns metadata for the current version",
    pass: !!meta && meta.version_id === put.version_id
      && meta.size_bytes === body.length && meta.mime_type === "text/plain",
    detail: meta ? `size=${meta.size_bytes} mime=${meta.mime_type}` : "<null>",
  });

  // 4 · get round-trip ──────────────────────────────────────────────
  const read = await objects.get(bucket, key);
  const roundTripOk = !!read && read.body.equals(body);
  checks.push({
    name: "get() round-trips bytes byte-for-byte",
    pass: roundTripOk,
    detail: read ? `${read.body.length} bytes returned` : "<null>",
  });

  // 5 · list finds it under prefix ──────────────────────────────────
  const listResult = await objects.list(bucket, "verify-object-storage/", { limit: 100 });
  checks.push({
    name: "list() surfaces the object under its prefix",
    pass: listResult.some((r) => r.key === key && r.version_id === put.version_id),
    detail: `matched ${listResult.filter((r) => r.key === key).length} of ${listResult.length}`,
  });

  // 6 · presign returns a URL ──────────────────────────────────────
  const url = await objects.presign(bucket, key, { operation: "get", expires_seconds: 60 });
  checks.push({
    name: "presign() returns a URL",
    pass: typeof url === "string" && url.length > 0,
    detail: url,
  });

  // 7 · second put creates a new version ────────────────────────────
  const body2 = Buffer.from(`v2 · ${runId}`, "utf8");
  const put2 = await objects.put(bucket, key, { body: body2, mime_type: "text/plain" });
  checks.push({
    name: "second put() creates a new version_id",
    pass: put2.version_id !== put.version_id,
    detail: `v1=${put.version_id} · v2=${put2.version_id}`,
  });

  // 8 · listVersions returns both ─────────────────────────────────
  const versions = await objects.listVersions(bucket, key);
  checks.push({
    name: "listVersions() returns both writes newest-first",
    pass: versions.length >= 2
      && versions[0]!.version_id === put2.version_id
      && versions.some((v) => v.version_id === put.version_id),
    detail: `${versions.length} versions`,
  });

  // 9 · previous version still readable by version_id ─────────────
  const readV1 = await objects.get(bucket, key, put.version_id);
  checks.push({
    name: "get(versionId=v1) still returns original bytes",
    pass: !!readV1 && readV1.body.equals(body),
    detail: readV1 ? `${readV1.body.length} bytes` : "<null>",
  });

  // 10 · soft delete hides current, leaves versions ─────────────────
  await objects.delete(bucket, key);
  const afterSoft = await objects.get(bucket, key);
  const versionsAfterSoft = await objects.listVersions(bucket, key);
  checks.push({
    name: "soft delete hides get() but versions remain",
    pass: afterSoft === null && versionsAfterSoft.length >= 3,   // v1, v2, delete-marker
    detail: `get()=${afterSoft === null ? "null" : "still-present"} · listVersions=${versionsAfterSoft.length}`,
  });

  // 11 · manifest row(s) present in record store ─────────────────
  //     manifest is fire-and-forget · give it a beat before counting.
  await new Promise((r) => setTimeout(r, 250));
  const manifest = await records.query<{ bucket: string; key: string; version_id: string }>(
    COLLECTIONS.object_manifest,
    { where: { key }, limit: 100 },
  );
  checks.push({
    name: "manifest rows landed in the record store",
    pass: manifest.length >= 2,       // at least the two puts
    detail: `${manifest.length} manifest rows found for key`,
  });

  // 12 · hard delete cleans up ───────────────────────────────────
  await objects.delete(bucket, key, { hard: true });
  const versionsAfterHard = await objects.listVersions(bucket, key);
  checks.push({
    name: "hard delete removes all versions",
    pass: versionsAfterHard.length === 0,
    detail: `${versionsAfterHard.length} versions remain (expected 0)`,
  });

  // 13 · Capabilities Layer · every known capability is declared ─────
  //     (Contract §14.4 · verify scripts assert declaration to catch
  //      missing/added capabilities at CI time.)
  const knownCaps = [
    "nativePresign", "nativeVersioning", "imageTransforms", "multipartUpload",
    "presignPost", "lifecycleRules", "serverSideEncryption", "publicUrls",
  ] as const;
  const caps = objects.capabilities;
  const undeclared = knownCaps.filter((k) => typeof caps[k] !== "boolean");
  checks.push({
    name: "capabilities property declares every known ObjectStorageCapability",
    pass: undeclared.length === 0,
    detail: undeclared.length === 0
      ? `${knownCaps.length}/${knownCaps.length} declared · ${knownCaps.filter((k) => caps[k]).join(", ") || "(none true on this backend)"}`
      : `missing: ${undeclared.join(", ")}`,
  });

  report(checks);
}

function report(checks: Check[]): void {
  console.log("");
  console.log("── Results ─────────────────────────────────");
  let failed = 0;
  for (const c of checks) {
    const mark = c.pass ? "✓" : "✗";
    console.log(`  ${mark} ${c.name}`);
    if (c.detail) console.log(`      ${c.detail}`);
    if (!c.pass) failed += 1;
  }
  console.log("");
  if (failed === 0) {
    console.log(`PASS · ${checks.length}/${checks.length} checks green`);
    process.exit(0);
  } else {
    console.log(`FAIL · ${failed} of ${checks.length} checks failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-object-storage] unexpected error:", err);
  process.exit(1);
});
