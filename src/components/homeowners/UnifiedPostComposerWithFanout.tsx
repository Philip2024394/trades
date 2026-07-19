"use client";

// UnifiedPostComposerWithFanout — thin wrapper that binds the pure
// UnifiedPostComposer UI to the composerFanout submitter + refresh.
//
// Real /sitebook uses this. The mock at /sitebook-showcase uses
// UnifiedPostComposer directly with a no-op onSubmit so previews
// don't hit the API.

import { useRouter } from "next/navigation";
import {
  UnifiedPostComposer,
  type ComposerProject,
  type ComposerTrade
} from "./UnifiedPostComposer";
import { fanoutComposerSubmit } from "@/lib/homeowners/composerFanout";

export function UnifiedPostComposerWithFanout({
  authorInitial,
  projects,
  trades
}: {
  authorInitial: string;
  projects:      ComposerProject[];
  trades:        ComposerTrade[];
}) {
  const router = useRouter();
  return (
    <UnifiedPostComposer
      authorInitial={authorInitial}
      projects={projects}
      trades={trades}
      addTradesHref="/trade-off/yard/canteens"
      onSubmit={async (payload) => {
        const res = await fanoutComposerSubmit(payload);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}
