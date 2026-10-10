// scripts/nex-canonical/_safechat-flag-audit.mjs
//
// NEX SafeChat Phase 1 · flag-state audit script (sealed 2026-10-10
// Privacy Audit).
//
// Reports the current environment's SafeChat flag posture and WARNS /
// FAILS when a flag is set in a way that is not safe for an
// unauthorised environment.
//
// USAGE
//   node --env-file=.env.local scripts/nex-canonical/_safechat-flag-audit.mjs
//
// EXIT
//   0 · all flags at safe defaults (or Phase 1 ON with explicit
//       NEX_SAFECHAT_AUTHORISED_BY=<name>)
//   1 · one or more violations detected · CI should fail

function readFlag(name) {
  const raw = process.env[name];
  return raw === undefined ? null : raw;
}

function isTrue(value) {
  return value === "true";
}

function log(line) {
  // eslint-disable-next-line no-console
  console.log(line);
}

function main() {
  const phase1 = readFlag("NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED");
  const userFacing = readFlag("NEX_SAFECHAT_USER_FACING_ENABLED");
  const retention = readFlag("NEX_SAFECHAT_RETENTION_DAYS");
  const authorisedBy = readFlag("NEX_SAFECHAT_AUTHORISED_BY");

  const effectivePhase1 = phase1 === "true";
  const effectiveUserFacing = userFacing === "true";
  const effectiveRetention =
    retention !== null && /^\d+$/.test(retention)
      ? Number.parseInt(retention, 10)
      : 30;

  log("────────────────────────────────────────────────────────────");
  log("NEX SafeChat flag audit");
  log("────────────────────────────────────────────────────────────");
  log(`NEX_SAFECHAT_PHASE_1_LOGGING_ENABLED  : ${phase1 ?? "(unset)"}`);
  log(`  → effective                         : ${effectivePhase1 ? "ON" : "OFF"}`);
  log(`NEX_SAFECHAT_USER_FACING_ENABLED      : ${userFacing ?? "(unset)"}`);
  log(`  → effective                         : ${effectiveUserFacing ? "ON" : "OFF"}`);
  log(`NEX_SAFECHAT_RETENTION_DAYS           : ${retention ?? "(unset · defaults 30)"}`);
  log(`  → effective                         : ${effectiveRetention} days`);
  log(`NEX_SAFECHAT_AUTHORISED_BY            : ${authorisedBy ?? "(unset)"}`);
  log("────────────────────────────────────────────────────────────");

  const violations = [];
  const warnings = [];

  if (effectivePhase1) {
    if (!authorisedBy || authorisedBy.trim().length === 0) {
      violations.push(
        "Phase 1 logging is ON but NEX_SAFECHAT_AUTHORISED_BY is unset · unauthorised environment",
      );
    } else {
      warnings.push(
        `Phase 1 logging is ON · authorised by '${authorisedBy}' · retention sweep must run on schedule`,
      );
    }
  }

  if (effectiveUserFacing) {
    violations.push(
      "Phase 2 user-facing flag is ON · Phase 2 is NOT authorised · flipping this is a safety violation",
    );
  }

  if (effectiveRetention > 365) {
    warnings.push(
      `Retention window is ${effectiveRetention} days · consider a shorter window for Phase 1`,
    );
  }
  if (effectiveRetention <= 0) {
    violations.push(
      `Retention window is non-positive (${effectiveRetention}) · would skip the sweep entirely`,
    );
  }

  for (const w of warnings) log(`WARN  · ${w}`);
  for (const v of violations) log(`FAIL  · ${v}`);

  if (violations.length === 0 && warnings.length === 0) {
    log("OK · all SafeChat flags at safe defaults");
  }

  log("────────────────────────────────────────────────────────────");
  log(`result · ${violations.length} violation(s) · ${warnings.length} warning(s)`);

  if (violations.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
