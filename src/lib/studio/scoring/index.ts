// Design Score orchestrator.
//
// scorePage() reads the layout + section registrations from the client
// registry, runs the 6 per-dimension heuristics on each instance,
// rolls up dimension averages, adds page-level findings (multi-H1,
// no-hero, dead sections), and returns a PageScoreResult ready for
// the modal to render.
//
// Pure — no I/O, no async, no bus. Client-safe.

import { sectionRegistry } from "../sectionRegistry";
import type { StudioLayoutJson } from "../schema";
import {
  scoreAccessibility,
  scoreBrandConsistency,
  scoreLoading,
  scoreMobile,
  scoreSales,
  scoreSeo
} from "./heuristics";
import type {
  PageScoreResult,
  ScoreDimension,
  ScoreFinding,
  SectionScoreResult
} from "./types";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function zeroDims(): Record<ScoreDimension, number> {
  return {
    loading: 0,
    accessibility: 0,
    sales: 0,
    seo: 0,
    mobile: 0,
    brandConsistency: 0
  };
}

export function scorePage(layout: StudioLayoutJson): PageScoreResult {
  const sectionScores: SectionScoreResult[] = layout.sections.map((instance) => {
    const reg = sectionRegistry.get(instance.key);
    if (!reg) {
      return {
        instanceId: instance.instanceId,
        sectionId: instance.key,
        sectionName: instance.key,
        dimensions: zeroDims(),
        overall: 0,
        findings: [
          {
            dimension: "brandConsistency",
            severity: "error",
            message: "Section registration not available — scoring skipped."
          }
        ]
      };
    }

    const loading = scoreLoading(instance, reg);
    const accessibility = scoreAccessibility(instance, reg);
    const sales = scoreSales(instance, reg);
    const seo = scoreSeo(instance, reg);
    const mobile = scoreMobile(instance, reg);
    const brand = scoreBrandConsistency(instance, reg);

    const dimensions = {
      loading: loading.score,
      accessibility: accessibility.score,
      sales: sales.score,
      seo: seo.score,
      mobile: mobile.score,
      brandConsistency: brand.score
    };
    const overall = avg(Object.values(dimensions));
    const findings = [
      ...loading.findings,
      ...accessibility.findings,
      ...sales.findings,
      ...seo.findings,
      ...mobile.findings,
      ...brand.findings
    ];

    return {
      instanceId: instance.instanceId,
      sectionId: instance.key,
      sectionName: reg.name,
      dimensions,
      overall,
      findings
    };
  });

  const pageFindings = collectPageFindings(layout);

  const dimensions: Record<ScoreDimension, number> = {
    loading: avg(sectionScores.map((s) => s.dimensions.loading)),
    accessibility: avg(sectionScores.map((s) => s.dimensions.accessibility)),
    sales: avg(sectionScores.map((s) => s.dimensions.sales)),
    seo: avg(sectionScores.map((s) => s.dimensions.seo)),
    mobile: avg(sectionScores.map((s) => s.dimensions.mobile)),
    brandConsistency: avg(
      sectionScores.map((s) => s.dimensions.brandConsistency)
    )
  };

  const overall = avg(Object.values(dimensions));

  return { overall, dimensions, sectionScores, pageFindings };
}

// ─── Page-level checks ─────────────────────────────────────

function collectPageFindings(layout: StudioLayoutJson): ScoreFinding[] {
  const findings: ScoreFinding[] = [];

  // Count sections whose registration says headingLevel === 1.
  const h1Count = layout.sections.filter((s) => {
    const reg = sectionRegistry.get(s.key);
    return reg?.scoreHints?.seo?.headingLevel === 1 && !s.hidden;
  }).length;

  if (h1Count === 0) {
    findings.push({
      dimension: "seo",
      severity: "warn",
      message: "No H1 anywhere on the page — likely missing a hero."
    });
  } else if (h1Count > 1) {
    findings.push({
      dimension: "seo",
      severity: "warn",
      message: `${h1Count} sections use H1 — SEO best practice is exactly one.`
    });
  }

  // Sections hidden on every breakpoint = dead weight in the draft.
  const deadInstances = layout.sections.filter((s) => {
    if (s.hidden) return true;
    const bps = s.hiddenOn ?? [];
    return (
      bps.includes("mobile") &&
      bps.includes("tablet") &&
      bps.includes("desktop")
    );
  });
  if (deadInstances.length > 0) {
    findings.push({
      dimension: "brandConsistency",
      severity: "info",
      message: `${deadInstances.length} section${
        deadInstances.length === 1 ? "" : "s"
      } hidden everywhere — consider removing to keep the layout tidy.`
    });
  }

  // No CTA button anywhere on the page.
  const hasAnyCta = layout.sections.some((s) => {
    const reg = sectionRegistry.get(s.key);
    if (!reg) return false;
    if (s.hidden) return false;
    const buttonFields = reg.editableFields.filter((f) => f.priority === "button");
    return buttonFields.some(
      (f) => typeof s.config[f.key] === "string" && s.config[f.key] !== ""
    );
  });
  if (!hasAnyCta && layout.sections.length > 0) {
    findings.push({
      dimension: "sales",
      severity: "error",
      message: "No CTA button anywhere on the page — customers can't act."
    });
  }

  return findings;
}
