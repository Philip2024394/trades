// Count <img> tags without alt across src/app — multi-line aware.
import fs from "node:fs";
import path from "node:path";

function walk(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (/\.(tsx|jsx)$/.test(f)) files.push(full);
  }
  return files;
}

const files = walk("./src/app");
let total = 0, withAlt = 0;
const missing = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const re = /<img\b/g;
  let m;
  while ((m = re.exec(src))) {
    total++;
    const start = m.index;
    let end = src.indexOf(">", start);
    while (end !== -1) {
      const seg = src.slice(start, end + 1);
      if ((seg.match(/{/g) || []).length === (seg.match(/}/g) || []).length) break;
      end = src.indexOf(">", end + 1);
    }
    if (end === -1) continue;
    const tag = src.slice(start, end + 1);
    if (/\balt\s*=/.test(tag)) withAlt++;
    else {
      const line = src.slice(0, start).split("\n").length;
      missing.push(f.replace(/\\/g, "/") + ":" + line);
    }
  }
}

console.log("Total <img>:", total);
console.log("With alt:", withAlt);
console.log("Missing alt:", total - withAlt);
console.log("---");
const dirs = {};
for (const m of missing) {
  const dir = m.split("/").slice(0, 4).join("/");
  dirs[dir] = (dirs[dir] || 0) + 1;
}
console.log("Missing by top-level dir:");
Object.entries(dirs).sort((a, b) => b[1] - a[1]).forEach(([d, c]) => console.log("  " + d + " — " + c));
console.log("---");
console.log("First 20 missing:");
missing.slice(0, 20).forEach(m => console.log("  " + m));
