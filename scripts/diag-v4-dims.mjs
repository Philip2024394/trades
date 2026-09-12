import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);
if (!process.env.NEX_DIAG_INNER) {
  const child = spawn("npx", ["tsx", entryFile], { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, NEX_DIAG_INNER: "1" } });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  const { NEX_L4_CORPUS_V4 } = await import("../src/lib/nex/l4-bakeoff/corpus-nex-l4-v4.ts");
  const dims = {};
  for (const c of NEX_L4_CORPUS_V4.cases) {
    dims[c.dimension] = (dims[c.dimension] ?? 0) + 1;
  }
  console.log("V4 dimensions:");
  for (const [dim, cnt] of Object.entries(dims).sort()) {
    console.log(`  ${cnt.toString().padStart(3)} · ${dim}`);
  }
  console.log(`total cases: ${NEX_L4_CORPUS_V4.cases.length}`);
}
