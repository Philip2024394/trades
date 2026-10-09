// scripts/nex-canonical/send-claim-invitations.ts
//
// NEX Canonical · Owner-claim outreach batch runner.
//
// SEALED CLAIM:
//   For each canonical row in a selected batch, generate a 6-digit claim
//   code (migration 176), create the business_claim row, render the
//   per-channel template, and send through the current SendAdapter.
//   Rate-limited. Dry-run by default.
//
// USAGE (operator):
//   NEX_POSTGRES_URL=... npx tsx scripts/nex-canonical/send-claim-invitations.ts \
//     --city Yogyakarta \
//     --channel whatsapp \
//     --limit 10 \
//     --dry-run
//
//   To actually send, drop --dry-run. (DEFAULT_ADAPTER must be swapped
//   for a live provider first; otherwise ConsoleAdapter still fires but
//   reports delivery as dry_run_reason.)
//
// WHAT IT DOES:
//   1. Query live-published canonicals (lifecycle_state ∈ L1) joined with
//      their legacy food_business row to pull contact info (whatsapp_number
//      or phone or website · which the admin can configure as destination).
//   2. For each row with a valid destination, call createClaim() to
//      insert nex.business_claim + hash the code.
//   3. Render the template with claim_code, claim_url, business_name, city.
//   4. Send via DEFAULT_ADAPTER (ConsoleAdapter is default · dry-run).
//   5. Log per-row outcome.
//
// SAFETY:
//   · Dry-run by default. Operator opts in with --live.
//   · Never writes claim rows in dry-run mode (uses pure template render).
//   · Rate-limits (--rate ms-between-sends; default 500ms = 2/sec).
//   · Caps batch size at 500 per invocation (no silent 22,757-row sends).

import { Client } from "pg";
import { createClaim, type CreateClaimServiceResult } from "../../src/lib/nex-native/claims/claim-service";
import { renderClaim, type ClaimLanguage, type ClaimTemplateInputs } from "../../src/lib/nex-native/claims/claim-templates";
import { DEFAULT_ADAPTER } from "../../src/lib/nex-native/email-send-adapter";
import type { ClaimChannel } from "../../src/lib/nex-native/claims/claim-logic";

// ═════════════════════════════════════════════════════════════════════
// §1 · Config
// ═════════════════════════════════════════════════════════════════════

const BATCH_SIZE_MAX = 500;
const DEFAULT_RATE_MS = 500;

interface CliArgs {
  readonly city: string | null;
  readonly entityType: string | null;
  readonly channel: ClaimChannel;
  readonly language: ClaimLanguage;
  readonly limit: number;
  readonly rateMs: number;
  readonly dryRun: boolean;
  readonly claimUrlBase: string;
  readonly requestedBy: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let city: string | null = null;
  let entityType: string | null = null;
  let channel: ClaimChannel = "whatsapp";
  let language: ClaimLanguage = "id";
  let limit = 10;
  let rateMs = DEFAULT_RATE_MS;
  let dryRun = true;
  let claimUrlBase = "https://thenetworkers.app/nex-native/claim";
  let requestedBy = "admin:cli";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--city":          city = next() ?? null; break;
      case "--entity-type":   entityType = next() ?? null; break;
      case "--channel":       channel = (next() ?? "whatsapp") as ClaimChannel; break;
      case "--language":
      case "--lang":          language = (next() ?? "id") as ClaimLanguage; break;
      case "--limit":         limit = Math.min(BATCH_SIZE_MAX, Math.max(1, Number.parseInt(next() ?? "10", 10) || 10)); break;
      case "--rate":
      case "--rate-ms":       rateMs = Math.max(100, Number.parseInt(next() ?? String(DEFAULT_RATE_MS), 10) || DEFAULT_RATE_MS); break;
      case "--dry-run":       dryRun = true; break;
      case "--live":          dryRun = false; break;
      case "--claim-url":     claimUrlBase = next() ?? claimUrlBase; break;
      case "--requested-by":  requestedBy = next() ?? requestedBy; break;
    }
  }
  return { city, entityType, channel, language, limit, rateMs, dryRun, claimUrlBase, requestedBy };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Target row loader
// ═════════════════════════════════════════════════════════════════════

interface TargetRow {
  readonly canonical_business_id: string;
  readonly name_canonical: string;
  readonly entity_type: string;
  readonly city: string | null;
  readonly destination: string;
  readonly public_listing_ref: string;
}

/** Query live-publishable canonicals joined to their legacy food_business
 *  row's contact info. For now, only food_business is wired · adding
 *  accommodation / service / mp_seller is a sibling join. */
async function loadTargets(
  client: Client,
  args: CliArgs,
): Promise<TargetRow[]> {
  const destCol = (() => {
    switch (args.channel) {
      case "whatsapp": return "fb.whatsapp_number";
      case "sms":      return "fb.whatsapp_number";          // SMS falls back to WA number
      case "phone":    return "fb.phone";
      case "email":    return "NULL";                        // food_business has no email column yet
    }
  })();

  const cityWhere = args.city ? "AND bc.city = $2" : "";
  const entityWhere = args.entityType ? `AND bc.entity_type = $${args.city ? 3 : 2}` : "";
  const params: unknown[] = [args.limit];
  if (args.city) params.push(args.city);
  if (args.entityType) params.push(args.entityType);

  const sql = `
    SELECT DISTINCT ON (bc.canonical_business_id)
      bc.canonical_business_id,
      bc.name_canonical,
      bc.entity_type,
      bc.city,
      ${destCol} AS destination,
      fb.public_listing_ref
    FROM nex.business_canonical bc
    JOIN nex.business_evidence be
      ON be.canonical_business_id = bc.canonical_business_id
    JOIN nex.food_business fb
      ON fb.public_listing_ref = be.legacy_source_ref
    WHERE bc.lifecycle_state IN ('VERIFIED', 'OWNER_CLAIMED', 'OWNER_VERIFIED')
      AND bc.superseded_by_business_id IS NULL
      AND ${destCol} IS NOT NULL
      AND length(trim(${destCol})) > 0
      ${cityWhere}
      ${entityWhere}
    ORDER BY bc.canonical_business_id, be.created_at DESC
    LIMIT $1
  `;

  const result = await client.query(sql, params);
  return result.rows as TargetRow[];
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Main
// ═════════════════════════════════════════════════════════════════════

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(2); }

  console.log("─".repeat(72));
  console.log(`send-claim-invitations · channel=${args.channel} lang=${args.language} limit=${args.limit}`);
  console.log(`  city=${args.city ?? "(any)"} entity_type=${args.entityType ?? "(any)"}`);
  console.log(`  mode=${args.dryRun ? "DRY-RUN" : "LIVE"}  rate=${args.rateMs}ms  adapter=${DEFAULT_ADAPTER.name}`);
  console.log("─".repeat(72));

  if (args.channel === "email") {
    console.log("⚠ email channel · food_business has no email column yet · destinations will be empty");
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  const targets = await loadTargets(client, args);
  await client.end();

  if (targets.length === 0) {
    console.log("No targets matched · nothing to send.");
    return;
  }
  console.log(`Loaded ${targets.length} target(s).\n`);

  let sent = 0, failed = 0;
  for (const t of targets) {
    const tplInputs: ClaimTemplateInputs = {
      business_name: t.name_canonical,
      claim_code: "000000",            // placeholder; overwritten on live
      claim_url: `${args.claimUrlBase}/placeholder`,
      public_listing_ref: t.public_listing_ref,
      expires_minutes: 10,
      city: t.city,
    };

    if (args.dryRun) {
      // Render template with placeholder code · do not create claim or send.
      const rendered = renderClaim(args.channel, tplInputs, args.language);
      console.log(`[DRY] ${t.name_canonical} · ${t.city ?? "(no-city)"} · dest=${t.destination.slice(0, 16)}...`);
      console.log(`      subject=${rendered.subject ?? "(none)"}  body=${rendered.body_text.length}B`);
      sent++;
      continue;
    }

    // LIVE path: create claim + render + send.
    const createResult: CreateClaimServiceResult = await createClaim({
      canonical_business_id: t.canonical_business_id,
      claim_channel: args.channel,
      destination: t.destination,
      requested_by: args.requestedBy,
      connectionString: url,
    });
    if (!createResult.ok) {
      console.log(`✗ ${t.name_canonical} · createClaim failed: ${createResult.reason}${createResult.detail ? ": " + createResult.detail : ""}`);
      failed++;
      await sleep(args.rateMs);
      continue;
    }

    const rendered = renderClaim(args.channel, {
      ...tplInputs,
      claim_code: createResult.plaintext_code,
      claim_url: `${args.claimUrlBase}/${createResult.claim_id}`,
    }, args.language);

    const sendResult = await DEFAULT_ADAPTER.send({
      to: t.destination,
      subject: rendered.subject ?? "",
      body_text: rendered.body_text,
      body_html: rendered.body_html,
      from_business_name: t.name_canonical,
      unsubscribe_url: `${args.claimUrlBase}/unsubscribe/${createResult.claim_id}`,
    });

    if (sendResult.ok) {
      const tag = sendResult.dry_run_reason ? "dry-via-adapter" : "sent";
      console.log(`✓ ${t.name_canonical} · ${tag} · claim_id=${createResult.claim_id.slice(0, 8)}...`);
      sent++;
    } else {
      console.log(`✗ ${t.name_canonical} · send failed: ${sendResult.error ?? "unknown"}`);
      failed++;
    }

    await sleep(args.rateMs);
  }

  console.log("─".repeat(72));
  console.log(`Summary: sent=${sent}  failed=${failed}  of ${targets.length}`);
  if (args.dryRun) {
    console.log("Mode was DRY-RUN · no claims created · no messages sent.");
    console.log("Rerun with --live and a configured adapter to actually send.");
  }
  console.log("─".repeat(72));

  process.exit(failed > 0 ? 1 : 0);
}

const isMain = (() => { try { return require.main === module; } catch { return false; } })();
if (isMain) { void main(); }
