// scripts/nex-canonical/pg-write-adapter.ts
//
// NEX Canonical · The thinnest pg.Client → WriteSession adapter.
//
// Purpose
//   Provide the production bridge between the sealed, mock-tested
//   `executeWritePlan` and a real PostgreSQL connection. The adapter
//   does nothing beyond opening a Client, forwarding queries, and
//   closing it. Every decision (fingerprint, write SQL, rollback,
//   captured ids) already lives inside `executeWritePlan`.
//
// What this adapter is NOT
//   · Not a decision engine. No approval, resolver, precheck, or
//     write logic.
//   · Not a retry/reconnect layer. If the connection fails, the
//     executor's rollback+abstained path surfaces it. There is no
//     second attempt.
//   · Not a duplicate of pg-executor. pg-executor is the read-only
//     Layer-B surface; this adapter is write-side. They never share
//     a Client.
//   · Not a credential inspector. Credentials come exclusively from
//     the runtime env via `parsePgWriteAdapterConfigFromEnv`.
//   · Not a session-mutation layer. The adapter does NOT issue any
//     `SET session-level` statements of its own. The executor's
//     compiled stages apply the required `SET LOCAL` statements
//     inside the write transaction. In particular, the adapter does
//     NOT issue `SET default_transaction_read_only = off`; the write
//     transaction is explicitly controlled by `executeWritePlan`.

import { Client } from "pg";
import type {
  WriteSession,
  WriteSessionFactory,
} from "./execute-write-plan";

// ═════════════════════════════════════════════════════════════════════
// §1 · Config
// ═════════════════════════════════════════════════════════════════════

export interface PgWriteAdapterConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  /** Client-level statement timeout (ms). Mirrors the executor's own
   *  SET LOCAL on each txn; applied here as belt-and-braces. */
  readonly statementTimeoutMs: number;
  /** Client-level query timeout (ms). */
  readonly queryTimeoutMs: number;
  /** How long to wait for the initial connect handshake. */
  readonly connectionTimeoutMillis: number;
}

export const PG_WRITE_ADAPTER_REQUIRED_ENV_VARS: readonly string[] = Object.freeze([
  "NEX_CANONICAL_PG_HOST",
  "NEX_CANONICAL_PG_DATABASE",
  "NEX_CANONICAL_PG_USER",
  "NEX_CANONICAL_PG_PASSWORD",
]);

export class PgWriteAdapterConfigError extends Error {
  readonly missingEnvVars: readonly string[];
  constructor(message: string, missing: readonly string[] = []) {
    super(message);
    this.name = "PgWriteAdapterConfigError";
    this.missingEnvVars = missing;
  }
}

/** Parse the adapter config from a process env object. Fail-closed on
 *  any missing required env var · surfaces the exact missing variable
 *  NAMES but never their values. */
export function parsePgWriteAdapterConfigFromEnv(
  env: NodeJS.ProcessEnv,
): PgWriteAdapterConfig {
  const missing: string[] = [];
  for (const name of PG_WRITE_ADAPTER_REQUIRED_ENV_VARS) {
    const raw = env[name];
    if (typeof raw !== "string" || raw.length === 0) missing.push(name);
  }
  if (missing.length > 0) {
    throw new PgWriteAdapterConfigError(
      `pg-write-adapter: missing required env vars: ${missing.join(", ")}`,
      missing,
    );
  }
  const optionalInt = (name: string, def: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === "") return def;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new PgWriteAdapterConfigError(
        `pg-write-adapter: env var ${name} is not a positive integer`,
      );
    }
    return n;
  };
  const host = env.NEX_CANONICAL_PG_HOST as string;
  const database = env.NEX_CANONICAL_PG_DATABASE as string;
  const user = env.NEX_CANONICAL_PG_USER as string;
  const password = env.NEX_CANONICAL_PG_PASSWORD as string;
  const port = optionalInt("NEX_CANONICAL_PG_PORT", 5432);
  const ssl =
    (env.NEX_CANONICAL_PG_SSL ?? "true").toLowerCase() === "true";
  const statementTimeoutMs = optionalInt(
    "NEX_CANONICAL_PG_STATEMENT_TIMEOUT_MS",
    30000,
  );
  const queryTimeoutMs = statementTimeoutMs;
  const connectionTimeoutMillis = 10000;
  return {
    host,
    port,
    database,
    user,
    password,
    ssl,
    statementTimeoutMs,
    queryTimeoutMs,
    connectionTimeoutMillis,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · WriteSession implementation · one Client per session
// ═════════════════════════════════════════════════════════════════════

/** Build a `WriteSessionFactory` that opens exactly one pg.Client per
 *  session. Fails fast on connect error · the caller receives the
 *  error at the executor's `openSession` boundary. */
export function createPgWriteSessionFactory(
  config: PgWriteAdapterConfig,
): WriteSessionFactory {
  let sessionCounter = 0;

  return {
    openSession: async () => {
      sessionCounter++;
      const client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : false,
        statement_timeout: config.statementTimeoutMs,
        query_timeout: config.queryTimeoutMs,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      });
      await client.connect();
      const sessionId = `pg-write-${sessionCounter}`;
      const session: WriteSession = {
        id: sessionId,
        query: async <T = Record<string, unknown>>(
          sql: string,
          params: readonly unknown[],
        ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }> => {
          const result = await client.query<T>(sql, params as unknown[]);
          return {
            rows: result.rows,
            rowCount: result.rowCount ?? result.rows.length,
          };
        },
      };
      // Attach the Client reference for close via a side-channel map.
      clientBySession.set(session, client);
      return session;
    },
    closeSession: async (s: WriteSession) => {
      const client = clientBySession.get(s);
      if (client === undefined) return;
      clientBySession.delete(s);
      try {
        await client.end();
      } catch {
        /* best-effort close */
      }
    },
  };
}

/** Side-channel so `closeSession` can find the Client that was opened
 *  by `openSession`. Scoped to this module · tests do not interact
 *  with it directly. */
const clientBySession = new WeakMap<WriteSession, Client>();

// ═════════════════════════════════════════════════════════════════════
// §3 · Static invariants · module-level
// ═════════════════════════════════════════════════════════════════════
//
// This module:
//   · opens EXACTLY ONE pg.Client per openSession() call
//   · does NOT emit any session-level SET statement
//   · does NOT retry · does NOT reconnect
//   · does NOT read credentials from the filesystem
//   · does NOT invoke the resolver
//   · does NOT invoke approval
//   · does NOT invoke precheckHandoff
//   · does NOT invoke executeWritePlan
//   · does NOT import extract-candidates, pg-executor, pg-fingerprint,
//     identity-matching, entity-universe, or any Marketing/Crawler/
//     Socials surface
//   · uses a clock only as implicitly embedded in `new Client()` /
//     `client.connect()` network timers · no `Date.now()`, no
//     `new Date()`, no `Math.random()` is called by this module
