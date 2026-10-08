// scripts/nex-canonical/pg-read-adapter.ts
//
// NEX Canonical · Read-only pg.Client adapter for source ingestion.
//
// Purpose
//   Provide the production read side for continuous source adapters.
//   Mirrors `pg-write-adapter` but with session-level
//   `SET default_transaction_read_only = on` applied immediately after
//   connect. All adapter queries land in read-only transactions by
//   default · a stray INSERT/UPDATE/DELETE would be refused by both
//   the DB and the sealed keyword denylist.
//
// What this adapter is NOT
//   · Not pg-executor. pg-executor runs a sealed identity-allowlist
//     of candidate-generation QUERY_SPECS. This adapter runs
//     caller-owned SQL (the source implementation's keyset-pagination
//     SELECT), with the same safety primitives (denylist + sanitiser)
//     applied as defence in depth.
//   · Not a write path. The adapter session is set READ ONLY at the
//     session level and the denylist refuses mutation keywords.
//   · Not a retry/reconnect layer. Source adapters surface
//     `temporary_failure` / `permanent_failure` via `DiscoverBatchResult`
//     and the runner handles retry policy.

import { Client } from "pg";
import { assertNoForbiddenKeyword } from "./pg-executor";

// ═════════════════════════════════════════════════════════════════════
// §1 · Config
// ═════════════════════════════════════════════════════════════════════

export interface PgReadAdapterConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly statementTimeoutMs: number;
  readonly queryTimeoutMs: number;
  readonly connectionTimeoutMillis: number;
}

export const PG_READ_ADAPTER_REQUIRED_ENV_VARS: readonly string[] = Object.freeze([
  "NEX_CANONICAL_PG_HOST",
  "NEX_CANONICAL_PG_DATABASE",
  "NEX_CANONICAL_PG_USER",
  "NEX_CANONICAL_PG_PASSWORD",
]);

export class PgReadAdapterConfigError extends Error {
  readonly missingEnvVars: readonly string[];
  constructor(message: string, missing: readonly string[] = []) {
    super(message);
    this.name = "PgReadAdapterConfigError";
    this.missingEnvVars = missing;
  }
}

export function parsePgReadAdapterConfigFromEnv(
  env: NodeJS.ProcessEnv,
): PgReadAdapterConfig {
  const missing: string[] = [];
  for (const n of PG_READ_ADAPTER_REQUIRED_ENV_VARS) {
    const raw = env[n];
    if (typeof raw !== "string" || raw.length === 0) missing.push(n);
  }
  if (missing.length > 0) {
    throw new PgReadAdapterConfigError(
      `pg-read-adapter: missing required env vars: ${missing.join(", ")}`,
      missing,
    );
  }
  const optionalInt = (name: string, def: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === "") return def;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new PgReadAdapterConfigError(
        `pg-read-adapter: env var ${name} is not a positive integer`,
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
  return {
    host,
    port,
    database,
    user,
    password,
    ssl,
    statementTimeoutMs,
    queryTimeoutMs: statementTimeoutMs,
    connectionTimeoutMillis: 10000,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §2 · ReadSession
// ═════════════════════════════════════════════════════════════════════

export interface ReadSession {
  readonly id: string;
  query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }>;
}

export interface ReadSessionFactory {
  readonly openSession: () => Promise<ReadSession>;
  readonly closeSession: (s: ReadSession) => Promise<void>;
}

/** Build a production ReadSessionFactory. Opens one pg.Client,
 *  immediately applies `SET default_transaction_read_only = on` so
 *  every subsequent transaction (implicit or explicit) is read-only.
 *  The sealed `assertNoForbiddenKeyword` denylist is applied as
 *  defence in depth on every query. */
export function createPgReadSessionFactory(
  config: PgReadAdapterConfig,
): ReadSessionFactory {
  let counter = 0;
  const clientBySession = new WeakMap<ReadSession, Client>();
  return {
    openSession: async () => {
      counter++;
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
      // Session-level read-only · guarantees the adapter cannot mutate,
      // even by caller mistake. The denylist below is additional guard.
      await client.query("SET default_transaction_read_only = on");
      await client.query(
        `SET statement_timeout = ${Number(config.statementTimeoutMs).toFixed(0)}`,
      );
      const sessionId = `pg-read-${counter}`;
      const session: ReadSession = {
        id: sessionId,
        query: async <T = Record<string, unknown>>(
          sql: string,
          params: readonly unknown[],
        ): Promise<{ readonly rows: readonly T[]; readonly rowCount: number }> => {
          // Belt-and-braces · refuse mutation keywords even though the
          // session is read-only. A SET statement typed as "SET" and
          // the sealed denylist does not include "SET" · it only
          // blocks INSERT/UPDATE/DELETE/CREATE/ALTER/DROP/TRUNCATE/etc.
          assertNoForbiddenKeyword(sql);
          const result = await client.query<T>(sql, params as unknown[]);
          return {
            rows: result.rows,
            rowCount: result.rowCount ?? result.rows.length,
          };
        },
      };
      clientBySession.set(session, client);
      return session;
    },
    closeSession: async (s) => {
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

// ═════════════════════════════════════════════════════════════════════
// §3 · Static invariants
// ═════════════════════════════════════════════════════════════════════
//
// This adapter:
//   · opens EXACTLY ONE pg.Client per openSession() call
//   · applies session-level read-only on open · subsequent queries
//     cannot mutate even by caller error
//   · uses the sealed denylist on every query · belt-and-braces
//   · does NOT read credentials from the filesystem
//   · does NOT retry · does NOT reconnect
//   · does NOT invoke the resolver / approval / write path
//   · does NOT instantiate executeWritePlan or any write session
