// scripts/nex-canonical/_country-dist-probe.mjs
// Read-only country distribution across directory_v + canonical + legacy verticals.
// Also: UK vs GB check. SET default_transaction_read_only = on.

import pg from "pg";
const url = process.env.NEX_POSTGRES_URL;
const useSSL = /supabase\.(co|com)/i.test(url);
const client = new pg.Client({ connectionString: url, ssl: useSSL ? { rejectUnauthorized: false } : undefined });
await client.connect();
await client.query("SET default_transaction_read_only = on");

const out = {};
const q = async (label, sql) => {
  try { out[label] = { ok: true, rows: (await client.query(sql)).rows }; }
  catch (e) { out[label] = { ok: false, error: String(e.message || e).slice(0, 300) }; }
};

await q("session", `SELECT current_database() AS db, current_user AS u;`);

// Country distribution per source.
await q("directory_v_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.business_directory_v
   GROUP BY country ORDER BY n DESC;
`);
await q("canonical_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.business_canonical
   GROUP BY country ORDER BY n DESC;
`);
await q("food_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.food_business
   GROUP BY country ORDER BY n DESC;
`);
await q("accommodation_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.accommodation_business
   GROUP BY country ORDER BY n DESC;
`);
await q("service_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.service_business
   GROUP BY country ORDER BY n DESC;
`);
await q("mp_seller_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.mp_seller
   GROUP BY country ORDER BY n DESC;
`);
await q("transport_by_country", `
  SELECT country, COUNT(*)::bigint AS n
    FROM nex.transport_acquisition_record
   GROUP BY country ORDER BY n DESC;
`);

// Explicit UK / GB check across all tables.
await q("uk_vs_gb_hunt", `
  SELECT 'business_canonical' AS tbl, country, COUNT(*)::bigint AS n FROM nex.business_canonical WHERE country IN ('UK','GB') GROUP BY country
  UNION ALL
  SELECT 'food_business', country, COUNT(*)::bigint FROM nex.food_business WHERE country IN ('UK','GB') GROUP BY country
  UNION ALL
  SELECT 'accommodation_business', country, COUNT(*)::bigint FROM nex.accommodation_business WHERE country IN ('UK','GB') GROUP BY country
  UNION ALL
  SELECT 'service_business', country, COUNT(*)::bigint FROM nex.service_business WHERE country IN ('UK','GB') GROUP BY country
  UNION ALL
  SELECT 'mp_seller', country, COUNT(*)::bigint FROM nex.mp_seller WHERE country IN ('UK','GB') GROUP BY country
  UNION ALL
  SELECT 'transport_acquisition_record', country, COUNT(*)::bigint FROM nex.transport_acquisition_record WHERE country IN ('UK','GB') GROUP BY country
  ORDER BY tbl, country;
`);

// Confirm the business_canonical.country CHECK (167 says ~ '^[A-Z]{2}$').
await q("canonical_country_check", `
  SELECT pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid=con.conrelid
    JOIN pg_namespace nsp ON nsp.oid=rel.relnamespace
   WHERE nsp.nspname='nex' AND rel.relname='business_canonical' AND conname='ck_bc_country';
`);

await client.end();
console.log(JSON.stringify(out, null, 2));
