// src/lib/nex-native/safechat/_hook.ts
//
// NEX SafeChat Phase 1 · fire-and-forget orchestrator.
// ---------------------------------------------------
// Thin wrapper the peer-message-service calls after a successful
// plaintext send. The call site is `void safechatClassifyAndLog(...)`
// so this function:
//   · MUST NEVER throw
//   · MUST NOT block the send path (classifier + logger both run
//     asynchronously here · the caller returns before this resolves)
//   · MUST swallow every error (classifier crash, DB failure, pool
//     unavailable, bad vocabulary row, etc.)

import "server-only";
import { classifyMessage } from "./classifier";
import { logClassification } from "./classification-logger";

export interface SafeChatHookInput {
  readonly messageText: string;
  readonly senderAccountId: string;
  readonly recipientAccountId: string;
  readonly conversationId: string | null;
  readonly messageRef: string;
}

/** Fire-and-forget classifier + logger. Returns a Promise so the
 *  caller can `.catch` as a double-safety belt, but the function
 *  itself never throws out · all errors are logged + swallowed. */
export async function safechatClassifyAndLog(
  input: SafeChatHookInput,
): Promise<void> {
  try {
    const classification = await classifyMessage({
      messageText: input.messageText,
      senderAccountId: input.senderAccountId,
      recipientAccountId: input.recipientAccountId,
      conversationId: input.conversationId,
    });
    await logClassification({
      messageRef: input.messageRef,
      senderAccountId: input.senderAccountId,
      recipientAccountId: input.recipientAccountId,
      conversationId: input.conversationId,
      classification,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[safechat.hook] soft-fail · ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
