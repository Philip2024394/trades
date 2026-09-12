// src/lib/nex/action-brain/index.ts
//
// Founder Path A/B · ECO-2 · Action Brain facade implementation.
//
// Composes existing action pipeline (authorize.ts + registry.ts +
// nex.action_audit) behind a single named surface. Zero doctrine
// escape hatch: every proposal still traverses the 7-stage authorize
// pipeline. Callers (chat route, MCP server, future agents) gain
// consistency without ever touching authorize.ts internals.

import { authorizeAction } from "@/lib/nex/live-chat-completion/actions/authorize";
import { listActionSummaries } from "@/lib/nex/live-chat-completion/actions/registry";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import type { ActionBrainFacade } from "./contract";

export function makeActionBrain(): ActionBrainFacade {
  return {
    name: "action-brain-v1",

    async propose(input) {
      try {
        return await authorizeAction({
          proposal: {
            action_id: input.action_id,
            args: input.args,
            rationale: input.rationale,
          },
          confirmation_token: null,
          context: {
            conversation_id: input.conversation_id ?? null,
            entity_ref: input.entity_ref ?? null,
            language: input.language ?? "en",
            session_id: null,
            user_id: input.user_id ?? null,
          },
          kfPool: getKnowledgeFactoryDbPool(),
        });
      } catch {
        return null;
      }
    },

    async confirm(input) {
      try {
        return await authorizeAction({
          proposal: null,
          confirmation_token: input.confirmation_token,
          context: {
            conversation_id: input.conversation_id ?? null,
            entity_ref: null,
            language: "en",
            session_id: null,
            user_id: null,
          },
          kfPool: getKnowledgeFactoryDbPool(),
        });
      } catch {
        return null;
      }
    },

    async listActions() {
      return listActionSummaries();
    },
  };
}

export function makeDefaultActionBrain(): ActionBrainFacade | null {
  const enabled = process.env.NEX_ACTION_BRAIN;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  return makeActionBrain();
}
