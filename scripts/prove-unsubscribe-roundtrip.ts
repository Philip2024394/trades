// scripts/prove-unsubscribe-roundtrip.ts
//
// E2 · Consent round-trip runtime trace.
//
// Proves the unsubscribe path end-to-end against local Postgres:
//   1. Insert a burner contact into nex.contacts (compliance_state='allowed')
//   2. Confirm gate returns allowed:true for a marketing send BEFORE unsub
//   3. Call applyCanonicalEvent({ event_type: 'unsubscribed', ... })
//   4. Re-read the contact via getContactCompliance()
//   5. Pass to checkNotificationCompliance and assert allowed:false, reason:'unsubscribed'
//   6. Cleanup: delete compliance_events rows + delete contact snapshot
//
// USAGE
//   npx tsx --env-file=.env.local scripts/prove-unsubscribe-roundtrip.ts
//
// EXIT CODES
//   0 · PASS
//   2 · FAIL (assertion did not hold)
//   1 · runner exception

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { applyCanonicalEvent, getContactCompliance } from "@/lib/nex/compliance/engine";
import { checkNotificationCompliance } from "@/lib/nex/notifications/compliance";
import type { AnalyticsEvent } from "@/lib/nex/compliance/types";

async function main(): Promise<void> {
  const pgUrl = process.env.NEX_POSTGRES_URL;
  if (!pgUrl) throw new Error("NEX_POSTGRES_URL not set");
  const pool = new Pool({ connectionString: pgUrl, max: 2 });

  // contact_id must be UUID-shaped because nex.compliance_events.contact_id is UUID
  // (nex.contacts.contact_id is TEXT but is UUID-populated in practice per connector code)
  const contact_id = randomUUID();
  const email = `unsub-probe-${Date.now()}-${contact_id.slice(0, 8)}@example.invalid`;

  console.log(`probe contact_id: ${contact_id}`);

  try {
    // ── 1 · Insert burner contact
    await pool.query(
      `INSERT INTO nex.contacts (contact_id, email, name, kind, source, source_ref,
                                 consent_marketing, consent_transactional, consent_source,
                                 compliance_state, updated_at)
       VALUES ($1, $2, $3, 'individual', 'manual', 'unsub-probe',
               TRUE, TRUE, 'probe',
               'allowed', NOW())`,
      [contact_id, email, "Unsub Probe"],
    );
    console.log("step 1 · burner contact inserted");

    // ── 2 · Assert allowed BEFORE unsubscribe
    const preRaw = await getContactCompliance(contact_id);
    if (!preRaw) throw new Error("could not read burner contact back");
    const preGate = checkNotificationCompliance(
      { email: preRaw.email, never_contact: preRaw.never_contact, unsubscribe_at: preRaw.unsubscribe_at,
        consent_marketing: true, consent_transactional: true },
      "email", "marketing", email,
    );
    if (!preGate.allowed) throw new Error(`expected allowed:true pre-unsubscribe, got: ${JSON.stringify(preGate)}`);
    console.log("step 2 · pre-unsubscribe gate allows marketing send · OK");

    // ── 3 · Fire the unsubscribe event
    const ev: AnalyticsEvent = {
      event_type: "unsubscribed",
      recipient_id: contact_id,
      provider: "test-provider",
      provider_message_id: `probe-msg-${Date.now()}`,
      campaign_id: null,
      timestamp: new Date().toISOString(),
      metadata: { reason: "roundtrip-probe" },
    };
    const outcome = await applyCanonicalEvent(ev, null);
    if (!outcome || outcome.event_type !== "unsubscribed" || outcome.new_state !== "unsubscribed") {
      throw new Error(`unsubscribe event did not apply cleanly: ${JSON.stringify(outcome)}`);
    }
    console.log(`step 3 · applyCanonicalEvent · ${outcome.event_type} → ${outcome.new_state}`);

    // ── 4 · Re-read state
    const post = await getContactCompliance(contact_id);
    if (!post) throw new Error("post-unsubscribe read returned null");
    if (post.compliance_state !== "unsubscribed") throw new Error(`expected compliance_state=unsubscribed, got ${post.compliance_state}`);
    if (!post.unsubscribe_at) throw new Error("unsubscribe_at was not set");
    if (post.never_contact !== true) throw new Error("never_contact was not raised to true");
    console.log(`step 4 · post-unsubscribe state · state=${post.compliance_state} · never_contact=${post.never_contact} · unsubscribe_at=${post.unsubscribe_at}`);

    // ── 5 · Assert gate blocks the next send
    const postGate = checkNotificationCompliance(
      { email: post.email, never_contact: post.never_contact, unsubscribe_at: post.unsubscribe_at,
        consent_marketing: true, consent_transactional: true },
      "email", "marketing", email,
    );
    if (postGate.allowed) throw new Error(`expected allowed:false post-unsubscribe, got: ${JSON.stringify(postGate)}`);
    console.log(`step 5 · gate BLOCKS next send · reason=${postGate.reason} · detail=${postGate.detail}`);

    // Reason should be either 'never_contact' (checked first) or 'unsubscribed'
    if (postGate.reason !== "never_contact" && postGate.reason !== "unsubscribed") {
      throw new Error(`unexpected block reason: ${postGate.reason}`);
    }

    console.log("PASS · unsubscribe round-trip");
    process.exitCode = 0;
  } catch (e) {
    console.error(`FAIL · ${(e as Error).message}`);
    process.exitCode = 2;
  } finally {
    // Cleanup regardless of pass/fail
    try {
      await pool.query("DELETE FROM nex.compliance_events WHERE contact_id = $1", [contact_id]);
      await pool.query("DELETE FROM nex.contacts WHERE contact_id = $1", [contact_id]);
      console.log("cleanup · burner contact + audit rows deleted");
    } catch (e) {
      console.warn(`cleanup failed: ${(e as Error).message}`);
    }
    await pool.end();
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? (e.stack ?? e.message) : String(e);
  process.stderr.write(`prove-unsubscribe-roundtrip · runner exception:\n${msg}\n`);
  process.exit(1);
});
