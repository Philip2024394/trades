#!/usr/bin/env node
// redact.test.mjs · E9 · contract tests for redactSensitiveData

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

async function loadTs(relPath, exports) {
  const src = readFileSync(join(REPO, relPath), "utf8");
  const stripped = src.replace(/^export\s+/gm, "");
  const t = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  new Function("module", "process", "exports", "require",
    t.code + `\nmodule.exports = { ${exports.join(", ")} };`,
  )(mod, process, mod.exports, () => ({}));
  return mod.exports;
}

const { redactSensitiveData } = await loadTs(
  "src/lib/nex/observability/redact.ts",
  ["redactSensitiveData"],
);

test("R1 · primitives pass through unchanged", () => {
  assert.equal(redactSensitiveData("hello"), "hello");
  assert.equal(redactSensitiveData(42), 42);
  assert.equal(redactSensitiveData(true), true);
  assert.equal(redactSensitiveData(null), null);
  assert.equal(redactSensitiveData(undefined), undefined);
});

test("R2 · redacts top-level sensitive keys", () => {
  const input  = { email: "a@b.com", phone: "+441234", name: "Phil", other: 1 };
  const output = redactSensitiveData(input);
  assert.equal(output.email, "[REDACTED]");
  assert.equal(output.phone, "[REDACTED]");
  assert.equal(output.name,  "Phil");
  assert.equal(output.other, 1);
});

test("R3 · redacts nested sensitive keys", () => {
  const input = { outer: { inner: { api_key: "k123", label: "safe" } } };
  const output = redactSensitiveData(input);
  assert.equal(output.outer.inner.api_key, "[REDACTED]");
  assert.equal(output.outer.inner.label,   "safe");
});

test("R4 · redacts through arrays", () => {
  const input  = [{ token: "t1" }, { safe: "v" }];
  const output = redactSensitiveData(input);
  assert.equal(output[0].token, "[REDACTED]");
  assert.equal(output[1].safe,  "v");
});

test("R5 · case-insensitive key matching", () => {
  const input  = { EMAIL: "x", Authorization: "y", apiKey: "z" };
  const output = redactSensitiveData(input);
  assert.equal(output.EMAIL,         "[REDACTED]");
  assert.equal(output.Authorization, "[REDACTED]");
  assert.equal(output.apiKey,        "[REDACTED]");
});

test("R6 · preserves shape and does not mutate input", () => {
  const input  = { safe: 1, secret: "hidden", nested: { safe: 2, password: "p" } };
  const output = redactSensitiveData(input);
  assert.equal(input.secret, "hidden"); // original unchanged
  assert.equal(input.nested.password, "p");
  assert.equal(output.safe, 1);
  assert.equal(output.secret, "[REDACTED]");
  assert.equal(output.nested.safe, 2);
  assert.equal(output.nested.password, "[REDACTED]");
});

test("R7 · handles stripe-prefixed keys and refresh/access tokens", () => {
  const input = {
    stripe_secret_key:  "sk_live_x",
    stripe_public_key:  "pk_live_x",
    refresh_token:      "r1",
    access_token:       "a1",
    private_key:        "pem-data",
    service_role_key:   "jwt",
    jwt:                "abc.def.ghi",
    cookie:             "session=abc",
    session:            "s1",
  };
  const output = redactSensitiveData(input);
  for (const k of Object.keys(input)) {
    assert.equal(output[k], "[REDACTED]", `expected ${k} redacted`);
  }
});
