#!/usr/bin/env node
// run-all.mjs · Phase 0 test aggregator.
//
// Runs every Phase 0 boundary test in sequence, prints a summary, and
// exits non-zero if any suite fails. Intended for CI + manual `node`.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const suites = [
  { name: "tenant-isolation",     path: join(__dirname, "tenant-isolation.test.mjs")     },
  { name: "adapter-isolation",    path: join(__dirname, "adapter-isolation.test.mjs")    },
  { name: "predictive-boundary",  path: join(__dirname, "predictive-boundary.test.mjs")  },
  { name: "role-permission",      path: join(__dirname, "role-permission.test.mjs")      },
  { name: "envelope-encryption",  path: join(__dirname, "envelope-encryption.test.mjs")  },
  { name: "oauth-state",          path: join(__dirname, "oauth-state.test.mjs")          },
  { name: "token-redaction",      path: join(__dirname, "token-redaction.test.mjs")      },
  { name: "oauth-e2e",            path: join(__dirname, "oauth-e2e.test.mjs")            },
  { name: "content-sources",      path: join(__dirname, "content-sources.test.mjs")      },
  { name: "claim-taxonomy",       path: join(__dirname, "claim-taxonomy.test.mjs")       },
  { name: "template-fill",        path: join(__dirname, "template-fill.test.mjs")        },
  { name: "grounding-validation", path: join(__dirname, "grounding-validation.test.mjs") },
  { name: "generation-e2e",       path: join(__dirname, "generation-e2e.test.mjs")       },
  { name: "validator-fact",       path: join(__dirname, "validator-fact.test.mjs")       },
  { name: "validator-rights",     path: join(__dirname, "validator-rights.test.mjs")     },
  { name: "validator-policy",     path: join(__dirname, "validator-policy.test.mjs")     },
  { name: "validator-brand",      path: join(__dirname, "validator-brand.test.mjs")      },
  { name: "validator-platform",   path: join(__dirname, "validator-platform.test.mjs")   },
  { name: "validator-pipeline",   path: join(__dirname, "validator-pipeline.test.mjs")   },
  { name: "category-automation",  path: join(__dirname, "category-automation.test.mjs")  },
  { name: "scheduling-worker",    path: join(__dirname, "scheduling-worker.test.mjs")    },
  { name: "pause-propagation",    path: join(__dirname, "pause-propagation.test.mjs")    },
  { name: "adapter-real-providers", path: join(__dirname, "adapter-real-providers.test.mjs") },
  { name: "adapter-meta-live",      path: join(__dirname, "adapter-meta-live.test.mjs")      },
  { name: "ui-boundaries",          path: join(__dirname, "ui-boundaries.test.mjs")          },
  { name: "hq-mission-control",     path: join(__dirname, "hq-mission-control.test.mjs")     },
  { name: "attribution-integration", path: join(__dirname, "attribution-integration.test.mjs") },
  { name: "adversarial-probes",     path: join(__dirname, "adversarial-probes.test.mjs")     },
  { name: "customer-entry",         path: join(__dirname, "customer-entry.test.mjs")         },
];

const results = [];
for (const s of suites) {
  process.stdout.write(`\n════════ ${s.name} ════════\n`);
  const r = spawnSync("node", [s.path], { stdio: "inherit", env: process.env });
  results.push({ name: s.name, code: r.status ?? 1 });
}

process.stdout.write("\n════════ SUMMARY ════════\n");
for (const r of results) {
  const tag = r.code === 0 ? "PASS" : "FAIL";
  process.stdout.write(`  ${tag} ${r.name} · exit ${r.code}\n`);
}
const failed = results.filter((r) => r.code !== 0);
process.exit(failed.length === 0 ? 0 : 1);
