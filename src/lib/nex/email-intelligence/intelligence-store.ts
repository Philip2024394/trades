// src/lib/nex/email-intelligence/intelligence-store.ts
//
// NEX Email Intelligence · persistence layer.
// Reads/writes nex.email_verification + nex.domain_intelligence.
// Every write derived from a REAL SMTP verify outcome. Never fabricated.

import type { PoolClient } from "pg";
import type { VerifyOutcome } from "./smtp-verify";

export async function recordVerification(
  client: PoolClient,
  outcome: VerifyOutcome,
  actor: string,
): Promise<void> {
  await client.query(
    `INSERT INTO nex.email_verification
       (email_address, domain, deliverable, mx_host, mx_preference,
        smtp_greeting, rcpt_code, rcpt_response,
        catch_all_probe_local, catch_all_probe_code, catch_all_probe_response,
        connect_ms, total_ms, verified_at, verifier_actor, error_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (email_address) DO UPDATE SET
       deliverable            = EXCLUDED.deliverable,
       mx_host                = EXCLUDED.mx_host,
       mx_preference          = EXCLUDED.mx_preference,
       smtp_greeting          = EXCLUDED.smtp_greeting,
       rcpt_code              = EXCLUDED.rcpt_code,
       rcpt_response          = EXCLUDED.rcpt_response,
       catch_all_probe_local  = EXCLUDED.catch_all_probe_local,
       catch_all_probe_code   = EXCLUDED.catch_all_probe_code,
       catch_all_probe_response = EXCLUDED.catch_all_probe_response,
       connect_ms             = EXCLUDED.connect_ms,
       total_ms               = EXCLUDED.total_ms,
       verified_at            = EXCLUDED.verified_at,
       verifier_actor         = EXCLUDED.verifier_actor,
       error_reason           = EXCLUDED.error_reason,
       attempt_count          = nex.email_verification.attempt_count + 1`,
    [
      outcome.email_address, outcome.domain, outcome.deliverable, outcome.mx_host, outcome.mx_preference,
      outcome.smtp_greeting, outcome.rcpt_code, outcome.rcpt_response,
      outcome.catch_all_probe_local, outcome.catch_all_probe_code, outcome.catch_all_probe_response,
      outcome.connect_ms, outcome.total_ms, outcome.verified_at, actor, outcome.error_reason,
    ],
  );

  // Update domain intelligence incrementally
  const local = outcome.email_address.split("@")[0];
  await client.query(
    `INSERT INTO nex.domain_intelligence
       (domain, mx_host, addresses_seen, addresses_verified,
        addresses_deliverable, addresses_undeliverable, addresses_risky, addresses_unknown,
        is_catch_all, known_patterns, last_verified_at, last_updated_at)
     VALUES ($1, $2, 1, 1,
       CASE WHEN $3 = 'deliverable' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'undeliverable' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'risky' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'unknown' THEN 1 ELSE 0 END,
       CASE WHEN $3 = 'catch_all' THEN TRUE ELSE NULL END,
       ARRAY[$4]::TEXT[],
       now(), now())
     ON CONFLICT (domain) DO UPDATE SET
       mx_host                = COALESCE(EXCLUDED.mx_host, nex.domain_intelligence.mx_host),
       addresses_seen         = nex.domain_intelligence.addresses_seen + 1,
       addresses_verified     = nex.domain_intelligence.addresses_verified + 1,
       addresses_deliverable  = nex.domain_intelligence.addresses_deliverable +
                                 (CASE WHEN $3 = 'deliverable' THEN 1 ELSE 0 END),
       addresses_undeliverable= nex.domain_intelligence.addresses_undeliverable +
                                 (CASE WHEN $3 = 'undeliverable' THEN 1 ELSE 0 END),
       addresses_risky        = nex.domain_intelligence.addresses_risky +
                                 (CASE WHEN $3 = 'risky' THEN 1 ELSE 0 END),
       addresses_unknown      = nex.domain_intelligence.addresses_unknown +
                                 (CASE WHEN $3 = 'unknown' THEN 1 ELSE 0 END),
       is_catch_all           = CASE
                                  WHEN $3 = 'catch_all' THEN TRUE
                                  ELSE nex.domain_intelligence.is_catch_all
                                END,
       known_patterns         = (
         SELECT ARRAY(SELECT DISTINCT unnest(nex.domain_intelligence.known_patterns || ARRAY[$4]::TEXT[]))
       ),
       last_verified_at       = now(),
       last_updated_at        = now()`,
    [outcome.domain, outcome.mx_host, outcome.deliverable, local],
  );
}

export const _INTELLIGENCE_STORE_NEVER_FABRICATES = "every_write_traces_back_to_a_real_verify_outcome";
