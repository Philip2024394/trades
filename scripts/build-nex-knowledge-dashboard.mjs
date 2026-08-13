#!/usr/bin/env node
// Nex Knowledge Dashboard generator.
//
// Doctrine: docs/brains/nex-domain-quality-dashboard-philip-2026-08-03.md
// Usage: node scripts/build-nex-knowledge-dashboard.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[1], "..", "..");
const KNOWLEDGE_ROOT = path.join(ROOT, "data", "nex-knowledge");
const IMAGE_MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");
const OUT = path.join(ROOT, "data", "nex-reference-brains", "staircase-preparation", "NEX-KNOWLEDGE-DASHBOARD.html");

function parseYamlMinimal(raw) {
  const out = {};
  const lines = raw.split("\n");
  let currentBlockKey = null;
  let currentBlock = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const scalarMatch = line.match(/^([a-z_][a-z_0-9]*)\s*:\s*(.+?)$/i);
    if (scalarMatch && !line.startsWith(" ")) {
      const [, key, value] = scalarMatch;
      const cleaned = value.trim().replace(/^["']|["']$/g, "");
      out[key] = cleaned === "" ? null : cleaned;
      currentBlockKey = null;
      continue;
    }
    const blockMatch = line.match(/^([a-z_][a-z_0-9]*)\s*:\s*$/i);
    if (blockMatch && !line.startsWith(" ")) {
      currentBlockKey = blockMatch[1];
      currentBlock = {};
      out[currentBlockKey] = currentBlock;
      continue;
    }
    if (line.startsWith("  ") && currentBlock) {
      const nested = line.trim().match(/^([a-z_][a-z_0-9]*)\s*:\s*(.+?)$/i);
      if (nested) {
        const [, k, v] = nested;
        const cleaned = v.trim().replace(/^["']|["']$/g, "");
        const numeric = Number(cleaned);
        currentBlock[k] = Number.isNaN(numeric) ? cleaned : numeric;
      }
    }
  }
  return out;
}

function readKnowledgeYaml(domain) {
  const p = path.join(KNOWLEDGE_ROOT, domain, "knowledge.yaml");
  if (!fs.existsSync(p)) return null;
  return parseYamlMinimal(fs.readFileSync(p, "utf8"));
}

function countFiles(dir, extensions) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => extensions.some((ext) => f.endsWith(ext))).length;
}

function countJsonlLines(file) {
  if (!fs.existsSync(file)) return 0;
  return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim()).length;
}

function listDomains() {
  if (!fs.existsSync(KNOWLEDGE_ROOT)) return [];
  return fs.readdirSync(KNOWLEDGE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name).sort();
}

function listSharedBrains() {
  const sharedRoot = path.join(KNOWLEDGE_ROOT, "_shared");
  if (!fs.existsSync(sharedRoot)) return [];
  return fs.readdirSync(sharedRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

function analyseManifest() {
  if (!fs.existsSync(IMAGE_MANIFEST)) return { total: 0, byDomain: {}, aPlusByDomain: {}, marketingBanners: 0 };
  const parsed = JSON.parse(fs.readFileSync(IMAGE_MANIFEST, "utf8"));
  const images = parsed.images ?? {};
  const byDomain = {};
  const aPlusByDomain = {};
  let marketingBanners = 0;
  for (const meta of Object.values(images)) {
    const domain = meta.subject_domain ?? "unknown";
    byDomain[domain] = (byDomain[domain] ?? 0) + 1;
    if (meta.a_plus === true) aPlusByDomain[domain] = (aPlusByDomain[domain] ?? 0) + 1;
    if (domain === "marketing_banner") marketingBanners++;
  }
  return { total: Object.keys(images).length, byDomain, aPlusByDomain, marketingBanners };
}

function analyseLearningLog() {
  if (!fs.existsSync(LEARNING_LOG)) return { total: 0, needsClarification: 0, avgConfidence: 0 };
  const rows = fs.readFileSync(LEARNING_LOG, "utf8").split("\n").filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  const total = rows.length;
  const needsClarification = rows.filter((r) => r.needs_clarification === true).length;
  const confidenceSum = rows.reduce((s, r) => s + (r.overall_confidence ?? 0), 0);
  const avgConfidence = total ? confidenceSum / total : 0;
  return { total, needsClarification, avgConfidence };
}

function buildDomainRows() {
  const domains = listDomains();
  const manifest = analyseManifest();
  const rows = [];
  for (const domain of domains) {
    const yaml = readKnowledgeYaml(domain);
    if (!yaml) continue;
    const articlesDir = path.join(KNOWLEDGE_ROOT, domain, "articles");
    const articleCount = countFiles(articlesDir, [".md"]);
    const faqPath = path.join(KNOWLEDGE_ROOT, domain, "faqs.jsonl");
    const modernFaqCount = countJsonlLines(faqPath);
    const legacyFaqPath = path.join(ROOT, "knowledge", `${domain}.json`);
    const legacyFaqCount = fs.existsSync(legacyFaqPath) ? (() => {
      try { return JSON.parse(fs.readFileSync(legacyFaqPath, "utf8")).length ?? 0; } catch { return 0; }
    })() : 0;
    const faqCount = modernFaqCount > 0 ? modernFaqCount : legacyFaqCount;
    rows.push({
      domain,
      maturity_level: yaml.maturity_level ?? "unknown",
      overall_coverage_percent: yaml.status?.overall_coverage_percent ?? null,
      faq_count: faqCount,
      article_count: articleCount,
      a_plus_image_count: manifest.aPlusByDomain[domain] ?? 0,
      image_count: manifest.byDomain[domain] ?? 0,
      inherits_count: (yaml.inherits_from ? String(yaml.inherits_from).split(",").length : 0),
    });
  }
  return rows;
}

function maturityColour(m) {
  return m === "gold" ? "#fbbf24" : m === "silver" ? "#94a3b8" : m === "bronze" ? "#a67c52" : "#e5e5e5";
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render() {
  const domainRows = buildDomainRows();
  const shared = listSharedBrains();
  const manifest = analyseManifest();
  const learning = analyseLearningLog();
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");

  const totalFaqs = domainRows.reduce((s, r) => s + r.faq_count, 0);
  const totalArticles = domainRows.reduce((s, r) => s + r.article_count, 0);
  const totalAPlus = domainRows.reduce((s, r) => s + r.a_plus_image_count, 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>NEX Knowledge Dashboard</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #222; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
  h2 { font-size: 15px; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #ddd; color: #333; }
  table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #e2e2e2; border-radius: 6px; overflow: hidden; margin-bottom: 20px; }
  th, td { padding: 10px 14px; text-align: left; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  th { background: #fafafa; font-weight: 600; color: #555; }
  tr:last-child td { border-bottom: none; }
  .maturity { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: #fff; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { background: #fff; border: 1px solid #e2e2e2; border-radius: 6px; padding: 14px 16px; }
  .kpi .label { font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 0.5px; }
  .kpi .value { font-size: 22px; font-weight: 600; color: #111; margin-top: 4px; }
  .kpi .sub { font-size: 11px; color: #888; margin-top: 2px; }
  .coverage-bar-bg { background: #eee; border-radius: 3px; height: 8px; width: 100px; display: inline-block; vertical-align: middle; }
  .coverage-bar-fill { background: #22c55e; height: 100%; border-radius: 3px; }
</style>
</head>
<body>

<h1>NEX Knowledge Dashboard</h1>
<div class="meta">Generated ${timestamp} · from <code>data/nex-knowledge/*/knowledge.yaml</code> + <code>data/nex-image-manifest.json</code> + <code>data/nex-learning-log.jsonl</code>. Doctrine: <code>docs/brains/nex-domain-quality-dashboard-philip-2026-08-03.md</code>.</div>

<h2>Platform KPIs</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="label">Active Domains</div><div class="value">${domainRows.length}</div><div class="sub">of 170 catalogued</div></div>
  <div class="kpi"><div class="label">Shared Brains</div><div class="value">${shared.length}</div><div class="sub">inherited by every trade</div></div>
  <div class="kpi"><div class="label">Total FAQs</div><div class="value">${totalFaqs.toLocaleString()}</div><div class="sub">across active domains</div></div>
  <div class="kpi"><div class="label">Total Articles</div><div class="value">${totalArticles.toLocaleString()}</div><div class="sub">in Knowledge Layer</div></div>
  <div class="kpi"><div class="label">A+ Specimens</div><div class="value">${totalAPlus}</div><div class="sub">human-verified · rich metadata</div></div>
  <div class="kpi"><div class="label">Marketing Banners</div><div class="value">${manifest.marketingBanners}</div><div class="sub">reusable templates</div></div>
  <div class="kpi"><div class="label">Learning Log Rows</div><div class="value">${learning.total.toLocaleString()}</div><div class="sub">rolling all-time</div></div>
  <div class="kpi"><div class="label">Avg Retrieval Confidence</div><div class="value">${(learning.avgConfidence * 100).toFixed(0)}%</div><div class="sub">last ${learning.total} queries</div></div>
  <div class="kpi"><div class="label">Clarification Rate</div><div class="value">${learning.total ? Math.round(learning.needsClarification / learning.total * 100) : 0}%</div><div class="sub">Brain 14 fired</div></div>
</div>

<h2>Domain Quality Scorecard</h2>
<table>
  <thead>
    <tr><th>Domain</th><th>Maturity</th><th>Coverage</th><th>FAQs</th><th>Articles</th><th>Images</th><th>A+</th><th>Inherits</th></tr>
  </thead>
  <tbody>
    ${domainRows.map((r) => `<tr>
      <td><strong>${esc(r.domain)}</strong></td>
      <td><span class="maturity" style="background:${maturityColour(r.maturity_level)}">${esc(r.maturity_level)}</span></td>
      <td>${r.overall_coverage_percent !== null ? `<span class="coverage-bar-bg"><span class="coverage-bar-fill" style="width:${r.overall_coverage_percent}%"></span></span> ${r.overall_coverage_percent}%` : "—"}</td>
      <td>${r.faq_count.toLocaleString()}</td>
      <td>${r.article_count}</td>
      <td>${r.image_count.toLocaleString()}</td>
      <td>${r.a_plus_image_count}</td>
      <td>${r.inherits_count}</td>
    </tr>`).join("\n")}
  </tbody>
</table>

<h2>Shared Foundation Brains</h2>
<table>
  <thead><tr><th>Shared Brain</th><th>Articles</th><th>Inherited By</th></tr></thead>
  <tbody>
    ${shared.map((s) => {
      const articlesDir = path.join(KNOWLEDGE_ROOT, "_shared", s, "articles");
      const articleCount = countFiles(articlesDir, [".md"]);
      return `<tr><td><strong>_shared/${esc(s)}</strong></td><td>${articleCount}</td><td>every install trade domain</td></tr>`;
    }).join("\n")}
  </tbody>
</table>

<h2>Image Manifest Breakdown</h2>
<table>
  <thead><tr><th>subject_domain</th><th>Count</th><th>A+</th></tr></thead>
  <tbody>
    ${Object.entries(manifest.byDomain).sort((a, b) => b[1] - a[1]).map(([d, count]) => `<tr>
      <td>${esc(d)}</td>
      <td>${count.toLocaleString()}</td>
      <td>${manifest.aPlusByDomain[d] ?? 0}</td>
    </tr>`).join("\n")}
  </tbody>
</table>

<div style="margin-top: 32px; padding: 12px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; font-size: 12px; color: #78350f;">
  <strong>Dashboard v1.</strong> Refinements pending: Sub-area heat map rendering · Knowledge Gap tasks queue · Recommendation Graph visualisation · Design Pattern Library index. Regenerate with <code>node scripts/build-nex-knowledge-dashboard.mjs</code>.
</div>

</body>
</html>
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  console.log(`Wrote ${OUT}`);
  console.log(`Domains: ${domainRows.length} · Shared brains: ${shared.length} · Total FAQs: ${totalFaqs} · Articles: ${totalArticles} · A+ specimens: ${totalAPlus} · Marketing banners: ${manifest.marketingBanners} · Learning log rows: ${learning.total}`);
}

render();
