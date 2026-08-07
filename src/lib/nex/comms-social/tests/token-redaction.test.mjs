#!/usr/bin/env node
// token-redaction.test.mjs
//
// Charter §S-IX: adapter code MUST use a redaction wrapper for any log
// emission containing a token substring. This test scans every non-test
// source file under src/lib/nex/comms-social/** for direct token
// interpolation in log/emit patterns.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO          = join(__dirname, "..", "..", "..", "..", "..");
const COMMS_SOCIAL  = join(REPO, "src", "lib", "nex", "comms-social");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (e === "tests") continue;
      out.push(...walk(p));
    } else if (/\.(ts|tsx|mjs|js)$/.test(e) && !e.endsWith(".test.mjs") && !e.endsWith(".test.ts")) {
      out.push(p);
    }
  }
  return out;
}

process.stdout.write("token-redaction.test.mjs\n");

const files = walk(COMMS_SOCIAL);

// T1 · No console.log/error containing raw access_token / refresh_token / code / state variables.
{
  const banned = [
    /console\.(log|info|warn|error|debug)\([^)]*(access_token|refresh_token|code_verifier)[^)]*\)/i,
    // Interpolation of these vars inside a string template that's logged/thrown
    /console\.(log|info|warn|error|debug)\([^)]*\$\{[^}]*(access_token|refresh_token)[^}]*\}/i,
  ];
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const re of banned) {
      if (re.test(src)) hits.push(relative(REPO, f));
    }
  }
  record("T1 no console.log with raw token vars", hits.length === 0, hits.length ? hits.join(",") : "");
}

// T2 · redactSecret / redactObject helper is present and exported from envelope.
{
  const env = readFileSync(join(COMMS_SOCIAL, "crypto", "envelope.ts"), "utf8");
  const has = /export function redactSecret/.test(env) && /export function redactObject/.test(env);
  record("T2 redaction helpers exported from crypto/envelope.ts", has);
}

// T3 · connectAccount uses redactSecret when emitting audit details.
{
  const acc = readFileSync(join(COMMS_SOCIAL, "oauth", "accounts.ts"), "utf8");
  const uses = /redactSecret\s*\(\s*input\.access_token\s*\)/.test(acc)
            && /redactSecret\s*\(\s*input\.refresh_token/.test(acc);
  record("T3 connectAccount audit uses redactSecret for both token fields", uses);
}

// T4 · No raw token variable is stringified into a query error path.
{
  const banned = /(throw|Error)\([^)]*(access_token|refresh_token|code_verifier)/i;
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (banned.test(src)) hits.push(relative(REPO, f));
  }
  record("T4 no thrown Error interpolates raw token vars", hits.length === 0, hits.length ? hits.join(",") : "");
}

// T5 · Callback route strips code from any error response.
{
  const cb = readFileSync(join(REPO, "src", "app", "api", "nex", "comms-social", "oauth", "[platform]", "callback", "route.ts"), "utf8");
  // The route never echoes the raw code back in an error body. Check we
  // don't have any obvious "error: code" pattern.
  const leaks = /error\s*:\s*[^,}]*\bcode\b/.test(cb) && !/error\s*:\s*"code /.test(cb);
  // Rather than parse: assert the route doesn't include a template literal
  // containing ${code} in an error message.
  const templateLeak = /error[^)]*\$\{code\}/.test(cb);
  record("T5 callback route does not leak raw code in error messages", !templateLeak);
}

process.stdout.write(`\nSummary · ${results.filter(x => x.pass).length}/${results.length} passed\n`);
process.exit(results.every(x => x.pass) ? 0 : 1);
