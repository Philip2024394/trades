import pg from "pg";
const url = process.env.NEX_POSTGRES_URL;
if (!url) { console.error("NEX_POSTGRES_URL not set"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

// 6 qualified enquiries for Nanamia · crosses the free_allowance=5 threshold
for (let i = 0; i < 6; i++) {
  await pool.query(
    `INSERT INTO nex.food_commercial_event (business_ref, event_type, source_surface)
     VALUES ('#FL-2026-00002', 'qualified_enquiry', 'nexapp_directory')`
  );
}
console.log("injected 6 qualified_enquiry events for #FL-2026-00002");

// Backdate Nanamia's claim so we exit the 7-day ONBOARD window
const r = await pool.query(
  `UPDATE nex.food_claim_code
   SET consumed_at = now() - interval '10 days'
   WHERE business_ref = '#FL-2026-00002' AND consumed_at IS NOT NULL`
);
console.log(`backdated Nanamia claim by 10 days (${r.rowCount} claim code row)`);
await pool.end();
