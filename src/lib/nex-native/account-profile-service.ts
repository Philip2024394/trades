// src/lib/nex-native/account-profile-service.ts
//
// Bridge 2 · authoritative service for nex_account_profile · migration 042.
// -------------------------------------------------------------------------
// One-to-one with nex_account. Additive; nex_account itself is untouched.
// Doctrine:
//   · Identity Doctrine · every FK is nex_account.id (UUID)
//   · Source-of-truth Doctrine · this is the ONLY profile store · no parallel
//     professional/skills/identity tables
//   · Separation Doctrine · profile ≠ relationship ≠ conversation ≠ business
//   · Honest Baseline · service layer validates before hitting DB so we
//     surface app-level errors before Supabase rejects at the CHECK

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexAccountKind,
  NexAccountProfileInsert,
  NexAccountProfilePatch,
  NexAccountProfileRow,
  NexDailyActivity,
  NexDailyActivityDetail,
  NexUuid,
} from "./types";
import {
  NEX_ACCOUNT_KINDS,
  NEX_DAILY_ACTIVITIES,
  NEX_PROFILE_ARRAY_ELEMENT_MAX,
  NEX_PROFILE_BIO_MAX,
  NEX_PROFILE_HEADLINE_MAX,
  NEX_PROFILE_LOCATION_LABEL_MAX,
  NEX_PROFILE_LOOKING_FOR_MAX,
  NEX_PROFILE_PROFESSION_MAX,
  NEX_PROFILE_SKILLS_MAX,
} from "./types";

export const NEX_AVATAR_BUCKET = "nex-avatars";
export const NEX_AVATAR_MAX_URL_LENGTH = 2048;

const KIND_SET = new Set<NexAccountKind>(NEX_ACCOUNT_KINDS);
const DAILY_ACTIVITY_SET = new Set<NexDailyActivity>(NEX_DAILY_ACTIVITIES);

function assertKind(k: unknown): NexAccountKind | null {
  if (k === null || k === undefined || k === "") return null;
  if (typeof k !== "string" || !KIND_SET.has(k as NexAccountKind)) {
    throw new Error(
      `account-profile-service: unknown kind '${String(k).slice(0, 40)}' · allowed: ${NEX_ACCOUNT_KINDS.join(", ")}`,
    );
  }
  return k as NexAccountKind;
}

/** Bridge 39 · validates daily_activity is one of the enum members
 *  or null. Empty string treated as null so a "clear" from the form
 *  survives the round-trip. */
function assertDailyActivity(k: unknown): NexDailyActivity | null {
  if (k === null || k === undefined || k === "" || k === "unset") return null;
  if (typeof k !== "string" || !DAILY_ACTIVITY_SET.has(k as NexDailyActivity)) {
    throw new Error(
      `account-profile-service: unknown daily_activity '${String(k).slice(0, 40)}' · allowed: ${NEX_DAILY_ACTIVITIES.join(", ")}`,
    );
  }
  return k as NexDailyActivity;
}

/** Bridge 39 · sanitises the follow-up jsonb · caps every string
 *  field at 200 chars and drops empty values so the DB row stays
 *  compact. Unknown keys are dropped (we only persist the known
 *  shape). Never returns null · always an object. */
const DAILY_ACTIVITY_DETAIL_KEYS: readonly (keyof NexDailyActivityDetail)[] = [
  "field_of_study",
  "institution",
  "year",
  "business",
  "industry",
  "company",
  "role",
  "seeking",
  "since_month",
  "note",
];
function sanitiseDailyActivityDetail(v: unknown): NexDailyActivityDetail {
  if (v === null || v === undefined) return {};
  if (typeof v !== "object" || Array.isArray(v)) {
    throw new Error(
      "account-profile-service: daily_activity_detail must be a plain object",
    );
  }
  const source = v as Record<string, unknown>;
  const out: NexDailyActivityDetail = {};
  for (const key of DAILY_ACTIVITY_DETAIL_KEYS) {
    const raw = source[key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (typeof raw !== "string") {
      throw new Error(
        `account-profile-service: daily_activity_detail.${key} must be a string`,
      );
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.length > 200) {
      throw new Error(
        `account-profile-service: daily_activity_detail.${key} max 200 chars · got ${trimmed.length}`,
      );
    }
    out[key] = trimmed;
  }
  return out;
}

function normaliseText(v: unknown, max: number, label: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") {
    throw new Error(`account-profile-service: ${label} must be a string`);
  }
  const t = v.trim();
  if (t.length === 0) return null;
  if (t.length > max) {
    throw new Error(
      `account-profile-service: ${label} too long · max ${max} · got ${t.length}`,
    );
  }
  return t;
}

function normaliseArray(v: unknown, maxItems: number, label: string): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) {
    throw new Error(`account-profile-service: ${label} must be an array`);
  }
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (t.length === 0) continue;
    if (t.length > NEX_PROFILE_ARRAY_ELEMENT_MAX) {
      throw new Error(
        `account-profile-service: ${label} entry too long · max ${NEX_PROFILE_ARRAY_ELEMENT_MAX} · got ${t.length}`,
      );
    }
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(t);
  }
  if (cleaned.length > maxItems) {
    throw new Error(
      `account-profile-service: ${label} too many items · max ${maxItems} · got ${cleaned.length}`,
    );
  }
  return cleaned;
}

/** Read one profile by account_id · returns null when no row exists. */
export async function getProfileByAccountId(
  accountId: NexUuid,
): Promise<NexAccountProfileRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `account-profile-service.getProfileByAccountId: ${error.message}`,
    );
  }
  return (data as NexAccountProfileRow) ?? null;
}

/** Insert a new profile row. Throws if one already exists (PK constraint). */
export async function insertProfile(
  input: NexAccountProfileInsert,
): Promise<NexAccountProfileRow> {
  const payload = {
    account_id: input.account_id,
    kind: assertKind(input.kind ?? null),
    headline: normaliseText(input.headline, NEX_PROFILE_HEADLINE_MAX, "headline"),
    bio: normaliseText(input.bio, NEX_PROFILE_BIO_MAX, "bio"),
    profession: normaliseText(input.profession, NEX_PROFILE_PROFESSION_MAX, "profession"),
    skills: normaliseArray(input.skills, NEX_PROFILE_SKILLS_MAX, "skills"),
    location_label: normaliseText(input.location_label, NEX_PROFILE_LOCATION_LABEL_MAX, "location_label"),
    looking_for: normaliseArray(input.looking_for, NEX_PROFILE_LOOKING_FOR_MAX, "looking_for"),
    is_public: input.is_public ?? true,
    // Phase 3A · migration 134 · public-discovery opt-in. Default
    // false at both the DB and the service layer · owner must set
    // true explicitly through Settings.
    is_discoverable: input.is_discoverable ?? false,
    avatar_url: normaliseText(input.avatar_url, NEX_AVATAR_MAX_URL_LENGTH, "avatar_url"),
    daily_activity: assertDailyActivity(input.daily_activity ?? null),
    daily_activity_detail: sanitiseDailyActivityDetail(input.daily_activity_detail ?? {}),
    avatar_face_verified: input.avatar_face_verified ?? false,
  };
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-profile-service.insertProfile: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccountProfileRow;
}

/** Update an existing profile row · every field optional · unchanged fields
 *  are left as-is. Throws when no row exists (call insertProfile first). */
export async function updateProfile(
  accountId: NexUuid,
  patch: NexAccountProfilePatch,
): Promise<NexAccountProfileRow> {
  const update: Record<string, unknown> = {};
  if ("kind" in patch) update.kind = assertKind(patch.kind ?? null);
  if ("headline" in patch) update.headline = normaliseText(patch.headline, NEX_PROFILE_HEADLINE_MAX, "headline");
  if ("bio" in patch) update.bio = normaliseText(patch.bio, NEX_PROFILE_BIO_MAX, "bio");
  if ("profession" in patch) update.profession = normaliseText(patch.profession, NEX_PROFILE_PROFESSION_MAX, "profession");
  if ("skills" in patch) update.skills = normaliseArray(patch.skills, NEX_PROFILE_SKILLS_MAX, "skills");
  if ("location_label" in patch) update.location_label = normaliseText(patch.location_label, NEX_PROFILE_LOCATION_LABEL_MAX, "location_label");
  if ("looking_for" in patch) update.looking_for = normaliseArray(patch.looking_for, NEX_PROFILE_LOOKING_FOR_MAX, "looking_for");
  if ("is_public" in patch) update.is_public = patch.is_public;
  // Phase 3A · migration 134 · explicit opt-in · never derived.
  if ("is_discoverable" in patch) update.is_discoverable = !!patch.is_discoverable;
  if ("avatar_url" in patch) update.avatar_url = normaliseText(patch.avatar_url, NEX_AVATAR_MAX_URL_LENGTH, "avatar_url");
  if ("daily_activity" in patch) update.daily_activity = assertDailyActivity(patch.daily_activity ?? null);
  if ("daily_activity_detail" in patch) update.daily_activity_detail = sanitiseDailyActivityDetail(patch.daily_activity_detail ?? {});
  if ("avatar_face_verified" in patch) update.avatar_face_verified = patch.avatar_face_verified;

  if (Object.keys(update).length === 0) {
    const current = await getProfileByAccountId(accountId);
    if (!current) {
      throw new Error(
        `account-profile-service.updateProfile: no profile exists for account ${accountId}`,
      );
    }
    return current;
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .update(update)
    .eq("account_id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `account-profile-service.updateProfile: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccountProfileRow;
}

/** Upsert convenience · used by the onboarding "kind" step so the caller
 *  doesn't need to know whether a profile row already exists.
 *  When creating: applies defaults. When updating: only the given fields. */
export async function upsertProfile(
  accountId: NexUuid,
  patch: NexAccountProfilePatch,
): Promise<NexAccountProfileRow> {
  const existing = await getProfileByAccountId(accountId);
  if (existing) {
    return updateProfile(accountId, patch);
  }
  return insertProfile({ account_id: accountId, ...patch });
}
