// src/lib/nex-agent/learning-ledger.test.ts

import { describe, it, expect } from "vitest";
import {
  recordSkillSuccess,
  recordSkillFailure,
  recordPattern,
  recordAntiPattern,
  computeWeeklyDigest,
  type LearningLedger,
} from "./learning-ledger";

const EMPTY: LearningLedger = { skills: {}, patterns: [], antiPatterns: [], lastUpdated: "2026-01-01T00:00:00Z" };

describe("skill leveling", () => {
  it("first success starts bronze", () => {
    const l = recordSkillSuccess(EMPTY, "next-router");
    expect(l.skills["next-router"].level).toBe("bronze");
    expect(l.skills["next-router"].xp).toBe(5);
    expect(l.skills["next-router"].successes).toBe(1);
  });

  it("accumulates xp until silver at 40", () => {
    let l = EMPTY;
    for (let i = 0; i < 8; i++) l = recordSkillSuccess(l, "sql-migration");
    // 8 * 5 = 40 · silver threshold
    expect(l.skills["sql-migration"].level).toBe("silver");
  });

  it("gold at 75", () => {
    let l = EMPTY;
    for (let i = 0; i < 15; i++) l = recordSkillSuccess(l, "seo-metadata");
    expect(l.skills["seo-metadata"].level).toBe("gold");
  });

  it("mythic at 95", () => {
    let l = EMPTY;
    for (let i = 0; i < 19; i++) l = recordSkillSuccess(l, "workstation-ui");
    expect(l.skills["workstation-ui"].level).toBe("mythic");
  });

  it("failure reduces xp but not level", () => {
    let l = EMPTY;
    for (let i = 0; i < 8; i++) l = recordSkillSuccess(l, "test-skill"); // reaches silver
    l = recordSkillFailure(l, "test-skill");
    expect(l.skills["test-skill"].level).toBe("silver"); // never demotes
    expect(l.skills["test-skill"].failures).toBe(1);
  });
});

describe("patterns · anti-patterns", () => {
  it("records a pattern once", () => {
    const l = recordPattern(EMPTY, {
      id: "pat-1", title: "Add page.tsx with metadata", skills: ["next-router"],
      capturedAt: new Date().toISOString(), taskId: "task-1",
    });
    expect(l.patterns.length).toBe(1);
    expect(l.patterns[0].reusedCount).toBe(0);
  });

  it("increments reused count on repeat", () => {
    let l = recordPattern(EMPTY, { id: "pat-2", title: "x", skills: [], capturedAt: "", taskId: "" });
    l = recordPattern(l, { id: "pat-2", title: "x", skills: [], capturedAt: "", taskId: "" });
    l = recordPattern(l, { id: "pat-2", title: "x", skills: [], capturedAt: "", taskId: "" });
    expect(l.patterns[0].reusedCount).toBe(2);
  });

  it("anti-pattern accumulates avoided count", () => {
    let l = recordAntiPattern(EMPTY, { id: "anti-1", title: "innerHTML", rejectionCode: "sec.bug_xss_unescaped", capturedAt: "", taskId: "" });
    l = recordAntiPattern(l, { id: "anti-1", title: "innerHTML", rejectionCode: "sec.bug_xss_unescaped", capturedAt: "", taskId: "" });
    expect(l.antiPatterns.length).toBe(1);
    expect(l.antiPatterns[0].avoidedCount).toBe(1);
  });
});

describe("computeWeeklyDigest", () => {
  it("no data yields no-data grade", () => {
    const d = computeWeeklyDigest(EMPTY);
    expect(d.grade).toBe("no-data");
  });

  it("A+ when >=10 exercises and >=95% clean", () => {
    let l = EMPTY;
    for (let i = 0; i < 20; i++) l = recordSkillSuccess(l, "skill-a");
    // 20 successes · 0 failures = 100% clean
    const d = computeWeeklyDigest(l);
    expect(d.grade).toBe("A+");
  });

  it("B when 70-85% clean", () => {
    let l = EMPTY;
    for (let i = 0; i < 15; i++) l = recordSkillSuccess(l, "skill-b");
    for (let i = 0; i < 5; i++) l = recordSkillFailure(l, "skill-b");
    // 15/20 = 75%
    const d = computeWeeklyDigest(l);
    expect(d.grade).toBe("B");
  });

  it("skillsLevelledUp lists non-bronze skills", () => {
    let l = EMPTY;
    for (let i = 0; i < 10; i++) l = recordSkillSuccess(l, "skill-c"); // silver at 40xp
    const d = computeWeeklyDigest(l);
    expect(d.skillsLevelledUp.some((s) => s.includes("silver"))).toBe(true);
  });
});
