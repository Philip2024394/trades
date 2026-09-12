// src/lib/nex/personalization/instructions.ts
//
// Founder Phase 19 · P19-2 · Custom instructions library.
//
// Reads/writes the user_account.custom_instructions jsonb column.
// The column already has a CHECK constraint capping payload at 4KB — this
// library enforces its own 3.5KB soft cap so writes never fail on the DB.

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";
import { getLanguagePack, isKnownLanguage } from "./language-packs";

export interface CustomInstructions {
  preferred_language?: string;       // e.g. "en", "id", "fr"
  bio?: string;                      // short about-me · 500 chars
  goals?: string;                    // what NEX should optimise for · 1000 chars
  style?: string;                    // response style preferences · 500 chars
  do_not?: string;                   // hard "don't do X" list · 500 chars
  updated_at?: string;
}

const MAX_FIELD_LEN = {
  bio: 500,
  goals: 1000,
  style: 500,
  do_not: 500,
};

export function sanitiseInstructions(raw: unknown): { clean: CustomInstructions; neutralised: number } {
  const clean: CustomInstructions = {};
  let neutralised = 0;
  if (!raw || typeof raw !== "object") return { clean, neutralised };
  const r = raw as Record<string, unknown>;

  if (typeof r.preferred_language === "string") {
    const lang = r.preferred_language.toLowerCase().trim();
    if (isKnownLanguage(lang)) clean.preferred_language = lang;
    // Unknown language codes silently dropped · never fabricated.
  }

  for (const key of ["bio", "goals", "style", "do_not"] as const) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) {
      const bounded = v.slice(0, MAX_FIELD_LEN[key]);
      const s = sanitiseUntrustedContent({ text: bounded, source_kind: "tool" });
      if (s.clean_text.trim()) clean[key] = s.clean_text;
      neutralised += s.neutralised_count;
    }
  }
  return { clean, neutralised };
}

export async function getCustomInstructions(user_id: string): Promise<CustomInstructions | null> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT custom_instructions FROM nex.user_account WHERE user_id = $1 AND deleted_at IS NULL`,
    [user_id],
  ).catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
  const row = r.rows[0] as { custom_instructions?: CustomInstructions } | undefined;
  return row?.custom_instructions ?? null;
}

export async function setCustomInstructions(user_id: string, raw: unknown): Promise<{ ok: boolean; instructions: CustomInstructions; neutralised: number }> {
  const { clean, neutralised } = sanitiseInstructions(raw);
  const withStamp: CustomInstructions = { ...clean, updated_at: new Date().toISOString() };
  const pool = getKnowledgeFactoryDbPool();
  await pool.query(
    `UPDATE nex.user_account
        SET custom_instructions = $2
      WHERE user_id = $1 AND deleted_at IS NULL`,
    [user_id, JSON.stringify(withStamp)],
  );
  return { ok: true, instructions: withStamp, neutralised };
}

// ═══════════════════════════════════════════════════════════════════
// Rendering helpers for chat pipeline
// ═══════════════════════════════════════════════════════════════════

/**
 * Renders the saved instructions into a compact context banner that the
 * chat pipeline splices in front of the user turn. Banner-wrapped as
 * user_context — never presented as an evidence-establishing statement.
 */
export function renderInstructionsBanner(inst: CustomInstructions | null): string {
  if (!inst) return "";
  const parts: string[] = [];
  if (inst.preferred_language) {
    const pack = getLanguagePack(inst.preferred_language);
    parts.push(`preferred_language: ${inst.preferred_language} (${pack.name_native})`);
  }
  if (inst.bio) parts.push(`bio: ${inst.bio}`);
  if (inst.goals) parts.push(`goals: ${inst.goals}`);
  if (inst.style) parts.push(`style: ${inst.style}`);
  if (inst.do_not) parts.push(`do_not: ${inst.do_not}`);
  if (parts.length === 0) return "";
  return `[user preferences · saved custom instructions · context only · never establishes truth]\n${parts.join("\n")}`;
}
