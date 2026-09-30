// src/lib/nex-native/nex-official-welcome.ts
//
// Shared welcome-body renderer for NEX1 welcomes.
// -----------------------------------------------------------------------------
// Extracted from src/app/nex-native/_actions.ts (Bridge 62 inline) so
// both the existing Bridge 62 signup path AND Bridge 99's welcome-outbox
// delivery adapter (Stage 10) produce the same body text · one canonical
// source, one behaviour.
//
// This extraction MUST preserve Bridge 62's existing body output
// verbatim. Regression tests in __tests__/nex-official-welcome.test.ts
// pin the exact string.
//
// This module is client-safe (pure string · no server-only imports)
// so it can be imported from both Server Actions and worker adapters
// without triggering server-only guards in either.

/** Input for the welcome-body renderer.
 *  · first_name  · display name to interpolate. Only the leading word
 *                  (first whitespace-separated token) is used. Falls
 *                  back to "there" if unavailable. */
export interface RenderNex1WelcomeInput {
  first_name?: string | null;
}

/** Render the canonical NEX1 welcome body. Deterministic pure function.
 *  Output is identical to Bridge 62's original inline body. */
export function renderNex1WelcomeBody(
  input: RenderNex1WelcomeInput = {},
): string {
  // Verbatim Bridge 62 logic · plain split, no trim. Leading whitespace
  // yields an empty first element which the "|| 'there'" fallback catches.
  const raw = input.first_name ?? "";
  const firstName = raw.split(/\s+/)[0] || "there";
  return (
    `🎉 Welcome to NEX, ${firstName}!\n\n` +
    `I'm NEX · your support account. Everything about your NEX chat lives here — tap /settings/theme to try any premium theme free for 7 days, or reply to this message any time you have a question.\n\n` +
    `Enjoy your first look 💜`
  );
}
