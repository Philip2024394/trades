// src/app/nex-native/unsubscribe/[token]/page.tsx
//
// Wave C Slice 11e · Public unsubscribe page.
// ---------------------------------------------
// Recipients of a marketing email land here via the personalised
// /nex-native/unsubscribe/<token> link. The page is PUBLIC (no session)
// and calls emailService.unsubscribeByToken(token).
//
// Cases:
//   · unknown/invalid token → honest "not found" message · never fabricate
//   · valid token → soft-unsubscribe row · show masked email so the
//     recipient can confirm which address was unsubscribed
//
// Doctrine:
//   · public · no auth wrapper (recipient likely not signed in)
//   · never expose the raw email · only the masked form
//   · idempotent by service · a second visit still shows the success state

import Link from "next/link";
import * as emailService from "@/lib/nex-native/email-service";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mask an email so the recipient recognises it without full disclosure.
 * Rule: first 2 chars of localpart + "***@" + domain.
 * If localpart is shorter than 3 chars, keep the whole localpart.
 * Falls back to the raw string if no "@" is present (shouldn't happen for
 * shape-checked emails but we stay honest).
 */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length < 3) return `${local}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: PageProps) {
  const { token } = await params;

  const row = await emailService.unsubscribeByToken(token);

  return (
    <NexNativeShell>
      <main className="mx-auto max-w-md px-4 py-8">
        <header className="mb-4 border-b border-neutral-300 pb-3">
          <h1 className="text-lg font-semibold text-neutral-900">
            NEX Email · Unsubscribe
          </h1>
        </header>

        {row === null ? (
          <section
            className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
            role="status"
          >
            <p className="mb-2 font-medium">Token not found.</p>
            <p className="text-xs">
              This unsubscribe link is not valid, or the address has already
              been unsubscribed. If you are still receiving mail from us and
              this looks wrong, forward the message to the sender directly.
            </p>
            <p className="mt-3 font-mono text-[10px] text-amber-800">
              token ref: {token.slice(0, 8)}…
            </p>
          </section>
        ) : (
          <section
            className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900"
            role="status"
          >
            <p className="mb-2 font-medium">You have been unsubscribed from this list.</p>
            <p className="text-xs">
              The following address will no longer receive campaigns from this
              list:
            </p>
            <p className="mt-2 font-mono text-sm">{maskEmail(row.email)}</p>
            {row.unsubscribed_at && (
              <p className="mt-2 text-[10px] text-green-800">
                confirmed at {new Date(row.unsubscribed_at).toISOString()}
              </p>
            )}
            <p className="mt-3 font-mono text-[10px] text-green-800">
              token ref: {token.slice(0, 8)}…
            </p>
          </section>
        )}

        <p className="mt-6 text-xs">
          <Link href="/nex-native/conversations" className="underline text-neutral-700">
            ← back to home
          </Link>
        </p>
      </main>
    </NexNativeShell>
  );
}
