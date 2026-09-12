// src/lib/nex-agent/learning-ledger.ts
//
// NEX1/2/3 continuous-teaching ledger (Wave E stub · in-memory · persisted to
// data/nex1-learning/ledger.json). Records every task's exercised skills +
// extracted patterns + captured anti-patterns.
//
// This is the founder-visible "the system is growing" surface. Every accepted
// diff levels a skill · every rejected diff records an anti-pattern · every
// clean apply becomes a pattern NEX1 can reuse.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

export type SkillLevel = "bronze" | "silver" | "gold" | "mythic";

export interface SkillEntry {
  readonly skill: string;         // e.g. "next-app-router" · "sql-migration" · "seo-metadata"
  readonly level: SkillLevel;
  readonly xp: number;             // 0..100 within current level
  readonly successes: number;
  readonly failures: number;
  readonly lastExercisedAt: string;
}

export interface PatternEntry {
  readonly id: string;             // sha256 of the diff
  readonly title: string;
  readonly skills: readonly string[];
  readonly capturedAt: string;
  readonly taskId: string;
  readonly reusedCount: number;
}

export interface AntiPatternEntry {
  readonly id: string;
  readonly title: string;
  readonly rejectionCode: string | null;
  readonly capturedAt: string;
  readonly taskId: string;
  readonly avoidedCount: number;
}

export interface LearningLedger {
  readonly skills: Record<string, SkillEntry>;
  readonly patterns: PatternEntry[];
  readonly antiPatterns: AntiPatternEntry[];
  readonly lastUpdated: string;
}

const LEVEL_XP: Record<SkillLevel, number> = { bronze: 0, silver: 40, gold: 75, mythic: 95 };

function ledgerPath(): string {
  return resolve(process.cwd(), "data/nex1-learning/ledger.json");
}

const EMPTY: LearningLedger = { skills: {}, patterns: [], antiPatterns: [], lastUpdated: new Date(0).toISOString() };

export function loadLedger(): LearningLedger {
  const p = ledgerPath();
  if (!existsSync(p)) return EMPTY;
  try { return { ...EMPTY, ...(JSON.parse(readFileSync(p, "utf8")) as LearningLedger) }; }
  catch { return EMPTY; }
}

export function saveLedger(l: LearningLedger): void {
  const p = ledgerPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ ...l, lastUpdated: new Date().toISOString() }, null, 2), "utf8");
}

/** Levels UP a skill on success · adds XP · promotes level when threshold hit. */
export function recordSkillSuccess(l: LearningLedger, skill: string, xpGain = 5): LearningLedger {
  const skills = { ...l.skills };
  const existing = skills[skill] ?? {
    skill, level: "bronze" as SkillLevel, xp: 0, successes: 0, failures: 0,
    lastExercisedAt: new Date().toISOString(),
  };
  const nextXp = Math.min(100, existing.xp + xpGain);
  const level = nextLevel(nextXp);
  skills[skill] = {
    ...existing,
    xp: level === existing.level ? nextXp : 0,
    level,
    successes: existing.successes + 1,
    lastExercisedAt: new Date().toISOString(),
  };
  return { ...l, skills };
}

/** Levels DOWN xp on failure · never demotes level. */
export function recordSkillFailure(l: LearningLedger, skill: string, xpLoss = 3): LearningLedger {
  const skills = { ...l.skills };
  const existing = skills[skill];
  if (!existing) return l;
  skills[skill] = {
    ...existing,
    xp: Math.max(0, existing.xp - xpLoss),
    failures: existing.failures + 1,
    lastExercisedAt: new Date().toISOString(),
  };
  return { ...l, skills };
}

function nextLevel(xp: number): SkillLevel {
  if (xp >= LEVEL_XP.mythic) return "mythic";
  if (xp >= LEVEL_XP.gold) return "gold";
  if (xp >= LEVEL_XP.silver) return "silver";
  return "bronze";
}

export function recordPattern(l: LearningLedger, p: Omit<PatternEntry, "reusedCount">): LearningLedger {
  const existing = l.patterns.find((x) => x.id === p.id);
  if (existing) {
    return { ...l, patterns: l.patterns.map((x) => x.id === p.id ? { ...x, reusedCount: x.reusedCount + 1 } : x) };
  }
  return { ...l, patterns: [...l.patterns, { ...p, reusedCount: 0 }] };
}

export function recordAntiPattern(l: LearningLedger, a: Omit<AntiPatternEntry, "avoidedCount">): LearningLedger {
  const existing = l.antiPatterns.find((x) => x.id === a.id);
  if (existing) {
    return { ...l, antiPatterns: l.antiPatterns.map((x) => x.id === a.id ? { ...x, avoidedCount: x.avoidedCount + 1 } : x) };
  }
  return { ...l, antiPatterns: [...l.antiPatterns, { ...a, avoidedCount: 0 }] };
}

/**
 * Compute a founder-facing weekly digest. Skills leveled up this week ·
 * patterns learned · anti-patterns avoided · session grade.
 */
export interface WeeklyDigest {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly skillsLevelledUp: readonly string[];
  readonly patternsLearned: number;
  readonly antiPatternsAvoided: number;
  readonly grade: "A+" | "A" | "B" | "C" | "no-data";
  readonly reasoning: string;
}

export function computeWeeklyDigest(l: LearningLedger, now = Date.now()): WeeklyDigest {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const start = new Date(now - WEEK_MS).toISOString();
  const end = new Date(now).toISOString();

  const skillList = Object.values(l.skills);
  const skillsThisWeek = skillList.filter((s) => new Date(s.lastExercisedAt).getTime() >= now - WEEK_MS);
  const leveledUp = skillsThisWeek.filter((s) => s.level !== "bronze").map((s) => `${s.skill} · ${s.level}`);

  const newPatterns = l.patterns.filter((p) => new Date(p.capturedAt).getTime() >= now - WEEK_MS).length;
  const avoided = l.antiPatterns.reduce((sum, a) => sum + a.avoidedCount, 0);

  let grade: WeeklyDigest["grade"] = "no-data";
  let reasoning = "No activity this week.";
  const totalSuccess = skillsThisWeek.reduce((s, x) => s + x.successes, 0);
  const totalFail = skillsThisWeek.reduce((s, x) => s + x.failures, 0);
  const totalActivity = totalSuccess + totalFail;
  if (totalActivity > 0) {
    const rate = totalSuccess / totalActivity;
    if (rate >= 0.95 && totalSuccess >= 10) { grade = "A+"; reasoning = `${totalSuccess} successful skill exercises · ${(rate * 100).toFixed(0)}% clean rate · ${leveledUp.length} skills advanced.`; }
    else if (rate >= 0.85) { grade = "A"; reasoning = `${totalSuccess} skill exercises · ${(rate * 100).toFixed(0)}% clean rate.`; }
    else if (rate >= 0.70) { grade = "B"; reasoning = `${totalSuccess}/${totalActivity} clean · anti-patterns being learned.`; }
    else { grade = "C"; reasoning = `${totalFail} failures out of ${totalActivity} · adjustments needed.`; }
  }

  return {
    windowStart: start,
    windowEnd: end,
    skillsLevelledUp: leveledUp,
    patternsLearned: newPatterns,
    antiPatternsAvoided: avoided,
    grade,
    reasoning,
  };
}
