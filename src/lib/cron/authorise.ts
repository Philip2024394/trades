// Cron endpoint authorisation — Vercel Cron requests carry an
// Authorization: Bearer <CRON_SECRET> header when configured. We
// verify it so only the platform (not random visitors) can trigger
// heavy fan-out jobs.
//
// In dev without CRON_SECRET, any caller is allowed so /api/cron/*
// stays testable locally.

export function isCronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / preview — allow
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}
