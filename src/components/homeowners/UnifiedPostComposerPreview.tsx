"use client";

// UnifiedPostComposerPreview — mock/showcase wrapper for the pure
// UnifiedPostComposer.
//
// Server components CANNOT pass functions to client components, so
// mock pages import THIS instead of UnifiedPostComposer directly.
// The no-op onSubmit lives here in a client-only file, safely
// off-limits to any server-component render pass.

import { UnifiedPostComposer, type ComposerProject, type ComposerTrade, type ComposerResult } from "./UnifiedPostComposer";

export function UnifiedPostComposerPreview({
  authorInitial,
  authorName,
  authorSubtitle,
  authorAvatarUrl,
  projects,
  trades
}: {
  authorInitial:    string;
  authorName?:      string;
  authorSubtitle?:  string;
  authorAvatarUrl?: string | null;
  projects:         ComposerProject[];
  trades:           ComposerTrade[];
}) {
  return (
    <UnifiedPostComposer
      authorInitial={authorInitial}
      authorName={authorName}
      authorSubtitle={authorSubtitle}
      authorAvatarUrl={authorAvatarUrl}
      projects={projects}
      trades={trades}
      addTradesHref="/trade-off/yard/canteens?previewInvite=1"
      onSubmit={async (): Promise<ComposerResult> => ({
        ok:    false,
        error: "Preview mode. Posting lives in the real /sitebook."
      })}
    />
  );
}
