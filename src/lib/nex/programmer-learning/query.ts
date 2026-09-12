// src/lib/nex/programmer-learning/query.ts
//
// NEX Programmer Agent · Phase A · retrieval / query
// Philip 2026-09-05 · AUTHORIZE §13
//
// Phase A does NOT need sophisticated semantic retrieval. It needs:
//   · basic filters (domain, technology, verification_state, timestamp)
//   · every result carrying provenance (so callers cannot "forget" it)
//   · deterministic ordering (newest first · so retrieval of "current"
//     records aligns with append-only supersession)
//
// Retrieval NEVER hallucinates · NEVER summarizes · returns records
// as stored. Consumers (e.g. a future Programmer Agent v1) are
// responsible for interpretation and MUST cite the returned provenance
// when they use these records.

import {
  readEvents,
  readKnowledge,
  readSkills,
  readExperiences,
  readLearningRuns,
} from "./store";
import type {
  EngineeringEvent,
  EngineeringEventKind,
  KnowledgeItem,
  SkillItem,
  ExperienceItem,
  LearningRun,
  VerificationState,
  ExperienceOutcome,
  SkillPromotionState,
  AuthorityTier,
} from "./types";

// ─── Filter shapes ───────────────────────────────────────────────

export type EventFilter = {
  kind?: EngineeringEventKind | EngineeringEventKind[];
  task_contains?: string;
  project?: string;
  since_iso?: string;
  status?: VerificationState;
};

export type KnowledgeFilter = {
  domain?: string;
  technology?: string;
  verification_status?: VerificationState;
  authority_tier?: AuthorityTier;
  statement_contains?: string;
  source_url?: string;
  include_superseded?: boolean;   // default false
};

export type SkillFilter = {
  domain?: string;
  promotion_state?: SkillPromotionState;
  name_contains?: string;
};

export type ExperienceFilter = {
  outcome?: ExperienceOutcome;
  task_contains?: string;
  files_involved_contains?: string;
  since_iso?: string;
};

// ─── Query functions ─────────────────────────────────────────────

export function queryEvents(filter: EventFilter = {}): EngineeringEvent[] {
  const kinds = Array.isArray(filter.kind) ? new Set(filter.kind) : filter.kind ? new Set([filter.kind]) : null;
  return readEvents()
    .filter((e) => !kinds || kinds.has(e.kind))
    .filter((e) => !filter.task_contains || (e.task ?? "").toLowerCase().includes(filter.task_contains.toLowerCase()))
    .filter((e) => !filter.project || e.project === filter.project)
    .filter((e) => !filter.since_iso || e.timestamp >= filter.since_iso)
    .filter((e) => !filter.status || e.status === filter.status)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function queryKnowledge(filter: KnowledgeFilter = {}): KnowledgeItem[] {
  const includeSuperseded = filter.include_superseded === true;
  return readKnowledge()
    .filter((k) => includeSuperseded || k.verification_status !== "SUPERSEDED")
    .filter((k) => !filter.domain || k.domain === filter.domain)
    .filter((k) => !filter.technology || k.technology === filter.technology)
    .filter((k) => !filter.verification_status || k.verification_status === filter.verification_status)
    .filter((k) => !filter.authority_tier || k.provenance.authority_tier === filter.authority_tier)
    .filter((k) => !filter.source_url || k.provenance.source_url === filter.source_url)
    .filter((k) => !filter.statement_contains || k.statement.toLowerCase().includes(filter.statement_contains.toLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function querySkills(filter: SkillFilter = {}): SkillItem[] {
  return readSkills()
    .filter((s) => !filter.domain || s.domain === filter.domain)
    .filter((s) => !filter.promotion_state || s.promotion_state === filter.promotion_state)
    .filter((s) => !filter.name_contains || s.name.toLowerCase().includes(filter.name_contains.toLowerCase()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function queryExperiences(filter: ExperienceFilter = {}): ExperienceItem[] {
  return readExperiences()
    .filter((e) => !filter.outcome || e.outcome === filter.outcome)
    .filter((e) => !filter.task_contains || e.task.toLowerCase().includes(filter.task_contains.toLowerCase()))
    .filter((e) => !filter.files_involved_contains
      || e.files_involved.some((f) => f.toLowerCase().includes(filter.files_involved_contains!.toLowerCase())))
    .filter((e) => !filter.since_iso || e.timestamp >= filter.since_iso)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Learning run enumeration (for §19 evidence access) ──────────

export function listLearningRuns(): LearningRun[] {
  return readLearningRuns().sort((a, b) => b.started_at.localeCompare(a.started_at));
}

// ─── Aggregate stats (for a future health verifier) ──────────────

export type LearningStats = {
  events_total: number;
  events_by_kind: Record<string, number>;
  knowledge_total: number;
  knowledge_by_status: Record<string, number>;
  knowledge_by_tier: Record<string, number>;
  skills_total: number;
  skills_by_promotion: Record<string, number>;
  experiences_total: number;
  experiences_by_outcome: Record<string, number>;
  learning_runs_total: number;
  latest_event_timestamp: string | null;
  latest_experience_timestamp: string | null;
};

export function computeLearningStats(): LearningStats {
  const events = readEvents();
  const knowledge = readKnowledge();
  const skills = readSkills();
  const experiences = readExperiences();
  const runs = readLearningRuns();
  const bucket = <T extends string>(items: readonly { [K in string]: unknown }[], key: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const it of items) {
      const v = String((it as Record<string, unknown>)[key] ?? "unknown");
      out[v] = (out[v] ?? 0) + 1;
    }
    return out;
  };
  return {
    events_total: events.length,
    events_by_kind: bucket(events, "kind"),
    knowledge_total: knowledge.length,
    knowledge_by_status: bucket(knowledge, "verification_status"),
    knowledge_by_tier: bucket(knowledge.map((k) => ({ tier: k.provenance.authority_tier })), "tier"),
    skills_total: skills.length,
    skills_by_promotion: bucket(skills, "promotion_state"),
    experiences_total: experiences.length,
    experiences_by_outcome: bucket(experiences, "outcome"),
    learning_runs_total: runs.length,
    latest_event_timestamp: events.length ? events[events.length - 1].timestamp : null,
    latest_experience_timestamp: experiences.length ? experiences[experiences.length - 1].timestamp : null,
  };
}
