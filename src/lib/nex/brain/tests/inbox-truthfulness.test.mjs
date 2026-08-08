#!/usr/bin/env node
// inbox-truthfulness.test.mjs · Phase 12.1 + 12.2
//
// Phase 12.1 · dispatchNewInboxItems now writes inbox item status back
// to the filesystem so the "102 dumped" counter drops as items get
// processed. Reconciliation pass heals historical drift where items
// were dispatched before the writeback existed.
//
// Phase 12.2 · Knowledge Factory now has a drawer entry in
// NexSectionsNav so the Warehouse UI is one click from anywhere.
//
// TRANSITIONAL · both writes to the filesystem inbox will be replaced
// by Postgres row updates in Phase 11.2. The behaviour asserted here
// (waiting → processing on dispatch, reconciliation of historical
// drift) must survive that migration.
//
// Assertions:
//   IB1  · manager exports updateInboxItemStatuses helper
//   IB2  · updateInboxItemStatuses is bulk (single file rewrite · not
//          per-item · looks at Map<id, status>)
//   IB3  · dispatch accumulates transitions in a Map before writing
//   IB4  · reconciliation path · items already-in-pipeline flip to
//          "processing" even when they weren't newly enqueued this
//          cycle
//   IB5  · progression path · items newly enqueued this cycle flip
//          to "processing"
//   IB6  · writeback is best-effort · a failure does NOT roll back
//          the WorkerJob that already landed (try/catch present)
//   IB7  · return type includes reconciled_inbox_status counter
//   IB8  · NexSectionsNav imports Factory icon from lucide-react
//   IB9  · NexSectionsNav has "Knowledge Factory" drawer entry
//   IB10 · NexSectionsNav entry links to a valid path
//   IB11 · Existing "Nex Marketing" entry still present (not replaced)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const MANAGER = readFileSync(join(REPO, "src/lib/nex/brain/manager.ts"), "utf8");
const NAV     = readFileSync(join(REPO, "src/components/nex-app/shell/NexSectionsNav.tsx"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// IB1 · helper function exists
record("IB1",
  /async function updateInboxItemStatuses\(updates:\s*Map<string,\s*InboxItemLite\["status"\]>\)/.test(MANAGER),
  "updateInboxItemStatuses(Map) declared");

// IB2 · bulk write · one readFile + one writeFile · no per-item write
const bulkMatch = MANAGER.match(/async function updateInboxItemStatuses[\s\S]*?^}$/m);
const bulkBlock = bulkMatch ? bulkMatch[0] : "";
const oneReadFile  = (bulkBlock.match(/fs\.readFile/g)  ?? []).length === 1;
const oneWriteFile = (bulkBlock.match(/fs\.writeFile/g) ?? []).length === 1;
record("IB2", oneReadFile && oneWriteFile,
  `bulk · readFile_count=${(bulkBlock.match(/fs\.readFile/g) ?? []).length} writeFile_count=${(bulkBlock.match(/fs\.writeFile/g) ?? []).length}`);

// IB3 · Map accumulator inside dispatchNewInboxItems
const usesMap = /const statusUpdates\s*=\s*new Map<string,\s*InboxItemLite\["status"\]>\(\)/.test(MANAGER);
record("IB3", usesMap, "dispatch accumulates status updates in a Map");

// IB4 · reconciliation path · items in alreadyQueuedIds get "processing"
const reconciliationSet = /if\s*\(\s*alreadyQueuedIds\.has\(item\.id\)\s*\)\s*\{[\s\S]{0,300}?statusUpdates\.set\(item\.id,\s*"processing"\)/.test(MANAGER);
record("IB4", reconciliationSet, "reconciliation path assigns processing for already-queued items");

// IB5 · progression path · newly enqueued items get "processing"
const progressionSet = /await store\.enqueueJob\([\s\S]*?enqueued\s*\+=\s*1;[\s\S]{0,600}?statusUpdates\.set\(item\.id,\s*"processing"\)/.test(MANAGER);
record("IB5", progressionSet, "progression path assigns processing after enqueue");

// IB6 · writeback wrapped in try/catch · never throws to caller
const bulkGuarded = /if\s*\(\s*statusUpdates\.size\s*>\s*0\s*\)\s*\{[\s\S]{0,300}?try\s*\{[\s\S]{0,300}?updateInboxItemStatuses\(statusUpdates\)/.test(MANAGER)
                 && /console\.warn\("\[manager\] inbox bulk writeback failed/.test(MANAGER);
record("IB6", bulkGuarded, "writeback guarded by try/catch · warns on failure");

// IB7 · return type includes reconciled_inbox_status
const returnTypeExtended = /reconciled_inbox_status:\s*number;\s*\/\/\s*Phase 12\.1/.test(MANAGER)
                        && /reconciled_inbox_status,?\s*\}?;?\s*\}/.test(MANAGER);
record("IB7", returnTypeExtended, "dispatch return type includes reconciled_inbox_status");

// IB8 · Factory icon imported
record("IB8", /import[\s\S]*?Factory[\s\S]*?from ["']lucide-react["']/.test(NAV),
  "Factory icon imported from lucide-react");

// IB9 · Knowledge Factory drawer entry
const factoryEntry = /label:\s*"Knowledge Factory"[\s\S]{0,200}?icon:\s*Factory/.test(NAV);
record("IB9", factoryEntry, "Knowledge Factory drawer entry present");

// IB10 · entry links to a nex-brain path (operations-centre until 12.4 flips)
const factoryHref = /href:\s*"\/nex-app\/nex-brain\/[a-z0-9-]+"[\s\S]{0,120}?label:\s*"Knowledge Factory"/.test(NAV);
record("IB10", factoryHref, "Knowledge Factory href points into /nex-app/nex-brain/");

// IB11 · existing Nex Marketing entry untouched
record("IB11", /label:\s*"Nex Marketing"/.test(NAV),
  "Nex Marketing entry preserved");

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\ninbox-truthfulness: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
