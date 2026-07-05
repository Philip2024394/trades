// CreativeDirector — the orchestrator.
//
// Given a CreativeBrief:
//   1. Dispatch to specialists in order (brand-voice → copy → project-story → seo)
//   2. Group blocks into sections + pages according to content flow
//   3. Assemble the ContentManifest with strategy snapshot + warnings
//
// Given a ContentManifest + RegenerationRequest:
//   - Selectively re-run the affected specialist(s) and swap only the
//     targeted blocks — nothing else changes.
//
// Deterministic. No LLM calls in v1. Specialists themselves may be
// LLM-backed in future — the director does not care.

import { composerRegistry } from "./composers";
import type {
  ContentBlock,
  ContentBlockKind,
  ContentManifest,
  ContentPage,
  ContentSection,
  CreativeBrief,
  RegenerationRequest
} from "./types";

/** Which section a block belongs to on a website page. */
function sectionFor(kind: ContentBlockKind): { slug: string; label: string; sortIndex: number } {
  switch (kind) {
    case "hero":
      return { slug: "hero", label: "Hero", sortIndex: 0 };
    case "service-list":
      return { slug: "services", label: "Services", sortIndex: 1 };
    case "value-props":
      return { slug: "value-props", label: "Why us", sortIndex: 2 };
    case "trust-copy":
      return { slug: "trust", label: "Trust", sortIndex: 3 };
    case "testimonial-copy":
      return { slug: "testimonials", label: "Testimonials", sortIndex: 4 };
    case "faq":
      return { slug: "faq", label: "FAQ", sortIndex: 5 };
    case "cta-band":
      return { slug: "cta-band", label: "CTA", sortIndex: 6 };
    case "brand-voice-profile":
      return { slug: "brand-voice", label: "Brand voice", sortIndex: 99 };
    case "seo-page":
      return { slug: "seo", label: "SEO", sortIndex: 100 };
    case "project-story":
      return { slug: "projects", label: "Projects", sortIndex: 101 };
  }
}

async function runComposer(
  slug: string,
  brief: CreativeBrief
): Promise<ContentBlock[]> {
  const composer = composerRegistry.get(slug);
  if (!composer) return [];
  const result = await Promise.resolve(composer.compose(brief));
  return result;
}

/** Group blocks into sections and pages. v1 assembles a single home
 *  page + a projects page (if project stories exist) + a set of SEO
 *  pages. */
function assemblePages(
  blocks: readonly ContentBlock[]
): readonly ContentPage[] {
  const pages: ContentPage[] = [];

  const homeBlocks = blocks.filter(
    (b) => b.kind !== "seo-page" && b.kind !== "project-story" && b.kind !== "brand-voice-profile"
  );
  const sectionMap = new Map<string, ContentSection & { sortIndex: number }>();
  for (const block of homeBlocks) {
    const meta = sectionFor(block.kind);
    const existing = sectionMap.get(meta.slug);
    if (existing) {
      (existing.blocks as ContentBlock[]).push(block);
    } else {
      sectionMap.set(meta.slug, {
        slug: meta.slug,
        label: meta.label,
        blocks: [block],
        sortIndex: meta.sortIndex
      });
    }
  }
  const sections = Array.from(sectionMap.values())
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(({ sortIndex: _s, ...rest }) => rest);
  const seoHome = blocks.find(
    (b) => b.kind === "seo-page" && (b.data as { slug?: string }).slug === "home"
  );
  pages.push({
    slug: "home",
    path: "/",
    label: "Home",
    sections,
    seo: seoHome
      ? {
          title: (seoHome.data as { title: string }).title,
          description: (seoHome.data as { description: string }).description,
          keywords: (seoHome.data as { keywords: readonly string[] }).keywords
        }
      : undefined
  });

  // Projects page (if we have project stories).
  const projectBlocks = blocks.filter((b) => b.kind === "project-story");
  if (projectBlocks.length) {
    pages.push({
      slug: "projects",
      path: "/projects",
      label: "Projects",
      sections: [
        { slug: "projects", label: "Projects", blocks: projectBlocks }
      ]
    });
    for (const project of projectBlocks) {
      const data = project.data as { seo: { title: string; description: string; keywords: readonly string[] } };
      pages.push({
        slug: project.slug,
        path: `/projects/${project.slug.replace(/^project-/, "")}`,
        label: (project.data as { title: string }).title,
        sections: [
          { slug: "story", label: "Case study", blocks: [project] }
        ],
        seo: data.seo
      });
    }
  }

  // Additional SEO pages (service, town) each get their own page shell.
  const otherSeoBlocks = blocks.filter(
    (b) => b.kind === "seo-page" && (b.data as { slug: string }).slug !== "home"
  );
  for (const seoBlock of otherSeoBlocks) {
    const data = seoBlock.data as {
      slug: string;
      path: string;
      title: string;
      description: string;
      keywords: readonly string[];
    };
    pages.push({
      slug: data.slug,
      path: data.path,
      label: data.title,
      sections: [
        { slug: "seo", label: "SEO", blocks: [seoBlock] }
      ],
      seo: {
        title: data.title,
        description: data.description,
        keywords: data.keywords
      }
    });
  }

  return pages;
}

function buildManifestSlug(brief: CreativeBrief): string {
  const p = brief.strategy.inputs.profile.slug;
  const m = brief.outputMedium;
  const t = Date.now();
  return `${p}-${m}-${t}`;
}

/** Compose a fresh ContentManifest from a brief. */
export async function direct(brief: CreativeBrief): Promise<ContentManifest> {
  const warnings: string[] = [];

  // 1. Brand voice first — downstream copy composer may reference it.
  const brandVoiceBlocks = await runComposer("brand-voice", brief);
  // 2. Copy.
  const copyBlocks = await runComposer("copy", brief);
  // 3. Project stories (optional).
  const projectBlocks = brief.projects?.length
    ? await runComposer("project-story", brief)
    : [];
  if (!brief.projects?.length) {
    warnings.push(
      "No projects supplied — Project Story Composer produced no case studies. Upload project photos to build case studies."
    );
  }
  // 4. SEO.
  const seoBlocks = await runComposer("seo", brief);

  const allBlocks = [
    ...brandVoiceBlocks,
    ...copyBlocks,
    ...projectBlocks,
    ...seoBlocks
  ];
  const pages = assemblePages(allBlocks);

  const manifest: ContentManifest = Object.freeze({
    manifestVersion: 1,
    slug: buildManifestSlug(brief),
    outputMedium: brief.outputMedium,
    strategySnapshot: {
      profileSlug: brief.strategy.inputs.profile.slug,
      strategySlug: brief.strategy.inputs.strategy.slug,
      recipeSlug: brief.strategy.inputs.recipe.slug,
      tradeSlug: brief.strategy.inputs.profile.trade,
      playbooks: brief.strategy.inputs.recipe.playbooks,
      resolvedAt: brief.strategy.resolvedAt
    },
    brandVoice: brief.brandVoice,
    pages,
    siteWideBlocks: brandVoiceBlocks,
    generatedAt: new Date().toISOString(),
    warnings
  });
  return manifest;
}

/** Regenerate a subset of a manifest. Precise targeting — nothing
 *  outside the request scope changes. */
export async function regenerate(
  manifest: ContentManifest,
  brief: CreativeBrief,
  request: RegenerationRequest
): Promise<ContentManifest> {
  // Apply per-request overrides (e.g. brandVoice).
  const effectiveBrief: CreativeBrief = request.overrides?.brandVoice
    ? { ...brief, brandVoice: request.overrides.brandVoice }
    : brief;

  // Determine which block slugs to replace.
  const targetSlugs = new Set<string>();
  if (request.scope === "manifest") {
    // Full re-run.
    return direct(effectiveBrief);
  }
  if (request.scope === "page") {
    const page = manifest.pages.find((p) => p.slug === request.targetPageSlug);
    if (!page) return manifest;
    for (const section of page.sections) {
      for (const block of section.blocks) targetSlugs.add(block.slug);
    }
  } else if (request.scope === "section") {
    for (const page of manifest.pages) {
      const section = page.sections.find((s) => s.slug === request.targetSectionSlug);
      if (section) {
        for (const block of section.blocks) targetSlugs.add(block.slug);
      }
    }
  } else if (request.scope === "block") {
    for (const slug of request.targetBlockSlugs ?? []) targetSlugs.add(slug);
  }

  if (!targetSlugs.size) return manifest;

  // Re-run every specialist whose blocks intersect with the target set.
  const targetKindsBySpecialist = new Map<string, Set<string>>();
  for (const page of manifest.pages) {
    for (const section of page.sections) {
      for (const block of section.blocks) {
        if (!targetSlugs.has(block.slug)) continue;
        const specialistSlug = block.provenance.generatedBy;
        const kinds = targetKindsBySpecialist.get(specialistSlug) ?? new Set();
        kinds.add(block.slug);
        targetKindsBySpecialist.set(specialistSlug, kinds);
      }
    }
  }

  // Compose replacement blocks.
  const replacements = new Map<string, ContentBlock>();
  for (const specialistSlug of targetKindsBySpecialist.keys()) {
    const fresh = await runComposer(specialistSlug, effectiveBrief);
    for (const block of fresh) {
      if (targetSlugs.has(block.slug)) {
        replacements.set(block.slug, block);
      }
    }
  }

  // Swap blocks in place.
  const newPages: ContentPage[] = manifest.pages.map((page) => {
    const newSections = page.sections.map((section) => {
      const newBlocks = section.blocks.map((block) => {
        return replacements.get(block.slug) ?? block;
      });
      return { ...section, blocks: newBlocks };
    });
    return { ...page, sections: newSections };
  });

  return Object.freeze({
    ...manifest,
    brandVoice: effectiveBrief.brandVoice,
    pages: newPages,
    generatedAt: new Date().toISOString()
  });
}

export const CreativeDirector = { direct, regenerate };
