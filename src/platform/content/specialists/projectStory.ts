// ProjectStoryComposer — case study from photo + metadata.
//
// v1 = deterministic template. Produces structured project-story
// blocks. LLM backend registers against slug "project-story" later
// for richer narrative.
//
// HONESTY: v1 does NOT invent customer quotes, materials it wasn't
// given, or outcomes it can't attribute. Missing fields are left
// blank with an editable-fields hint rather than filled with plausible
// fiction.

import { tradeIntelligenceRegistry } from "@/platform/business";
import type { ProjectStoryBlockData } from "../blocks";
import { composerRegistry } from "../composers";
import { buildBlock, buildProvenance, buildRegenerationHints } from "../provenance";
import type { ContentBlock, CreativeBrief, ProjectInput } from "../types";

const COMPOSER_META = {
  slug: "project-story",
  version: "1.0.0",
  backend: "template" as const
};

const P = { name: "Xrated Trades Platform", verified: true } as const;

function humanServiceLabel(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function composeProjectStoryBlocks(brief: CreativeBrief): ContentBlock[] {
  if (!brief.projects?.length) return [];

  const profile = brief.strategy.inputs.profile;
  const trade = tradeIntelligenceRegistry.get(profile.trade);

  return brief.projects.map((project) => {
    const data = buildProjectStoryData(project, trade, profile.name);
    return buildBlock<ProjectStoryBlockData>({
      slug: `project-${project.slug}`,
      kind: "project-story",
      data,
      provenance: buildProvenance({
        strategy: brief.strategy,
        composer: COMPOSER_META,
        purpose: "showcase",
        knowledgeRefs: [`trade:${profile.trade}`, `project:${project.slug}`]
      }),
      regeneration: buildRegenerationHints({
        editableFields: [
          "title",
          "challenge",
          "solution",
          "process",
          "outcome",
          "customerQuote"
        ],
        invalidatedBy: [`project:${project.slug}`, `trade:${profile.trade}`],
        regenerationHint:
          "Add more materials + outcome notes to get a richer case study"
      })
    });
  });
}

function buildProjectStoryData(
  project: ProjectInput,
  trade: ReturnType<typeof tradeIntelligenceRegistry.get>,
  merchantName: string
): ProjectStoryBlockData {
  const serviceLabel =
    trade?.services.find((s) => s.slug === project.service)?.label ??
    humanServiceLabel(project.service);
  const locationSuffix = project.location ? ` in ${project.location}` : "";
  const title = `${serviceLabel}${locationSuffix}`;

  const materials = (project.materials ?? []).slice();
  const materialsLine = materials.length
    ? `Selected materials: ${materials.join(", ")}.`
    : "[Add the materials used on this project.]";

  const durationLine = project.duration
    ? `Total time on site: ${project.duration}.`
    : "[Add the project duration.]";

  const challenge = project.freeformNotes
    ? `${project.freeformNotes}`
    : `[Describe the customer's challenge in one to two sentences — what did they need us to solve?]`;

  const solution = `We delivered ${serviceLabel.toLowerCase()}${locationSuffix} for ${merchantName}. ${materialsLine}`;

  const process: string[] = [
    "On-site survey and quote",
    "Materials selected and ordered",
    "Installation by our in-house team",
    "Handover and aftercare"
  ];

  const outcome = project.customerQuote
    ? `The customer was delighted with the finished result. ${durationLine}`
    : `${durationLine} [Add a one-line outcome — what was the finished result the customer got?]`;

  const seoKeywords = [
    serviceLabel.toLowerCase(),
    project.location?.toLowerCase(),
    trade?.slug,
    ...(materials.map((m) => m.toLowerCase()))
  ].filter((s): s is string => Boolean(s));

  return {
    title,
    service: project.service,
    location: project.location,
    duration: project.duration,
    materials,
    photoCount: project.photoCount ?? 0,
    challenge,
    solution,
    process,
    outcome,
    customerQuote: project.customerQuote,
    seo: {
      title: `${title} — ${merchantName}`,
      description: `${serviceLabel}${locationSuffix} completed by ${merchantName}. ${materialsLine}`,
      keywords: seoKeywords
    }
  };
}

composerRegistry.register({
  manifestVersion: 1,
  slug: COMPOSER_META.slug,
  name: "Project Story Composer (template v1)",
  description:
    "Produces structured project-story blocks from photo metadata. Never invents materials, quotes, or outcomes it wasn't given — missing fields render as editable placeholders.",
  version: COMPOSER_META.version,
  supportedBlockKinds: ["project-story"],
  supportedOutputMedia: ["website", "brochure", "landing-page"],
  backend: COMPOSER_META.backend,
  compose: composeProjectStoryBlocks,
  publisher: P
});
