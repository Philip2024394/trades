// One-shot inserts a "Back to all tips" link near the top of every
// guide page under src/app/trade-off/tips/<slug>/page.tsx. Idempotent:
// skips a file if the link is already present.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TIPS_DIR = "C:\\Users\\Victus\\trades\\src\\app\\trade-off\\tips";
const MARKER = "Back to all tips";

const BACK_LINK = `        <a
          href="/trade-off/tips"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-neutral-500 transition hover:text-neutral-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to all tips
        </a>
`;

const NEEDLE = `<article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">`;

let touched = 0;
let skipped = 0;
let missed = 0;

for (const entry of readdirSync(TIPS_DIR)) {
  const dir = join(TIPS_DIR, entry);
  if (!statSync(dir).isDirectory()) continue;
  const file = join(dir, "page.tsx");
  let text;
  try {
    text = readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  if (text.includes(MARKER)) {
    skipped++;
    continue;
  }
  if (!text.includes(NEEDLE)) {
    missed++;
    console.log(`! ${entry}: needle not found`);
    continue;
  }
  const updated = text.replace(NEEDLE, `${NEEDLE}\n${BACK_LINK}`);
  writeFileSync(file, updated);
  touched++;
  console.log(`+ ${entry}: link inserted`);
}

console.log(`\nDone. Touched ${touched}. Skipped ${skipped}. Missed ${missed}.`);
