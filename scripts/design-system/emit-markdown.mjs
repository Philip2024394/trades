// NEX Design System Finalisation · markdown mirror (Philip 2026-08-14).
//
// Emits docs/NEX_SECTION_INVENTORY_2026_08_14.md — the review document
// mirroring the live inventory page. Embeds the desktop screenshot of
// each section for git-history review + offline reading.
//
// Consumes:
//   data/design-system/section-inventory.json
//   data/design-system/family-assignments.json
//   tmp-nex-qa-screenshots/design-inventory/{library}/{id}__desktop.png
//
// Do not redesign. This is a mirror of the current library.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const INV = JSON.parse(readFileSync(join(ROOT, "data", "design-system", "section-inventory.json"), "utf8"));
const FAM = JSON.parse(readFileSync(join(ROOT, "data", "design-system", "family-assignments.json"), "utf8"));

const familyByRegId = new Map(FAM.assignments.map((a) => [a.id, a.family]));
const bombs = new Set(INV.latentSsrBombs);

// Preserve declaration order for families; group sections into buckets.
const grouped = new Map();
for (const f of FAM.families) grouped.set(f.name, []);
for (const s of INV.inventory) {
  const family = familyByRegId.get(s.id) ?? "Uncategorised";
  if (!grouped.has(family)) grouped.set(family, []);
  grouped.get(family).push(s);
}

const lines = [];
lines.push(`# NEX Section Inventory · 2026-08-14`);
lines.push(``);
lines.push(`_Design System Finalisation · audit reflecting the library as-is. No section has been redesigned or added during this audit._`);
lines.push(``);
lines.push(`- **Total registered sections**: ${INV.totalSections}`);
lines.push(`- **Libraries**: ${Object.keys(INV.byLibrary).length}`);
lines.push(`- **Proposed design families**: ${FAM.families.length}`);
lines.push(`- **Latent SSR-unsafe sections** (no \`.meta.ts\` sidecar): **${INV.latentSsrBombs.length}** (see Phase 19D — these render a different section in SSR than in standalone tsx via the library-fallback path)`);
lines.push(`- **Enumeration timestamp**: ${INV.ranAt}`);
lines.push(``);
lines.push(`Live review surface: [\`/nex-app/design-system/inventory\`](http://localhost:3008/nex-app/design-system/inventory) (dev-only)`);
lines.push(``);
lines.push(`---`);
lines.push(``);
lines.push(`## Proposed families`);
lines.push(``);
for (const f of FAM.families) {
  lines.push(`- **${f.name}** (${grouped.get(f.name)?.length ?? 0}) — ${f.description}`);
}
lines.push(``);
lines.push(`> ⚠ Family assignments are a proposal derived from existing metadata (telemetryTags, section id, library). Owner approves/renames/re-tags. Sections marked _Uncategorised_ need a decision.`);
lines.push(``);
lines.push(`---`);
lines.push(``);

for (const [familyName, sections] of grouped.entries()) {
  const familyMeta = FAM.families.find((f) => f.name === familyName);
  lines.push(`## ${familyName} · ${sections.length} section${sections.length === 1 ? "" : "s"}`);
  lines.push(``);
  if (familyMeta?.description) {
    lines.push(`> ${familyMeta.description}`);
    lines.push(``);
  }

  for (const s of sections) {
    const desktopShot = `tmp-nex-qa-screenshots/design-inventory/${s.library}/${s.id}__desktop.png`;
    const mobileShot  = `tmp-nex-qa-screenshots/design-inventory/${s.library}/${s.id}__mobile.png`;
    const hasDesktop  = existsSync(join(ROOT, desktopShot));
    const hasMobile   = existsSync(join(ROOT, mobileShot));

    lines.push(`### \`${s.id}\` · ${s.name}`);
    lines.push(``);
    if (s.description) { lines.push(s.description); lines.push(``); }

    const badges = [];
    badges.push(s.hasMetaSidecar ? "`.meta ✓`" : (s.rendererIsClient ? "**⚠ SSR-unsafe**" : "server-safe"));
    badges.push(`${s.editableFieldCount} editable fields`);
    if (s.aiPromptableFieldCount > 0) badges.push(`${s.aiPromptableFieldCount} AI-promptable`);
    if (s.imagePlaceholderCount > 0) badges.push(`${s.imagePlaceholderCount} image slot${s.imagePlaceholderCount === 1 ? "" : "s"}`);
    lines.push(`_${badges.join(" · ")}_`);
    lines.push(``);

    if (hasDesktop) {
      lines.push(`![${s.name} · desktop](${desktopShot})`);
      lines.push(``);
    }
    if (hasMobile) {
      lines.push(`<details><summary>Mobile screenshot (390×844)</summary>\n\n![${s.name} · mobile](${mobileShot})\n\n</details>`);
      lines.push(``);
    }

    lines.push(`| Field | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Library | \`${s.library}\` |`);
    lines.push(`| Version | ${s.version ?? "—"} |`);
    lines.push(`| Source | \`${s.sourceFile}\` |`);
    if (s.category) lines.push(`| Category | ${s.category} |`);
    if (s.supportedThemes.length) lines.push(`| Themes | ${s.supportedThemes.join(", ")} |`);
    const industries = s.supportedIndustries.length ? s.supportedIndustries.slice(0, 8) : s.bestForVerticals.slice(0, 8);
    if (industries.length) lines.push(`| Best-for | ${industries.join(", ")}${industries.length < (s.supportedIndustries.length || s.bestForVerticals.length) ? " …" : ""} |`);
    if (s.responsiveBehaviour) lines.push(`| Responsive | ${Object.entries(s.responsiveBehaviour).map(([k, v]) => `${k}: ${v}`).join(" · ")} |`);
    if (s.telemetryTags.length) lines.push(`| Telemetry tags | ${s.telemetryTags.slice(0, 12).map((t) => "`" + t + "`").join(" ")} |`);
    lines.push(`| Editable field keys | ${s.editableFieldKeys.slice(0, 12).map((k) => "`" + k + "`").join(" · ") || "—"} |`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }
}

// Appendix — the SSR-unsafe list, useful for the follow-up hardening phase.
lines.push(`## Appendix · Latent SSR-unsafe sections (${INV.latentSsrBombs.length})`);
lines.push(``);
lines.push(`Every section here has a \`"use client"\` renderer with a module-scope \`sectionRegistry.register(...)\` and no \`.meta.ts\` sidecar. When Next.js SSR imports the sections barrel, these registrations do NOT run — the SSR catalog misses them. Any Blueprint that references one of these ids resolves via library-fallback (renders a different section) or fails validation entirely.`);
lines.push(``);
lines.push(`Fix pattern (Phase 19D · applied to \`productShowroom\` and \`splitPhotoLeft\`): create \`<section>.meta.ts\` next to the \`.tsx\`, move the \`SectionRegistration\` object into it, import the renderer from the sibling \`.tsx\`, and add the meta to \`src/lib/studio/sections/index.ts\`.`);
lines.push(``);
for (const id of INV.latentSsrBombs) lines.push(`- \`${id}\``);
lines.push(``);

const outPath = join(ROOT, "docs", "NEX_SECTION_INVENTORY_2026_08_14.md");
writeFileSync(outPath, lines.join("\n"));
console.log(`wrote ${relative(ROOT, outPath).replaceAll("\\", "/")}`);
console.log(`  ${lines.length} lines · ${INV.totalSections} sections across ${FAM.families.length} families`);
