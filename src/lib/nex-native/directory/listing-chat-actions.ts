"use server";

// src/lib/nex-native/directory/listing-chat-actions.ts
//
// NEX Directory · Phase C (Agent C) · listing-chat server actions.
//
// What this module is
//   · Next 15 Server Actions that wrap the sealed
//     `src/lib/nex/listing-chat/*` service for the Directory UI.
//   · The composition layer that:
//       1. Resolves the viewer (signed-in NEX account OR anonymous
//          per-browser cookie id · see `resolveViewerId`),
//       2. Reads the canonical row to know its name + lifecycle state,
//       3. Calls sealed `ensureThread` + `sendMessage`,
//       4. Writes a first-contact `from_role='system'` bubble when the
//          thread is newly created AND the listing is unclaimed,
//       5. Attempts to issue + send the owner invite email · ONLY when
//          a real owner email can be resolved (never fabricated).
//
// What this module is NOT
//   · Not a modifier of the sealed listing-chat service · we compose it,
//     we never patch it. The one DB path that is NOT exposed through
//     the sealed service (writing a `from_role='system'` row) uses the
//     same `getKnowledgeFactoryDbPool()` the sealed service uses, with
//     a tightly-scoped INSERT that mirrors the sealed table shape.
//   · Not a UI module · Agent B owns `_directory-card.tsx` and friends.
//   · Not a reader of `nex.business_canonical` directly · the sealed
//     `getCanonicalBusinessById` is the one authorised entry point.
//   · Not an authoriser of writes beyond the two-party envelope ·
//     Doctrine #7 is enforced by `readThreadForSender`/`...ForOwner`
//     which scope every query by sender_user_id or owner_user_id.
//
// Doctrine references
//   · Doctrine #5 · untrusted content is sanitised before storage ·
//     sealed `sendMessage` already runs the sanitiser internally; this
//     file never bypasses that path for visitor-authored bodies.
//   · Doctrine #7 · every read is scoped to the current viewer ·
//     visitors can only see their own thread; owners can only see
//     threads where they are the owner_user_id. System bubbles live
//     inside the two-party envelope and never surface elsewhere.
//   · Honest-missing · no owner invite is issued when there is no
//     resolvable public email · the thread stays pending organically
//     for the owner to surface through other channels.

import "server-only";
import { randomUUID } from "node:crypto";
import { cookies as nextCookies } from "next/headers";

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import {
  ensureThread,
  sendMessage,
  readThreadForSender,
  readThreadForOwner,
  tryResolveOwnerEmailFromListing,
  type ListingMessageRow,
} from "@/lib/nex/listing-chat";
import { sendOwnerInviteEmail } from "@/lib/nex/listing-chat/owner-invite";

import { getCanonicalBusinessById } from "./directory-service";
import {
  buildSystemBubble,
  SYSTEM_BUBBLE_META_KIND,
} from "./system-bubble";

// ═════════════════════════════════════════════════════════════════════
// §1 · Shared constants + types
// ═════════════════════════════════════════════════════════════════════

/** Cookie name used to persist the anonymous per-browser visitor id.
 *  httpOnly so client JS cannot read it · SameSite=Lax so it survives
 *  normal navigation but is not sent on cross-site POSTs that the user
 *  did not initiate · 180-day lifetime so revisiting the same listing
 *  from the same browser rehydrates the existing thread (idempotent
 *  behaviour required by the task spec). */
const VISITOR_COOKIE_NAME = "nex_dir_visitor";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** The invitation lifetime after which a system bubble should be
 *  considered stale by downstream readers. Stored as metadata · the
 *  message row itself is retained for the thread's lifetime (sealed
 *  table has no TTL). This is advisory for UI, not a DB constraint. */
const SYSTEM_BUBBLE_TTL_HOURS = 48;

/** Lifecycle states that mean "owner has claimed this business". Any
 *  state outside this set is treated as unclaimed · the first-contact
 *  system bubble + owner invite path only fires for unclaimed. */
const CLAIMED_LIFECYCLE_STATES = new Set([
  "OWNER_CLAIMED",
  "OWNER_VERIFIED",
]);

/** Compose a canonical-born listing_ref from a canonical_business_id.
 *  Sealed convention: `"canonical:" + <uuid>`. Legacy accom:/food:
 *  references are read-only via the sealed service for pre-existing
 *  threads · new threads opened through this module always use the
 *  canonical: prefix. */
function canonicalListingRef(canonicalId: string): string {
  return `canonical:${canonicalId}`;
}

/** The view-model shape returned to the UI. Doctrine #7 subset of
 *  `ListingMessageRow` · we deliberately drop `from_user_id`,
 *  `delivered_at`, `read_at`, `sanitiser_neutralised`, and `meta` so
 *  the UI cannot leak party identifiers or operational metadata into
 *  the DOM. The `from_role` field stays so the UI can render the three
 *  bubble styles (sender / owner / system). */
export interface ChatMessageVM {
  readonly message_id: string;
  readonly from_role: "sender" | "owner" | "system";
  readonly body: string;
  readonly sent_at: string;
}

export interface OpenListingThreadInput {
  readonly canonicalId: string;
  readonly body: string;
}

export interface OpenListingThreadResult {
  readonly ok: true;
  readonly thread_id: string;
  readonly system_bubble: typeof SYSTEM_BUBBLE_META_KIND | null;
}

export interface ListMessagesInput {
  readonly canonicalId: string;
}

export interface ListMessagesResult {
  readonly ok: true;
  readonly messages: readonly ChatMessageVM[];
}

export interface SendMessageInput {
  readonly canonicalId: string;
  readonly body: string;
}

export interface SendMessageActionResult {
  readonly ok: true;
  readonly message_id: string;
}

export interface ActionFailure {
  readonly ok: false;
  /** A short, user-facing reason code. Never contains pg error text,
   *  stack traces, or SQL fragments · see `redactError` below. */
  readonly reason: string;
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Viewer resolution · signed-in NEX account OR anonymous cookie
// ═════════════════════════════════════════════════════════════════════

/**
 * Return the viewer id to key the thread by. Two paths:
 *
 *   1. Signed-in NEX account · uses `nex_account.id` (UUID). This id
 *      is what the sealed owner-invite conversion wires owner_user_id
 *      to, so sender_user_id values follow the same shape · listing-chat
 *      is identity-agnostic (text column) but we keep the shape honest.
 *
 *   2. Anonymous visitor · reads `nex_dir_visitor` cookie; if absent,
 *      mints a `crypto.randomUUID()` and sets the cookie httpOnly for
 *      180 days. This is the only side-effect the resolver has, and it
 *      only writes · it never deletes or rotates. The cookie value is
 *      prefixed with `anon:` so a casual read of the DB cannot confuse
 *      an anonymous id with a signed-in account UUID.
 *
 * Cookie write happens via `cookies().set(...)` which is only allowed
 * inside a Server Action (not an RSC). This function is only called
 * from the three "use server" entry points below · correct by
 * construction.
 */
async function resolveViewerId(): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (session?.account?.id) return session.account.id;

  const store = await nextCookies();
  const existing = store.get(VISITOR_COOKIE_NAME)?.value;
  if (existing && existing.length > 0 && existing.length <= 128) {
    return existing;
  }
  const minted = `anon:${randomUUID()}`;
  // Set httpOnly so client JS cannot see it (prevents trivial
  // cross-visitor spoofing from a shared machine). SameSite=Lax is the
  // default Next behaviour but we set it explicitly so a future config
  // change does not loosen it to `None`.
  store.set(VISITOR_COOKIE_NAME, minted, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
  });
  return minted;
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Honest error handling · never leak pg / SQL fragments
// ═════════════════════════════════════════════════════════════════════

/** Map an unknown error into a short, non-leaky reason code. The sealed
 *  service may throw strings like `"empty_after_sanitise"` or raw pg
 *  errors (e.g. constraint violations). We ONLY surface a small sealed
 *  vocabulary; everything else collapses to `"unknown"`. */
function redactError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (lower.includes("empty_after_sanitise")) return "empty";
  if (lower.includes("body") && lower.includes("length")) return "too_long";
  if (lower.includes("too_long")) return "too_long";
  if (lower.includes("missing nex_postgres_url")) return "system_unavailable";
  if (lower.includes("no connection url")) return "system_unavailable";
  if (lower.includes("connect econnrefused")) return "system_unavailable";
  return "unknown";
}

// ═════════════════════════════════════════════════════════════════════
// §4 · System-bubble writer · the ONE path that is not sealed
// ═════════════════════════════════════════════════════════════════════

/**
 * Insert a `from_role='system'` row into `nex.listing_message` for the
 * given thread.
 *
 * The sealed service's `sendMessage` is hard-wired to
 * `from_role='sender'` (migration 165 permits three roles · the sealed
 * writer only supports one). To stay inside the "compose, don't
 * modify" rule, we open a connection from the same `kf-pool` the
 * sealed service uses and INSERT a row that respects every migration
 * 165 constraint:
 *
 *   · from_role       = 'system'      (allowed by ck_listing_message_role)
 *   · from_user_id    = NULL          (system has no viewer)
 *   · body length     ≤ 240 chars     (buildSystemBubble enforces)
 *   · meta            = sealed shape  (JSON with kind marker + flags)
 *
 * The write is idempotent at the caller level: it only runs when the
 * caller has just observed a freshly-created thread (one with zero
 * prior messages). The caller's guard is the single idempotency
 * barrier · we do not add a UNIQUE index on (thread_id, meta->>kind)
 * here because that would touch sealed DDL.
 */
async function writeSystemBubble(args: {
  thread_id: string;
  body: string;
  canonical_business_id: string;
}): Promise<void> {
  const pool = getKnowledgeFactoryDbPool();
  const meta = {
    kind: SYSTEM_BUBBLE_META_KIND,
    canonical_business_id: args.canonical_business_id,
    visibility: "parties_only",
    doctrine_7_scoped: true,
    ttl_hours: SYSTEM_BUBBLE_TTL_HOURS,
  };
  await pool.query(
    `INSERT INTO nex.listing_message
       (thread_id, from_role, from_user_id, body, sanitiser_neutralised, meta)
     VALUES ($1, 'system', NULL, $2, 0, $3::jsonb)`,
    [args.thread_id, args.body, JSON.stringify(meta)],
  );
  // Bump last_message_at so the thread sorts correctly. We deliberately
  // do NOT bump owner_unread_count — the system bubble is addressed to
  // the owner but doesn't carry a reply obligation.
  await pool.query(
    `UPDATE nex.listing_thread
        SET last_message_at = now()
      WHERE thread_id = $1`,
    [args.thread_id],
  );
}

/** Observe whether a thread row has any pre-existing messages. Used by
 *  the openListing flow to decide whether to write the system bubble.
 *  Doctrine #7 note: this is a count-only read keyed by thread_id · it
 *  never surfaces message bodies. */
async function threadHasAnyMessages(thread_id: string): Promise<boolean> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT 1 AS present
       FROM nex.listing_message
      WHERE thread_id = $1
      LIMIT 1`,
    [thread_id],
  );
  return r.rows.length > 0;
}

// ═════════════════════════════════════════════════════════════════════
// §5 · openListingThreadAction · first-contact flow
// ═════════════════════════════════════════════════════════════════════

/**
 * Open (or re-open) a listing-chat thread as the current viewer and
 * post their first (or subsequent) message. Behaviour summary:
 *
 *   First call against an unclaimed listing:
 *     · ensureThread creates the row
 *     · a system bubble is written FIRST (visible to both parties)
 *     · a (null-able) owner invite is attempted · ONLY sent when a
 *       public owner email is resolvable; otherwise the invite stays
 *       pending organically (no fabrication)
 *     · the viewer's message is appended via sealed sendMessage
 *     · returns { ok: true, thread_id, system_bubble: "nex_directory_first_contact_v1" }
 *
 *   Second call from the same viewer on the same listing:
 *     · ensureThread's ON CONFLICT clause returns the existing row
 *     · the pre-existing-messages guard skips the system-bubble write
 *     · the viewer's message is appended via sealed sendMessage
 *     · returns { ok: true, thread_id, system_bubble: null }
 *
 *   First call against a CLAIMED listing (OWNER_CLAIMED/OWNER_VERIFIED):
 *     · ensureThread creates the row
 *     · the system bubble is SKIPPED (claimed listings have an owner
 *       who already knows how to use NEX · no invite copy needed)
 *     · the owner invite is SKIPPED (same reason)
 *     · the viewer's message is appended via sealed sendMessage
 *     · returns { ok: true, thread_id, system_bubble: null }
 */
export async function openListingThreadAction(
  input: OpenListingThreadInput,
): Promise<OpenListingThreadResult | ActionFailure> {
  try {
    // Input validation · fail-closed on empty / oversize bodies before
    // any DB work. The sealed sendMessage also enforces length but
    // doing it here means we never create an orphan thread.
    const trimmed = (input.body ?? "").trim();
    if (trimmed.length === 0) return { ok: false, reason: "empty" };
    if (trimmed.length > 4000) return { ok: false, reason: "too_long" };
    if (!input.canonicalId || typeof input.canonicalId !== "string") {
      return { ok: false, reason: "invalid_listing" };
    }

    // Resolve the canonical row FIRST. If the business doesn't exist
    // (or the DB is unreachable), we fail-closed and never create a
    // thread against a non-existent listing_ref.
    const detail = await getCanonicalBusinessById(input.canonicalId);
    if (!detail.systemReady) return { ok: false, reason: "system_unavailable" };
    if (detail.result === null) return { ok: false, reason: "not_found" };

    const listing = detail.result.listing;
    const businessName = listing.name;
    const lifecycleState = listing.lifecycleState;
    const isClaimed = CLAIMED_LIFECYCLE_STATES.has(lifecycleState);

    const viewerId = await resolveViewerId();
    const listing_ref = canonicalListingRef(input.canonicalId);

    // Ensure the thread · idempotent via UNIQUE(listing_ref, sender_user_id).
    const thread = await ensureThread({
      listing_ref,
      sender_user_id: viewerId,
    });

    // Was this row brand-new? We can't tell from the sealed return
    // shape (ensureThread uses ON CONFLICT DO UPDATE on last_message_at
    // which doesn't return an "inserted" flag). Instead, we check
    // whether any messages exist under the thread yet · a thread with
    // zero messages is, by construction, one that has never been
    // "opened" for a conversation.
    const alreadyHasMessages = await threadHasAnyMessages(thread.thread_id);

    let systemBubbleKind: typeof SYSTEM_BUBBLE_META_KIND | null = null;

    if (!alreadyHasMessages && !isClaimed) {
      const body = buildSystemBubble({
        businessName,
        visitorLocation: {
          city: listing.city ?? null,
          country: listing.country ?? null,
        },
      });
      await writeSystemBubble({
        thread_id: thread.thread_id,
        body,
        canonical_business_id: input.canonicalId,
      });
      systemBubbleKind = SYSTEM_BUBBLE_META_KIND;

      // Owner-invite attempt · ONLY when a real email is resolvable.
      // The sealed resolver currently returns null for every row (the
      // owner-claim table is deferred to a future ADR), which means
      // the invite path stays pending organically. We still call it so
      // the flow lights up the moment the resolver becomes real.
      try {
        const ownerEmail = await tryResolveOwnerEmailFromListing(listing_ref);
        if (ownerEmail && ownerEmail.trim().length > 0) {
          await sendOwnerInviteEmail({
            thread_id: thread.thread_id,
            listing_ref,
            listing_business_name: businessName,
            owner_email: ownerEmail,
            first_message_body: trimmed,
            base_url:
              process.env.NEX_PUBLIC_BASE_URL
              ?? process.env.NEXT_PUBLIC_BASE_URL
              ?? "http://localhost:3008",
          });
        }
        // No else · no fabrication. The thread stays pending until an
        // owner surfaces through another channel.
      } catch {
        // Owner-invite failures (SMTP down, email malformed) must NEVER
        // break the visitor's send flow. Swallow and move on; the
        // outbound_email queue is the honest-fallback source of truth.
      }
    }

    // Finally · append the viewer's own first message via the sealed
    // writer. This runs the Doctrine #5 sanitiser internally.
    await sendMessage({
      listing_ref,
      sender_user_id: viewerId,
      body: trimmed,
    });

    return {
      ok: true,
      thread_id: thread.thread_id,
      system_bubble: systemBubbleKind,
    };
  } catch (err) {
    return { ok: false, reason: redactError(err) };
  }
}

// ═════════════════════════════════════════════════════════════════════
// §6 · listMessagesAction · Doctrine #7-scoped read
// ═════════════════════════════════════════════════════════════════════

/**
 * Read the current viewer's thread against the given listing. The
 * viewer must be a party to the thread · either its sender OR (when
 * signed-in and the owner-link ADR lands) its owner. If neither path
 * matches, we return an empty messages array · never leak another
 * party's thread.
 */
export async function listMessagesAction(
  input: ListMessagesInput,
): Promise<ListMessagesResult | ActionFailure> {
  try {
    if (!input.canonicalId || typeof input.canonicalId !== "string") {
      return { ok: false, reason: "invalid_listing" };
    }
    const viewerId = await resolveViewerId();
    const listing_ref = canonicalListingRef(input.canonicalId);

    // Primary path · viewer is the sender. This covers every anonymous
    // visitor plus every signed-in NEX account whose id was used as
    // sender_user_id when the thread was opened.
    const asSender = await readThreadForSender({
      listing_ref,
      sender_user_id: viewerId,
    });
    if (asSender.thread) {
      return { ok: true, messages: asSender.messages.map(toVM) };
    }

    // Secondary path · the viewer may be the OWNER of this listing's
    // thread (converted via a sealed owner-invite flow). The sealed
    // readThreadForOwner is keyed by thread_id + owner_user_id, so we
    // look up the thread by (listing_ref, owner_user_id) first and
    // then delegate. We do this via a minimal direct read because the
    // sealed service doesn't expose "find my thread by listing_ref as
    // owner" · it expects the caller to already know the thread_id.
    const pool = getKnowledgeFactoryDbPool();
    const ownerThread = await pool.query(
      `SELECT thread_id::text
         FROM nex.listing_thread
        WHERE listing_ref = $1 AND owner_user_id = $2
        LIMIT 1`,
      [listing_ref, viewerId],
    );
    const ownerThreadId = (ownerThread.rows[0] as { thread_id?: string } | undefined)?.thread_id;
    if (ownerThreadId) {
      const asOwner = await readThreadForOwner({
        thread_id: ownerThreadId,
        owner_user_id: viewerId,
      });
      if (asOwner.thread) {
        return { ok: true, messages: asOwner.messages.map(toVM) };
      }
    }

    // Neither sender nor owner · honest empty answer. We NEVER fall
    // through to a service-role read of someone else's thread.
    return { ok: true, messages: [] };
  } catch (err) {
    return { ok: false, reason: redactError(err) };
  }
}

/** Map a sealed row to the UI view-model. Drops operational fields the
 *  UI never needs (Doctrine #7 minimum-surface principle). */
function toVM(m: ListingMessageRow): ChatMessageVM {
  return {
    message_id: m.message_id,
    from_role: m.from_role,
    body: m.body,
    sent_at: m.sent_at,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §7 · sendMessageAction · subsequent-message write
// ═════════════════════════════════════════════════════════════════════

/**
 * Append a message to an EXISTING thread. The caller is expected to
 * have opened the thread with `openListingThreadAction` first · if no
 * thread exists for (listing_ref, viewer), this action returns
 * `"not_opened"` and does nothing.
 *
 * Validation guards:
 *   · empty body (after trim)                → "empty"
 *   · body length > 4000                     → "too_long"
 *   · thread does not exist for this viewer  → "not_opened"
 *   · DB unreachable / schema missing        → "system_unavailable"
 *
 * The sealed `sendMessage` already enforces the 1–4000 CHECK and runs
 * the Doctrine #5 sanitiser; the guards here fail fast and never
 * create a thread as a side effect of a "subsequent" write.
 */
export async function sendMessageAction(
  input: SendMessageInput,
): Promise<SendMessageActionResult | ActionFailure> {
  try {
    const trimmed = (input.body ?? "").trim();
    if (trimmed.length === 0) return { ok: false, reason: "empty" };
    if (trimmed.length > 4000) return { ok: false, reason: "too_long" };
    if (!input.canonicalId || typeof input.canonicalId !== "string") {
      return { ok: false, reason: "invalid_listing" };
    }

    const viewerId = await resolveViewerId();
    const listing_ref = canonicalListingRef(input.canonicalId);

    // Doctrine #7 · verify the viewer already has a thread for this
    // listing BEFORE writing. We never silently open a new thread on
    // behalf of a "subsequent" message call.
    const existing = await readThreadForSender({
      listing_ref,
      sender_user_id: viewerId,
    });
    if (!existing.thread) {
      return { ok: false, reason: "not_opened" };
    }

    const result = await sendMessage({
      listing_ref,
      sender_user_id: viewerId,
      body: trimmed,
    });
    return { ok: true, message_id: result.message.message_id };
  } catch (err) {
    return { ok: false, reason: redactError(err) };
  }
}
