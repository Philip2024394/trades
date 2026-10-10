// scripts/nex-canonical/_accommodation-schema-probe.mjs
// Read-only probe of nex.accommodation_business column shape for the
// accommodation legacy adapter. SET default_transaction_read_only = on.
// This script is probe-only · will be removed after the adapter is sealed.

import pg from "pg";
const url = process.env.NEX_POSTGRES_URL;
const useSSL = /supabase\.(co|com)/i.test(url);
const client = new pg.Client({
  connectionString: url,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
await client.query("SET default_transaction_read_only = on");

const out = {};
const q = async (label, sql, params = []) => {
  try {
    out[label] = { ok: true, rows: (await client.query(sql, params)).rows };
  } catch (e) {
    out[label] = { ok: false, error: String(e.message || e).slice(0, 400) };
  }
};

await q("session", `SELECT current_database() AS db, current_user AS u;`);

await q(
  "columns",
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='nex' AND table_name='accommodation_business'
    ORDER BY ordinal_position;`,
);

await q(
  "row_count",
  `SELECT COUNT(*)::bigint AS n FROM nex.accommodation_business;`,
);

await q(
  "country_dist",
  `SELECT country, COUNT(*)::bigint AS n
     FROM nex.accommodation_business
    GROUP BY country ORDER BY n DESC LIMIT 10;`,
);

await q(
  "sample_row",
  `SELECT *
     FROM nex.accommodation_business
    ORDER BY internal_id ASC
    LIMIT 1;`,
);

await q(
  "pk",
  `SELECT a.attname AS pk_col
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
    WHERE i.indrelid='nex.accommodation_business'::regclass AND i.indisprimary;`,
);

await client.end();
console.log(JSON.stringify(out, null, 2));
