// NEX App Builder · QA representative renderer (Philip 2026-08-14).
//
// PURPOSE: turn an assembled StudioLayoutJson into structurally-honest
// HTML that Playwright can inspect for QA.
//
// EXPLICITLY NOT: the user-facing merchant renderer.
//
// The real merchant render is done by the existing Studio + section
// renderers (React components in src/lib/studio/sections/*.tsx). That
// pipeline requires Next.js to boot. For the QA loop we need a
// lightweight, headless artifact that:
//   - preserves the section ORDER + KEY + CONFIG
//   - exposes every section, CTA, image, nav entry, page title
//   - can be loaded via Playwright's page.setContent() (no dev server)
//   - carries data-testid attributes so QA checks are precise
//
// The QA representative renderer is a QA CONTRACT · not a design
// artifact. It never claims to be the user-facing page. Its output
// says "QA-only" in a comment and in a data attribute.

import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { AppBlueprint, NavEntry } from "../blueprint-schema";

export type RepresentativePage = {
  pageId: string;
  path: string;
  title: string;
  html: string;
};

/** Render every assembled page as a structurally-honest HTML doc. */
export function renderRepresentativePages(
  bp: AppBlueprint,
  assembled: Record<string, StudioLayoutJson>
): RepresentativePage[] {
  const pages: RepresentativePage[] = [];
  for (const bpPage of bp.pages) {
    const layout = assembled[bpPage.id];
    if (!layout) continue;
    pages.push({
      pageId: bpPage.id,
      path: bpPage.path,
      title: renderTitle(bpPage.title, bp),
      html: renderPageHtml(bp, bpPage.id, layout)
    });
  }
  return pages;
}

function renderTitle(pageTitle: string, bp: AppBlueprint): string {
  const template = bp.seo.siteTitleTemplate ?? "{pageTitle} — {displayName}";
  return template
    .replace("{pageTitle}", pageTitle)
    .replace("{displayName}", bp.identity.displayName || "[displayName]");
}

function renderPageHtml(
  bp: AppBlueprint,
  pageId: string,
  layout: StudioLayoutJson
): string {
  const bpPage = bp.pages.find((p) => p.id === pageId);
  const title = renderTitle(bpPage?.title ?? pageId, bp);
  const description = bp.seo.defaultDescription ?? "";

  return `<!doctype html>
<html lang="en" data-nex-qa="representative-render">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- NEX QA representative render. NOT the user-facing merchant render. -->
<style>${baseStyles(bp)}</style>
</head>
<body data-nex-qa-page="${esc(pageId)}">
${renderNav(bp)}
<main data-nex-main>
${layout.sections.map((s) => renderSection(s, bp, pageId)).join("\n")}
</main>
${renderFooter(bp)}
</body>
</html>`;
}

function renderNav(bp: AppBlueprint): string {
  const entries = bp.navigation.primary
    .map((e) => renderNavEntry(e, bp))
    .join("");
  const cta = bp.navigation.ctaSlot
    ? `<a data-testid="nav-cta" href="#nav-cta">${esc(bp.navigation.ctaSlot.label)}</a>`
    : "";
  return `<nav data-testid="site-nav" data-nex-nav>
  <ul>${entries}</ul>
  ${cta}
</nav>`;
}

function renderNavEntry(e: NavEntry, bp: AppBlueprint): string {
  const href = e.target.kind === "page"
    ? (bp.pages.find((p) => p.id === e.target.pageId)?.path ?? `#${e.target.pageId}`)
    : e.target.href;
  return `<li><a data-testid="nav-${esc((e.target.kind === "page" ? e.target.pageId : e.target.href))}" href="${esc(href)}">${esc(e.label)}</a></li>`;
}

type LayoutSection = StudioLayoutJson["sections"][number];

function renderSection(s: LayoutSection, bp: AppBlueprint, pageId: string): string {
  const key = s.key;
  const cfg = (s.config ?? {}) as Record<string, unknown>;
  const testid = `section-${esc(s.instanceId)}`;
  const dataKey = `data-nex-section-key="${esc(key)}"`;
  const isEmpty = Object.keys(cfg).length === 0;

  // Section-key-driven representative render. Each family produces
  // structurally-honest HTML — headline, image, cta — nothing more.
  if (key.startsWith("hero")) {
    return heroBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("gallery")) {
    return galleryBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("product_grid")) {
    return productGridBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("contact")) {
    return contactBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("map")) {
    return mapBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("services")) {
    return servicesBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("cta")) {
    return ctaBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("team")) {
    return teamBlock(cfg, testid, dataKey);
  }
  if (key.startsWith("features")) {
    return featuresBlock(cfg, testid, dataKey);
  }

  // Generic fallback — still visible for QA
  return `<section data-testid="${testid}" ${dataKey} data-nex-empty="${isEmpty}">
  <h2>[unknown section: ${esc(key)}]</h2>
</section>`;
}

function heroBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const headline = str(cfg.headline ?? cfg.eyebrow ?? "[no hero headline]");
  const subhead = str(cfg.subhead ?? cfg.subheading ?? "");
  const cta = str(cfg.ctaLabel ?? cfg.ctaPrimary ?? "");
  const img = str(cfg.backgroundImageUrl ?? cfg.imageUrl ?? cfg.heroImage ?? cfg.image ?? "");
  return `<section data-testid="${tid}" ${dk} data-nex-family="hero">
  ${img ? `<img data-testid="${tid}-img" src="${esc(img)}" alt="${esc(headline)}" style="max-width:100%">` : ""}
  <h1 data-testid="${tid}-headline">${esc(headline)}</h1>
  ${subhead ? `<p data-testid="${tid}-subhead">${esc(subhead)}</p>` : ""}
  ${cta ? `<a data-testid="${tid}-cta" href="#cta">${esc(cta)}</a>` : ""}
</section>`;
}

function galleryBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const title = str(cfg.title ?? cfg.heading ?? "");
  const columns = num(cfg.columns ?? 3);
  const placeholders = Array.from({ length: columns * 2 }).map(
    (_, i) => `<div data-testid="${tid}-tile-${i}" data-nex-gallery-tile></div>`
  ).join("");
  return `<section data-testid="${tid}" ${dk} data-nex-family="gallery">
  ${title ? `<h2 data-testid="${tid}-title">${esc(title)}</h2>` : ""}
  <div data-testid="${tid}-grid" style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:12px">
    ${placeholders}
  </div>
</section>`;
}

function productGridBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const title = str(cfg.title ?? "");
  const limit = num(cfg.limit ?? 3);
  const cards = Array.from({ length: limit }).map(
    (_, i) => `<article data-testid="${tid}-card-${i}" data-nex-product-card>
      <div data-nex-product-image></div>
      <h3 data-nex-product-name>[product ${i + 1}]</h3>
      <p data-nex-product-price>[price]</p>
      <a data-nex-product-cta href="#buy">Buy</a>
    </article>`
  ).join("");
  return `<section data-testid="${tid}" ${dk} data-nex-family="product_grid">
  ${title ? `<h2 data-testid="${tid}-title">${esc(title)}</h2>` : ""}
  <div data-testid="${tid}-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
    ${cards}
  </div>
</section>`;
}

function contactBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const heading = str(cfg.heading ?? "Contact");
  const fields = Array.isArray(cfg.fields) ? cfg.fields : ["name", "email", "message"];
  const inputs = fields.map(
    (f) => `<label data-nex-form-field><span>${esc(String(f))}</span><input name="${esc(String(f))}" data-testid="${tid}-input-${esc(String(f))}"></label>`
  ).join("");
  return `<section data-testid="${tid}" ${dk} data-nex-family="contact">
  <h2 data-testid="${tid}-heading">${esc(heading)}</h2>
  <form data-testid="${tid}-form" data-nex-contact-form>
    ${inputs}
    <button type="submit" data-testid="${tid}-submit">Send</button>
  </form>
</section>`;
}

function mapBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const title = str(cfg.title ?? "");
  const bindTo = str(cfg.bindTo ?? "");
  return `<section data-testid="${tid}" ${dk} data-nex-family="map">
  ${title ? `<h2 data-testid="${tid}-title">${esc(title)}</h2>` : ""}
  <div data-testid="${tid}-canvas" data-nex-map-bind="${esc(bindTo)}" style="width:100%;aspect-ratio:16/9;background:#eef">[map placeholder]</div>
</section>`;
}

function servicesBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const heading = str(cfg.heading ?? "");
  const items = Array.isArray(cfg.items) ? cfg.items : [];
  const list = items.length > 0
    ? items.map((it: unknown, i) => {
        const item = it as Record<string, unknown>;
        return `<li data-testid="${tid}-item-${i}"><strong>${esc(str(item.title))}</strong><span>${esc(str(item.description ?? ""))}</span></li>`;
      }).join("")
    : `<li data-nex-empty>[services list will populate from Blueprint data]</li>`;
  return `<section data-testid="${tid}" ${dk} data-nex-family="services">
  ${heading ? `<h2>${esc(heading)}</h2>` : ""}
  <ul>${list}</ul>
</section>`;
}

function ctaBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const headline = str(cfg.headline ?? cfg.heading ?? "");
  const body = str(cfg.body ?? "");
  const label = str((cfg.cta as { label?: string } | undefined)?.label ?? cfg.ctaLabel ?? "Learn more");
  return `<section data-testid="${tid}" ${dk} data-nex-family="cta">
  ${headline ? `<h2 data-testid="${tid}-headline">${esc(headline)}</h2>` : ""}
  ${body ? `<p>${esc(body)}</p>` : ""}
  <a data-testid="${tid}-cta" href="#cta-target">${esc(label)}</a>
</section>`;
}

function teamBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const title = str(cfg.title ?? "Team");
  return `<section data-testid="${tid}" ${dk} data-nex-family="team">
  <h2>${esc(title)}</h2>
  <div data-testid="${tid}-members" data-nex-team-grid>[team roster from data binding]</div>
</section>`;
}

function featuresBlock(cfg: Record<string, unknown>, tid: string, dk: string): string {
  const heading = str(cfg.heading ?? "Features");
  return `<section data-testid="${tid}" ${dk} data-nex-family="features">
  <h2>${esc(heading)}</h2>
  <div data-testid="${tid}-items" data-nex-features-grid>[features]</div>
</section>`;
}

function renderFooter(bp: AppBlueprint): string {
  const cols = bp.footer.columns.map(
    (c) => `<div data-testid="footer-col-${esc(c.title)}"><h4>${esc(c.title)}</h4><ul>${c.entries.map((e) => `<li>${esc(e.label)}</li>`).join("")}</ul></div>`
  ).join("");
  const legal = bp.footer.legalLinks.map((e) => `<li>${esc(e.label)}</li>`).join("");
  const displayName = bp.identity.displayName || "[displayName]";
  const copy = (bp.footer.copyrightTemplate ?? "© {year} {displayName}")
    .replace("{year}", String(new Date().getFullYear()))
    .replace("{displayName}", displayName);
  return `<footer data-testid="site-footer" data-nex-footer>
  <div>${cols}</div>
  <ul>${legal}</ul>
  <small>${esc(copy)}</small>
</footer>`;
}

function baseStyles(bp: AppBlueprint): string {
  return `
    :root {
      --brand-primary:    ${bp.brand.palette.primary};
      --brand-bg:         ${bp.brand.palette.background};
      --brand-fg:         ${bp.brand.palette.foreground};
      --font-heading:     ${bp.brand.typography.headingFamily};
      --font-body:        ${bp.brand.typography.bodyFamily};
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: var(--font-body); color: var(--brand-fg); background: var(--brand-bg); }
    nav[data-testid="site-nav"] { padding: 12px 20px; border-bottom: 1px solid #eee; }
    nav ul { display: flex; gap: 20px; list-style: none; margin: 0; padding: 0; }
    nav a { color: var(--brand-fg); text-decoration: none; }
    main { padding: 0; }
    section { padding: 40px 20px; }
    h1, h2, h3, h4 { font-family: var(--font-heading); color: var(--brand-fg); margin: 0 0 12px; }
    a[data-testid$="-cta"], a[data-testid="nav-cta"] { display: inline-block; background: var(--brand-primary); color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; }
    footer { padding: 40px 20px; border-top: 1px solid #eee; }
  `;
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
function str(v: unknown): string { return v == null ? "" : String(v); }
function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 3; }
