// Margin math + status bands for Job Cost Mode.
//
// The single question every trade wants answered: "am I making money on
// this job right now?" These helpers turn cost lines into that answer.
//
// Rock-solid rule: overhead allocation is included in the cost side of
// margin — otherwise the trade is looking at vanity numbers (gross
// margin) instead of the truth (net margin after their share of van,
// insurance, phone, workshop, and the £s Trade Center itself charges).

import type { Job, JobCostLine, JobPaymentStage, CostCategory } from "../data/jobs";

export type MarginStatus = "loss" | "risk" | "thin" | "healthy" | "strong";

export type MarginSnapshot = {
  quoteGbp: number;
  incurredCostsGbp: number;
  netMarginGbp: number;
  netMarginPct: number;
  status: MarginStatus;
  perCategory: Record<CostCategory, number>;
  materialsBudgetGbp: number;
  materialsSpentGbp: number;
  materialsUsedPct: number;
  materialsWarn: boolean;
  labourBudgetGbp: number;
  labourSpentGbp: number;
  labourUsedPct: number;
};

/** Map margin % to a status band. These thresholds are the rules of
 *  thumb most UK sole-trader trades use — configurable per-user later. */
export function bandForMarginPct(pct: number): MarginStatus {
  if (pct < 0) return "loss";
  if (pct < 15) return "risk";
  if (pct < 25) return "thin";
  if (pct < 40) return "healthy";
  return "strong";
}

/** Colour tokens for the margin bar. Green = healthy, red = loss.
 *  Never a raw hex outside this file so future theming is easy. */
export function colourForStatus(status: MarginStatus): { fg: string; bg: string; label: string } {
  switch (status) {
    case "loss":    return { fg: "#FFFFFF", bg: "#B91C1C", label: "Loss" };
    case "risk":    return { fg: "#FFFFFF", bg: "#DC2626", label: "At risk" };
    case "thin":    return { fg: "#0A0A0A", bg: "#F59E0B", label: "Thin" };
    case "healthy": return { fg: "#FFFFFF", bg: "#166534", label: "Healthy" };
    case "strong":  return { fg: "#FFFFFF", bg: "#065F46", label: "Strong" };
  }
}

export function computeMargin(
  job: Job,
  costLines: JobCostLine[]
): MarginSnapshot {
  const perCategory: Record<CostCategory, number> = {
    materials: 0,
    labour: 0,
    subcontractor: 0,
    transport: 0,
    waste: 0,
    hire: 0,
    overhead: 0,
    other: 0
  };
  for (const line of costLines) {
    perCategory[line.category] += line.totalGbp;
  }

  // Include the job's allocated slice of monthly overhead so the margin
  // isn't vanity (materials + labour only).
  const overheadAllocation = job.overheadAllocationGbp ?? 0;
  const totalIncurred =
    Object.values(perCategory).reduce((s, v) => s + v, 0) + overheadAllocation;

  const netMarginGbp = job.quoteGbp - totalIncurred;
  const netMarginPct = job.quoteGbp > 0 ? (netMarginGbp / job.quoteGbp) * 100 : 0;

  const materialsSpent = perCategory.materials;
  const materialsUsedPct = job.materialsBudgetGbp > 0
    ? (materialsSpent / job.materialsBudgetGbp) * 100
    : 0;

  const labourSpent = perCategory.labour + perCategory.subcontractor;
  const labourBudget = job.labourBudgetHours * job.labourRateGbp;
  const labourUsedPct = labourBudget > 0 ? (labourSpent / labourBudget) * 100 : 0;

  return {
    quoteGbp: job.quoteGbp,
    incurredCostsGbp: totalIncurred,
    netMarginGbp,
    netMarginPct,
    status: bandForMarginPct(netMarginPct),
    perCategory,
    materialsBudgetGbp: job.materialsBudgetGbp,
    materialsSpentGbp: materialsSpent,
    materialsUsedPct,
    materialsWarn: materialsUsedPct > 85,
    labourBudgetGbp: labourBudget,
    labourSpentGbp: labourSpent,
    labourUsedPct
  };
}

export function receivedFromStages(stages: JobPaymentStage[]): number {
  return stages
    .filter((s) => s.status === "received")
    .reduce((sum, s) => sum + s.scheduledGbp, 0);
}

export function outstandingFromStages(stages: JobPaymentStage[]): number {
  return stages
    .filter((s) => s.status !== "received")
    .reduce((sum, s) => sum + s.scheduledGbp, 0);
}

export function formatGbp(v: number): string {
  const abs = Math.abs(v);
  const s = abs.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${v < 0 ? "−" : ""}£${s}`;
}
