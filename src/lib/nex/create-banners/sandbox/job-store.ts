// src/lib/nex/create-banners/sandbox/job-store.ts
//
// NEX Create Banners · Sandbox in-memory job store · 2026-09-23
// =============================================================
// Deliberately in-memory only. Sandbox jobs are ephemeral demonstration
// runs · they don't belong in the production DB / manifest.

import type { BannerFormatId } from "../formats";

export interface SandboxVariantResult {
  readonly variant_id: string;
  readonly format_id: BannerFormatId;
  readonly seed: number;
  state: SandboxVariantState;
  raw_generation_relative_path: string | null;
  composed_relative_path: string | null;
  composed_public_url: string | null;
  duration_ms: number | null;
  failure_reason: string | null;
  raw_sha256: string | null;
  composed_sha256: string | null;
  model_weights_sha256_fingerprint: string | null;
}

export type SandboxVariantState =
  | "queued"
  | "generating"
  | "composing"
  | "complete"
  | "failed";

export interface SandboxJob {
  readonly job_id: string;
  readonly created_at: string;
  readonly campaign_summary: {
    readonly business_display_name: string;
    readonly product_or_service_label: string;
    readonly campaign_objective: string;
    readonly headline: string;
    readonly cta: string;
  };
  readonly total_variants: number;
  state: "created" | "running" | "complete" | "failed";
  started_at: string | null;
  completed_at: string | null;
  variants: SandboxVariantResult[];
  quality_status: "UNPROVEN";
  publication_allowed: false;
  reference_sha256_used: string;
}

const jobs = new Map<string, SandboxJob>();

export function putJob(job: SandboxJob): void {
  jobs.set(job.job_id, job);
}

export function getJob(jobId: string): SandboxJob | null {
  return jobs.get(jobId) ?? null;
}

export function listJobs(): readonly SandboxJob[] {
  return Array.from(jobs.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );
}
