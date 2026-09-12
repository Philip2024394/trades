// src/lib/nex-agent/seo-agent.ts
//
// SEO Agent · scans a task's context (prompt · plan.proposed_files · derived
// project type) and returns actionable SEO suggestions NEX1 can bake into the
// code as it builds. Heuristic · pure function · no LLM call · deterministic.
//
// Discipline (never violated):
//   - No keyword stuffing · no hidden text · no cloaking · no doorway pages
//   - Every suggestion has a "why" · founder sees the reasoning
//   - Never overwrites existing meta · always augments
//   - Founder can dismiss (persisted per-project)

export type SeoCategory =
  | "meta-basics" | "open-graph" | "twitter-card" | "structured-data"
  | "canonical" | "sitemap" | "robots" | "semantic-html" | "images"
  | "performance" | "accessibility" | "internal-linking" | "mobile"
  | "content" | "schema-org";

export type SeoSeverity = "high" | "medium" | "low";

export interface SeoSuggestion {
  readonly id: string;
  readonly category: SeoCategory;
  readonly severity: SeoSeverity;
  readonly title: string;
  readonly rationale: string;
  readonly example: string | null;
  readonly targetFile: string | null;   // where NEX1 should apply this
  readonly appliesTo: readonly string[]; // project types this applies to
}

export type ProjectType =
  | "landing-page" | "saas" | "marketplace" | "directory"
  | "blog" | "docs" | "webapp" | "ecommerce" | "portfolio" | "unknown";

export interface SeoContext {
  readonly projectType: ProjectType;
  readonly detectedFrom: string[];
  readonly hasNextJs: boolean;
  readonly pageFiles: readonly string[];   // src/app/**/page.tsx paths
  readonly promptWordSample: string;
}

/** Detect the project type from prompt + package.json + file paths. */
export function detectProjectType(input: {
  prompt: string;
  packageJson?: Record<string, unknown> | null;
  pageFiles?: readonly string[];
}): SeoContext {
  const promptLower = input.prompt.toLowerCase();
  const pageFiles = input.pageFiles ?? [];
  const detectedFrom: string[] = [];

  const pkg = input.packageJson ?? null;
  const deps = pkg ? { ...(pkg.dependencies as Record<string, unknown> ?? {}), ...(pkg.devDependencies as Record<string, unknown> ?? {}) } : {};
  const hasNextJs = "next" in deps;
  if (hasNextJs) detectedFrom.push("package.json:next");
  if ("@vercel/analytics" in deps) detectedFrom.push("package.json:analytics");
  if ("react" in deps) detectedFrom.push("package.json:react");

  const check = (needles: string[], type: ProjectType, source: string): ProjectType | null => {
    for (const n of needles) if (promptLower.includes(n)) { detectedFrom.push(`${source}:${n}`); return type; }
    return null;
  };

  let projectType: ProjectType = "unknown";
  projectType = check(["landing page", "marketing site", "launch site"], "landing-page", "prompt") ?? projectType;
  projectType = check(["saas", "dashboard", "admin", "workspace"], "saas", "prompt") ?? projectType;
  projectType = check(["marketplace", "listings", "sellers", "buyers"], "marketplace", "prompt") ?? projectType;
  projectType = check(["directory", "index of", "listing site"], "directory", "prompt") ?? projectType;
  projectType = check(["blog", "articles", "posts", "publication"], "blog", "prompt") ?? projectType;
  projectType = check(["docs", "documentation", "guide", "handbook"], "docs", "prompt") ?? projectType;
  projectType = check(["ecommerce", "shop", "store", "products", "cart", "checkout"], "ecommerce", "prompt") ?? projectType;
  projectType = check(["portfolio", "personal site", "cv site"], "portfolio", "prompt") ?? projectType;
  if (projectType === "unknown" && hasNextJs) { projectType = "webapp"; detectedFrom.push("fallback:next"); }

  return {
    projectType,
    detectedFrom,
    hasNextJs,
    pageFiles,
    promptWordSample: input.prompt.slice(0, 200),
  };
}

const ALL_SUGGESTIONS: readonly Omit<SeoSuggestion, "id">[] = [
  // ─── Meta basics ─────────────────────────────────────────────────
  {
    category: "meta-basics", severity: "high",
    title: "Set page-specific <title> and <meta name=\"description\">",
    rationale: "Google uses <title> for the SERP heading and description for the snippet. Missing or duplicate values across pages drops CTR by 30-50%.",
    example: `export const metadata: Metadata = { title: "…", description: "…" };`,
    targetFile: "src/app/**/page.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  {
    category: "meta-basics", severity: "high",
    title: "Add <html lang=\"en\"> to root layout",
    rationale: "Language declaration is a Core Web Vitals + accessibility signal. Missing lang attribute costs both Google and screen-reader users.",
    example: `<html lang="en">`,
    targetFile: "src/app/layout.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Open Graph ──────────────────────────────────────────────────
  {
    category: "open-graph", severity: "high",
    title: "Add Open Graph + Twitter Card metadata",
    rationale: "OG tags drive shareable previews on Facebook · LinkedIn · Slack · Discord · WhatsApp. Twitter cards drive Twitter previews. Missing tags = plain-text share = tiny CTR.",
    example: `openGraph: { title, description, images: [{ url, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", … }`,
    targetFile: "src/app/**/page.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  {
    category: "open-graph", severity: "medium",
    title: "Ship a 1200x630 OG image per major page",
    rationale: "Text-only OG previews look outdated in 2026. Even a simple branded gradient with the page title is a huge CTR lift on socials.",
    example: `openGraph: { images: [{ url: "/og/page-name.png", width: 1200, height: 630 }] }`,
    targetFile: "public/og/*.png",
    appliesTo: ["landing-page", "saas", "marketplace", "blog", "portfolio", "ecommerce"],
  },
  // ─── Structured data ─────────────────────────────────────────────
  {
    category: "structured-data", severity: "high",
    title: "Add JSON-LD schema.org markup",
    rationale: "Google's rich result eligibility depends on schema.org JSON-LD. Missing it means no star ratings, no product cards, no FAQ accordions in search results.",
    example: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product",…}</script>`,
    targetFile: "src/app/**/page.tsx",
    appliesTo: ["marketplace", "directory", "blog", "ecommerce", "portfolio"],
  },
  {
    category: "schema-org", severity: "medium",
    title: "Use Organization / WebSite schema in root layout",
    rationale: "Site-wide Organization + WebSite schema helps Google build knowledge-graph entries and populate the sitelinks search box.",
    example: `{"@context":"https://schema.org","@type":"Organization","name":"NEX Enterprise","logo":"…","sameAs":["…"]}`,
    targetFile: "src/app/layout.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Canonical + robots ──────────────────────────────────────────
  {
    category: "canonical", severity: "medium",
    title: "Set canonical URL per page",
    rationale: "Canonical URLs prevent duplicate-content dilution and consolidate ranking signals to the right URL variant.",
    example: `alternates: { canonical: "https://example.com/path" }`,
    targetFile: "src/app/**/page.tsx",
    appliesTo: ["marketplace", "directory", "blog", "ecommerce", "docs"],
  },
  {
    category: "robots", severity: "high",
    title: "Add robots.txt at project root",
    rationale: "Without robots.txt Googlebot crawls everything including admin panels · staging routes · noisy paths that waste crawl budget.",
    example: `User-agent: *\nDisallow: /admin\nSitemap: /sitemap.xml`,
    targetFile: "public/robots.txt",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Sitemap ─────────────────────────────────────────────────────
  {
    category: "sitemap", severity: "high",
    title: "Generate sitemap.xml with lastmod dates",
    rationale: "Google prioritises pages listed in sitemap.xml with fresh lastmod. Missing sitemap = slower indexing of new content.",
    example: `export default function sitemap() { return [{ url: "…", lastModified: new Date() }]; }`,
    targetFile: "src/app/sitemap.ts",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "ecommerce", "portfolio"],
  },
  // ─── Semantic HTML ───────────────────────────────────────────────
  {
    category: "semantic-html", severity: "medium",
    title: "Use one <h1> per page + logical heading hierarchy",
    rationale: "Multiple H1s or heading level skips (H1 → H4) confuse both Google's content parser and screen readers. One H1 · then H2/H3 in order.",
    example: `<h1>Page title</h1>\n<section><h2>Section heading</h2>…</section>`,
    targetFile: "src/app/**/page.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  {
    category: "semantic-html", severity: "medium",
    title: "Wrap page regions in <main> · <nav> · <article> · <aside>",
    rationale: "Semantic landmark tags help Google understand page structure + let screen-reader users jump between regions. <div> soup is a 2015-era anti-pattern.",
    example: `<main><article>…</article></main>\n<nav aria-label="Primary">…</nav>`,
    targetFile: "src/app/**/page.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Images ──────────────────────────────────────────────────────
  {
    category: "images", severity: "high",
    title: "Every <img> or next/image gets alt text",
    rationale: "Missing alt text = missed accessibility + missed Google image search reach. Decorative images: alt=\"\". Meaningful images: descriptive alt.",
    example: `<Image src="…" alt="Founder demoing the NEX workstation preview panel" />`,
    targetFile: "src/**/*.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  {
    category: "images", severity: "medium",
    title: "Use next/image for automatic WebP + lazy-load",
    rationale: "next/image converts to WebP and lazy-loads by default. Manual <img> tags miss both optimisations · costing Core Web Vitals scores.",
    example: `import Image from "next/image"; <Image src="…" alt="…" width={800} height={600} />`,
    targetFile: "src/**/*.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Performance / Core Web Vitals ───────────────────────────────
  {
    category: "performance", severity: "high",
    title: "Set explicit width/height on every image + iframe",
    rationale: "Missing dimensions cause CLS (Cumulative Layout Shift) · one of the three Core Web Vitals · which Google uses as a ranking signal since 2021.",
    example: `<Image width={1200} height={630} … />`,
    targetFile: "src/**/*.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  {
    category: "performance", severity: "medium",
    title: "Font-display: swap + preload critical fonts",
    rationale: "Blocking font loads cause FCP (First Contentful Paint) to fail Core Web Vitals. Preload + swap keeps text visible while the custom font loads.",
    example: `next/font auto-handles swap · use next/font/google or next/font/local`,
    targetFile: "src/app/layout.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Internal linking ────────────────────────────────────────────
  {
    category: "internal-linking", severity: "medium",
    title: "Use descriptive anchor text · never \"click here\"",
    rationale: "Google reads anchor text as a signal about the destination page. \"Click here\" tells Google nothing · \"NEX1 workstation features\" tells Google exactly what.",
    example: `<Link href="/features">NEX1 workstation features</Link>`,
    targetFile: "src/**/*.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Mobile / a11y ───────────────────────────────────────────────
  {
    category: "mobile", severity: "high",
    title: "Set <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    rationale: "Missing viewport meta breaks mobile rendering + fails Google's Mobile-Friendly Test = mobile ranking penalty.",
    example: `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    targetFile: "src/app/layout.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  {
    category: "accessibility", severity: "medium",
    title: "aria-label on every icon-only button",
    rationale: "Icon-only buttons (⚙ ⋯ ×) are unreadable to screen readers without aria-label · fail WCAG 2.1 · rank lower on accessibility-aware searches.",
    example: `<button aria-label="Close dialog">×</button>`,
    targetFile: "src/**/*.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "directory", "blog", "docs", "webapp", "ecommerce", "portfolio"],
  },
  // ─── Content ─────────────────────────────────────────────────────
  {
    category: "content", severity: "medium",
    title: "Above-the-fold content = clear value prop in <300 chars",
    rationale: "Google + users decide in 3 seconds. Above-the-fold hero copy that names the problem + names the fix = high engagement · lower bounce · higher ranking.",
    example: `<h1>The AI programming workstation for enterprise</h1>\n<p>NEX1 builds · NEX2 reviews · NEX3 confirms. Ship faster · ship safer.</p>`,
    targetFile: "src/app/page.tsx",
    appliesTo: ["landing-page", "saas", "marketplace", "portfolio"],
  },
];

/**
 * Suggest SEO items for a given project context. Filters by projectType and
 * sorts by severity descending. Returns at most `limit` suggestions.
 */
export function suggestSeo(ctx: SeoContext, limit = 20): readonly SeoSuggestion[] {
  const applicable = ALL_SUGGESTIONS
    .filter((s) => s.appliesTo.includes(ctx.projectType) || ctx.projectType === "unknown")
    .map<SeoSuggestion>((s, i) => ({ ...s, id: `seo-${s.category}-${i}` }));

  applicable.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity];
  });
  return applicable.slice(0, limit);
}

/** Pick one suggestion to "flash" as recently-introduced · deterministic per taskId+index. */
export function pickIntroductionFlash(suggestions: readonly SeoSuggestion[], seed: string): SeoSuggestion | null {
  if (suggestions.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % suggestions.length;
  return suggestions[idx];
}
