// Vitest setup — inject dummy env so server-only modules (supabaseAdmin)
// initialise without crashing. Tests never make real network calls; the
// Supabase client is instantiated but no queries fire.

process.env.NEXT_PUBLIC_SUPABASE_URL       ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY      ??= "test-service-role-key";
process.env.SUPABASE_URL                   ??= process.env.NEXT_PUBLIC_SUPABASE_URL;
