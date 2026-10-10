// src/lib/nex-native/safechat/classification-logger.ts
//
// NEX SafeChat Phase 1 · classification logger.
// Writes a single append-only row to nex.safechat_classification per
// hook invocation.
//
// Load-bearing invariants (enforced here · tested in logger.test.ts
// AND privacy-audit.test.ts):
//   · simulated=TRUE at every write · Phase 1 is instrumentation only.
//   · visibility_to_guardian=FALSE at every write · Phase 3+ flip
//     requires explicit founder sign-off.
//   · classifier_version comes from the classifier result · not caller.
//   · Errors are swallowed and logged · logClassification NEVER throws
//     out to the caller (the hook is already fire-and-forget but we
//     double-belt the invariant here).
//
// PRIVACY REDACTION (sealed 2026-10-10 Privacy Audit):
//   · rule_matches entries of kind "pattern" carry a `matchedText` field
//     which is a direct substring of the sender's message body. That
//     substring would be a body-text leak if persisted · the logger
//     redacts it to "[redacted]" before INSERT. Pattern IDs, signal
//     types, severities, and languages are all retained (none of them
//     derive from the message body). The signal aggregator does NOT
//     read matchedText so this redaction is lossless for downstream
//     consumers.
//   · Error paths are scrubbed · no catch-handler logs the input
//     payload (which would contain classification.ruleMatches with its
//     original matchedText, plus the message_ref · which is opaque).
//   · The INSERT NEVER binds the raw message body as a parameter.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type { ClassificationResult, RuleMatchEntry } from "./types";

export interface LogClassificationInput {
  readonly messageRef: string;
  readonly senderAccountId: string;
  readonly recipientAccountId: string;
  readonly conversationId: string | null;
  readonly classification: ClassificationResult;
}

export interface LogClassificationResult {
  readonly classificationId: string | null;
  readonly written: boolean;
}

/** Enforced constants · never override. */
export const SAFECHAT_SIMULATED_PHASE_1 = true as const;
export const SAFECHAT_VISIBILITY_TO_GUARDIAN_PHASE_1 = false as const;

/** Sentinel string that replaces body-derived substrings in persisted
 *  rule_matches. Load-bearing · the privacy audit greps for this. */
export const SAFECHAT_REDACTED_MATCHED_TEXT = "[redacted]" as const;

/** Strip body-derived substrings from rule_matches before persistence.
 *  Only `matchedText` on pattern entries is body-derived · everything
 *  else (termId, patternId, category, signalType, severity, language,
 *  the dictionary `term`) is sourced from the vocabulary / pattern
 *  tables and is NOT a body-text leak. */
export function redactRuleMatchesForPersistence(
  ruleMatches: readonly RuleMatchEntry[],
): readonly RuleMatchEntry[] {
  return ruleMatches.map((m) => {
    if (m.kind === "pattern" && typeof m.matchedText === "string") {
      return { ...m, matchedText: SAFECHAT_REDACTED_MATCHED_TEXT };
    }
    return m;
  });
}

export async function logClassification(
  input: LogClassificationInput,
): Promise<LogClassificationResult> {
  const redactedRuleMatches = redactRuleMatchesForPersistence(
    input.classification.ruleMatches,
  );
  const result = await withClient(async (client) => {
    const r = await client.query(
      `INSERT INTO nex.safechat_classification
         (message_ref,
          sender_account_id,
          recipient_account_id,
          conversation_id,
          level,
          confidence,
          rule_matches,
          language_detected,
          signals,
          visibility_to_guardian,
          simulated,
          classifier_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10, $11, $12)
       RETURNING classification_id::text`,
      [
        input.messageRef,
        input.senderAccountId,
        input.recipientAccountId,
        input.conversationId,
        input.classification.level,
        input.classification.confidence,
        JSON.stringify(redactedRuleMatches),
        input.classification.languageDetected,
        JSON.stringify(input.classification.signals),
        SAFECHAT_VISIBILITY_TO_GUARDIAN_PHASE_1,
        SAFECHAT_SIMULATED_PHASE_1,
        input.classification.classifierVersion,
      ],
    );
    if ((r.rowCount ?? 0) === 1) {
      return String((r.rows[0] as { classification_id: string }).classification_id);
    }
    return null;
  }).catch((err) => {
    // Privacy: this handler intentionally logs ONLY the error message,
    // never the input payload (which would carry classification.ruleMatches
    // with its original matchedText).
    // eslint-disable-next-line no-console
    console.warn(
      `[safechat.logger] soft-fail · ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  });

  if (typeof result === "string") {
    return { classificationId: result, written: true };
  }
  return { classificationId: null, written: false };
}
