"use server";

// src/app/nex-native/_actions.ts
//
// Server Actions for the NEX-native conversation workspace + merchant
// manage surface + customer orders.
//
// All authentication is Supabase Auth against the authoritative NEX
// Supabase project (ijvqdvsvwtwxzcqmoqit). No mock persistence. Every
// mutation goes through nex-native services.
//
// This file was reconstructed 2026-09-24 after a disk-full incident
// wiped the previous version. All actions below are proven end-to-end
// by the Reality Check scripts in scripts/nex-*-reality-check.mts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  nexAppSsrServerClient,
  resolveNexAppSessionFromContext,
} from "@/lib/nex-native/app/session";
import * as conversationService from "@/lib/nex-native/conversation-service";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as sellerResponsivenessService from "@/lib/nex-native/seller-responsiveness-service";
import * as chatThemeService from "@/lib/nex-native/chat-theme-service";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as menuService from "@/lib/nex-native/menu-service";
import * as safeTradeConsentService from "@/lib/nex-native/safe-trade-consent-service";
import * as reportService from "@/lib/nex-native/report-service";
import * as likedProductService from "@/lib/nex-native/liked-product-service";
import * as orderService from "@/lib/nex-native/order-service";
import * as commerceService from "@/lib/nex-native/commerce-service";
import * as cartService from "@/lib/nex-native/cart-service";
import {
  NEX_DELIVERY_ADDRESS_EMPTY,
  type NexCartItem,
  type NexDeliveryAddress,
} from "@/lib/nex-native/cart-types";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as bannerService from "@/lib/nex-native/banner-service";
import * as relationshipService from "@/lib/nex-native/relationship-service";
import * as emailService from "@/lib/nex-native/email-service";
import * as siteService from "@/lib/nex-native/site-service";
import { DEFAULT_SITE_GEN_ADAPTER } from "@/lib/nex-native/site-gen-adapter";
import type { NexBannerPalette, NexBannerStatus } from "@/lib/nex-native/banner-service";
import { NEX_BANNER_PALETTES, NEX_BANNER_STATUSES } from "@/lib/nex-native/banner-service";
import * as liveService from "@/lib/nex-native/live-service";
import { NEX_ACCOUNT_KINDS, NEX_ACCOUNT_TIERS, NEX_CHAT_THEMES, NEX_PRODUCT_STOCK_STATUSES, type NexAccountKind, type NexAccountTier, type NexChatTheme, type NexProductStockStatus } from "@/lib/nex-native/types";
import { enqueueNexReply } from "@/lib/nex-native/intelligence/enqueue-nex-reply";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Redirect-with-banner helpers
// ---------------------------------------------------------------------------

function redirectToInboxWithError(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/conversations?${qs.toString()}`);
}

function redirectToCreateAccountWithError(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/create-account?${qs.toString()}`);
}

function redirectToSignInWithError(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/sign-in?${qs.toString()}`);
}

// -------------------------------------------------------------------------
// NEX create-account (reference-design) · sealed 2026-09-25.
// The new reference design has three fields only: full name / email /
// password. Phone stays optional per Founder direction (visual is
// authoritative · no extra fields). Uses the same Supabase auth backbone
// as signUpAction, just without the phone requirement.
// -------------------------------------------------------------------------
export async function createNexAccountAction(formData: FormData): Promise<never> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const phoneCountryCodeRaw = String(formData.get("phone_country_code") ?? "").trim();
  const phoneNationalNumberRaw = String(formData.get("phone_national_number") ?? "").trim();

  if (!fullName) redirectToCreateAccountWithError("missing_name", "Enter your full name");
  if (!email) redirectToCreateAccountWithError("missing_email", "Enter your email");
  if (!password || password.length < 6) {
    redirectToCreateAccountWithError("short_password", "Password must be 6+ characters");
  }
  // Phone shape · same CHECKs as migration 024: country code +digits (1-4),
  // national number 5-15 digits. Whitespace / dashes / parens stripped so
  // "+62 812-345-6789" resolves cleanly.
  const phoneCountryCode = phoneCountryCodeRaw;
  const phoneNationalNumber = phoneNationalNumberRaw.replace(/[\s\-()]/g, "");
  if (!phoneCountryCode || !/^\+[0-9]{1,4}$/.test(phoneCountryCode)) {
    redirectToCreateAccountWithError(
      "invalid_phone_country_code",
      "Country code required · format like +44 · digits only after the +",
    );
  }
  if (!phoneNationalNumber || !/^[0-9]{5,15}$/.test(phoneNationalNumber)) {
    redirectToCreateAccountWithError(
      "invalid_phone_number",
      "Phone number required · digits only · 5-15 characters",
    );
  }

  const supabase = await nexAppSsrServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: fullName,
        phone_country_code: phoneCountryCode,
        phone_national_number: phoneNationalNumber,
      },
    },
  });
  if (error) redirectToCreateAccountWithError("sign_up_failed", error.message);

  if (data.user?.id) {
    try {
      const existing = await accountService.getAccountBySupabaseUserId(data.user.id);
      if (!existing) {
        await accountService.createAccount({
          supabase_user_id: data.user.id,
          display_name: fullName,
          phone_country_code: phoneCountryCode,
          phone_national_number: phoneNationalNumber,
        });
      }
    } catch {
      /* non-fatal · resolveFromUser will create + backfill on first sign-in */
    }
  }

  if (!data.session) {
    redirectToCreateAccountWithError(
      "email_confirmation_required",
      "Check your email for a confirmation link, then sign in.",
    );
  }
  // Bridge 2 · after account creation, walk the "what best describes what
  // you do?" step. The kind route checks for session itself and falls back
  // to the inbox if the user reloads without one.
  revalidatePath("/nex-native/create-account/kind");
  redirect("/nex-native/create-account/kind");
}

function redirectToOnboardingWithError(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/onboarding?${qs.toString()}`);
}

function redirectToManageWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage?${qs.toString()}`);
}

function redirectToManageOrdersWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/orders?${qs.toString()}`);
}

// Friends-page equivalent · same pattern for /nex-native/friends.
function redirectToFriendsWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/friends?${qs.toString()}`);
}

// Banners-page equivalent · same pattern for /nex-native/manage/banners.
function redirectToManageBannersWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/banners?${qs.toString()}`);
}

// Live-page (merchant surface) equivalent · same pattern for /nex-native/manage/live.
function redirectToManageLiveWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/live?${qs.toString()}`);
}

// Contacts-page equivalent · Wave B Slice 3f-b.
function redirectToContactsWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/contacts?${qs.toString()}`);
}

// Site builder · Wave D Slice 16a
function redirectToSiteBuilderWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/site?${qs.toString()}`);
}

// Email lists · Wave C Slice 11b
function redirectToEmailListsWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/email?${qs.toString()}`);
}
function redirectToEmailListWithBanner(listId: string, code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/manage/email/${listId}?${qs.toString()}`);
}

// Mirrors the DB CHECK on nex_business.slug (migration 002)
const NEX_SLUG_REGEX = /^[a-z0-9]([-a-z0-9]{0,62}[a-z0-9])?$/;

// ---------------------------------------------------------------------------
// Auth actions
// ---------------------------------------------------------------------------

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    redirectToSignInWithError("missing_credentials", "email and password required");
  }
  const supabase = await nexAppSsrServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirectToSignInWithError("sign_in_failed", error.message);
  }
  revalidatePath("/nex-native/home");
  redirect("/nex-native/home");
}

/** One-click dev-only sign-in as the provisioned Dev Admin account. Gated
 *  by NEX_ALLOW_DEV_ADMIN=1 in .env.local · never enabled in production.
 *  Uses the well-known credentials from scripts/nex-provision-dev-admin.mts. */
export async function signInAsDevAdminAction(_formData: FormData): Promise<never> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") {
    redirectToSignInWithError(
      "dev_admin_disabled",
      "dev-admin sign-in is disabled · set NEX_ALLOW_DEV_ADMIN=1 in .env.local",
    );
  }
  const supabase = await nexAppSsrServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: "dev-admin@nex-native.local",
    password: "NexDevAdmin!2026",
  });
  if (error) {
    redirectToSignInWithError(
      "dev_admin_sign_in_failed",
      `${error.message} · run 'npx tsx scripts/nex-provision-dev-admin.mts' to provision the dev account`,
    );
  }
  revalidatePath("/nex-native/home");
  redirect("/nex-native/home");
}

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("password_confirm") ?? "");
  const phoneCountryCodeRaw = String(formData.get("phone_country_code") ?? "").trim();
  const phoneNationalNumberRaw = String(formData.get("phone_national_number") ?? "").trim();

  if (!email || !password) {
    redirectToInboxWithError("missing_credentials", "email and password required");
  }
  if (password.length < 6) {
    redirectToInboxWithError("short_password", "password must be 6+ chars");
  }
  if (password !== passwordConfirm) {
    redirectToInboxWithError("password_mismatch", "passwords do not match · type the same password twice");
  }
  // Normalise phone inputs · strip common separators from national number
  const phoneCountryCode = phoneCountryCodeRaw;
  const phoneNationalNumber = phoneNationalNumberRaw.replace(/[\s\-()]/g, "");
  if (!phoneCountryCode || !/^\+[0-9]{1,4}$/.test(phoneCountryCode)) {
    redirectToInboxWithError(
      "invalid_phone_country_code",
      "country code required · format like +44 · digits only after the +",
    );
  }
  if (!phoneNationalNumber || !/^[0-9]{5,15}$/.test(phoneNationalNumber)) {
    redirectToInboxWithError(
      "invalid_phone_number",
      "phone number required · digits only · 5-15 characters (no spaces or dashes)",
    );
  }

  const supabase = await nexAppSsrServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone_country_code: phoneCountryCode,
        phone_national_number: phoneNationalNumber,
      },
    },
  });
  if (error) {
    redirectToInboxWithError("sign_up_failed", error.message);
  }

  // Immediately create the nex_account row with the phone attributes so
  // the values are persisted regardless of when the user confirms email.
  // Idempotent: if resolveFromUser later finds the row it reuses it.
  if (data.user?.id) {
    try {
      const existing = await accountService.getAccountBySupabaseUserId(data.user.id);
      if (!existing) {
        await accountService.createAccount({
          supabase_user_id: data.user.id,
          display_name: email.split("@")[0] || email,
          phone_country_code: phoneCountryCode,
          phone_national_number: phoneNationalNumber,
        });
      }
    } catch {
      /* non-fatal · resolveFromUser will create + backfill on first sign-in */
    }
  }

  if (!data.session) {
    redirectToInboxWithError(
      "email_confirmation_required",
      "check your email for a confirmation link before signing in"
    );
  }
  revalidatePath("/nex-native/home");
  redirect("/nex-native/home");
}

export async function signOutAction(): Promise<never> {
  const supabase = await nexAppSsrServerClient();
  await supabase.auth.signOut();
  revalidatePath("/nex-native/sign-in");
  redirect("/nex-native/sign-in");
}

// ---------------------------------------------------------------------------
// Conversation · post a message · enqueues a NEX reply
// ---------------------------------------------------------------------------

export async function postMessageAction(
  conversationId: string,
  formData: FormData
): Promise<never> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    redirect(`/nex-native/conversations/${conversationId}`);
  }

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to send messages");
  }

  const participation = await conversationService.getParticipation(
    conversationId,
    session.account.id
  );
  if (!participation) {
    redirect(`/nex-native/conversations/${conversationId}`);
  }

  await conversationService.postMessage({
    conversation_id: conversationId,
    sender_account_id: session.account.id,
    body,
  });

  // Enqueue an NEX reply through the queue (Wave 10). Best-effort · never
  // fabricates a reply, never blocks the send on generation.
  try {
    await enqueueNexReply({
      conversationId,
      requestedByAccountId: session.account.id,
      side: participation.side,
    });
  } catch {
    /* non-fatal · reply arrives when engine drains, or not at all */
  }

  revalidatePath(`/nex-native/conversations/${conversationId}`);
  redirect(`/nex-native/conversations/${conversationId}`);
}

// ---------------------------------------------------------------------------
// Bridge 3 · peer-to-peer chat
// ---------------------------------------------------------------------------

/** Send a message on a peer (friend↔friend) conversation. The action
 *  takes the *peer's* account id (not conversation id) so callers don't
 *  need to know the conversation exists · it's created lazily on the
 *  first send. Redirects back to the same peer chat surface after send. */
export async function sendPeerMessageAction(
  peerAccountId: string,
  formData: FormData,
): Promise<never> {
  const body = String(formData.get("body") ?? "").trim();
  // Bridge 8+9 · optional attachment carried on the form. When set,
  // an empty body is allowed (image/video/voice-only messages).
  const attachmentUrl =
    String(formData.get("attachment_url") ?? "").trim() || null;
  const attachmentTypeRaw =
    String(formData.get("attachment_type") ?? "").trim() || null;
  const attachmentType: "image" | "video" | "audio" | null =
    attachmentTypeRaw === "image" ||
    attachmentTypeRaw === "video" ||
    attachmentTypeRaw === "audio"
      ? attachmentTypeRaw
      : null;
  if (!body && !attachmentUrl) {
    redirect(`/nex-native/chat/peer/${peerAccountId}`);
  }
  // Optional reply target · when set, the message quotes the referenced
  // message id · service validates it belongs to the same conversation.
  const replyToRaw = String(formData.get("reply_to_id") ?? "").trim();
  const replyToId = replyToRaw && replyToRaw.length >= 32 ? replyToRaw : null;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/sign-in`);
  }
  if (peerAccountId === session.account.id) {
    // Self-chat is not supported · bounce back.
    redirect(`/nex-native/chat`);
  }

  const conversation = await peerConversationService.getOrCreatePeerConversation(
    session.account.id,
    peerAccountId,
  );

  await peerMessageService.sendPeerMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body,
    reply_to_id: replyToId,
    attachment_url: attachmentUrl,
    attachment_type: attachmentType,
  });

  // Bridge 13 · every send bumps the sender's shop activity so the
  // green pulse on their landing stays honest. Best-effort · a
  // signal failure never blocks the send.
  await sellerResponsivenessService
    .markBusinessOwnerActive(session.account.id)
    .catch(() => {});

  revalidatePath(`/nex-native/chat/peer/${peerAccountId}`);
  redirect(`/nex-native/chat/peer/${peerAccountId}`);
}

/** Bridge 8+9 · upload a file (photo, video, or voice note) to the
 *  peer-chat attachments bucket, then redirect back to the peer chat
 *  surface with `?attachment_url=...&attachment_type=...` on the URL.
 *  The composer reads those query params, shows a preview thumbnail,
 *  and includes them in the next send form. This split (upload →
 *  compose → send) means the user can add text to accompany the
 *  attachment before committing the message. */
export async function uploadPeerAttachmentAction(
  peerAccountId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) {
    redirect(`/nex-native/chat`);
  }

  const file = formData.get("attachment_file");
  if (!(file instanceof File) || file.size === 0) {
    // Nothing to upload · bounce back without state.
    redirect(`/nex-native/chat/peer/${peerAccountId}`);
  }

  let successUrl: { url: string; kind: string } | null = null;
  let failure: string | null = null;
  try {
    const { url, kind } = await peerMessageService.uploadPeerAttachment(
      session.account.id,
      file,
    );
    successUrl = { url, kind };
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }

  // Redirects live outside the try/catch so Next's internal
  // NEXT_REDIRECT throw always bubbles cleanly.
  if (successUrl) {
    const qs = new URLSearchParams({
      attachment_url: successUrl.url,
      attachment_type: successUrl.kind,
    });
    redirect(`/nex-native/chat/peer/${peerAccountId}?${qs.toString()}`);
  }
  const qs = new URLSearchParams({ upload_error: failure ?? "unknown" });
  redirect(`/nex-native/chat/peer/${peerAccountId}?${qs.toString()}`);
}

/** Bridge 13b · turn shop Away mode on. Owner-only · reads
 *  away_until (YYYY-MM-DD) + optional away_message from the form.
 *  Redirects back to /manage/shop with a banner. */
export async function setBusinessAwayModeAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=away_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const awayUntilRaw = String(formData.get("away_until") ?? "").trim();
  const awayMessage =
    String(formData.get("away_message") ?? "").trim() || null;
  // Client sends YYYY-MM-DD from <input type="date"> · normalise to
  // an ISO timestamp at end-of-day so "back on the 5th" behaves as
  // expected (i.e. away through the whole 4th).
  const awayUntil = awayUntilRaw
    ? new Date(awayUntilRaw + "T23:59:59Z").toISOString()
    : null;

  try {
    await sellerResponsivenessService.setAwayMode(businessId, {
      awayUntil,
      awayMessage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=away_failed&m=" + encodeURIComponent(msg),
    );
  }
  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=away_on&m=" +
      encodeURIComponent(
        awayUntil
          ? `Away mode on · back on ${new Date(awayUntil).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`
          : "Away mode on",
      ),
  );
}

/** Bridge 13b · end shop Away mode · owner-only. */
export async function endBusinessAwayModeAction(
  businessId: string,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=away_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  try {
    await sellerResponsivenessService.endAwayMode(businessId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=away_failed&m=" + encodeURIComponent(msg),
    );
  }
  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=away_off&m=" +
      encodeURIComponent("Away mode off · shop is active"),
  );
}

/** Bridge 13b · update a single product's stock_status · owner-only.
 *  Called by the pill toggles on /manage/shop. */
export async function updateProductStockStatusAction(
  productId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const stockStatusRaw = String(
    formData.get("stock_status") ?? "",
  ).trim();
  const allowed = new Set([
    "in_stock",
    "low_stock",
    "made_to_order",
    "sold_out",
  ]);
  if (!allowed.has(stockStatusRaw)) {
    redirect(
      "/nex-native/manage/shop?e=stock_failed&m=" +
        encodeURIComponent("Unknown stock status"),
    );
  }

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      "/nex-native/manage/shop?e=stock_failed&m=" +
        encodeURIComponent("Product not found"),
    );
  }
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=stock_forbidden&m=" +
        encodeURIComponent("You don't own this product"),
    );
  }

  try {
    await productService.updateProductStockStatus(
      productId,
      stockStatusRaw as "in_stock" | "low_stock" | "made_to_order" | "sold_out",
    );
    // Any product edit counts as seller activity · keeps the shop's
    // green pulse honest even when the seller isn't chatting.
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=stock_failed&m=" + encodeURIComponent(msg),
    );
  }
  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath(`/nex-native/${business.slug}/${productId}`);
  redirect(
    "/nex-native/manage/shop?e=stock_ok&m=" +
      encodeURIComponent(`${product.name} · ${stockStatusRaw.replace("_", " ")}`),
  );
}

/** Bridge 14 · update a business's category + search keywords ·
 *  owner-only. Keywords come in as a comma-separated string from
 *  the /manage/shop form. */
export async function updateBusinessCategoryAndKeywordsAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=category_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const categoryRaw = String(formData.get("business_category") ?? "").trim();
  const keywordsRaw = String(formData.get("search_keywords") ?? "");
  const keywords = keywordsRaw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  try {
    await businessService.updateBusinessCategoryAndKeywords(businessId, {
      category: categoryRaw || null,
      keywords: keywords.length > 0 ? keywords : null,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=category_failed&m=" + encodeURIComponent(msg),
    );
  }
  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath("/nex-native/search");
  redirect(
    "/nex-native/manage/shop?e=category_ok&m=" +
      encodeURIComponent("Category and keywords updated"),
  );
}

/** Bridge 16d · file a report against another user (scam,
 *  harassment, prohibited goods, etc.). Snapshots the peer
 *  conversation into chat_snapshot so evidence survives even if
 *  the reported party later deletes messages. Called by the
 *  report modal in the peer chat 3-dot menu. */
export async function reportUserAction(
  reportedAccountId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (reportedAccountId === session.account.id) {
    redirect(
      "/nex-native/support?topic=report&report_error=" +
        encodeURIComponent("You cannot report yourself"),
    );
  }

  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const backHref =
    String(formData.get("back") ?? "").trim() ||
    `/nex-native/chat/peer/${reportedAccountId}`;
  const isBackSafe =
    backHref.startsWith("/nex-native/") && !backHref.includes("?e=");
  const safeBack = isBackSafe
    ? backHref
    : `/nex-native/chat/peer/${reportedAccountId}`;

  if (
    !(reportService.NEX_REPORT_REASONS as readonly string[]).includes(
      reasonRaw,
    )
  ) {
    redirect(
      safeBack +
        (safeBack.includes("?") ? "&" : "?") +
        "report_error=" +
        encodeURIComponent("Please choose a reason"),
    );
  }

  try {
    await reportService.createReport({
      reporterAccountId: session.account.id,
      reportedAccountId,
      reason: reasonRaw as reportService.NexReportReason,
      note: note || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      safeBack +
        (safeBack.includes("?") ? "&" : "?") +
        "report_error=" +
        encodeURIComponent(msg),
    );
  }

  redirect(
    safeBack +
      (safeBack.includes("?") ? "&" : "?") +
      "report_ok=1",
  );
}

/** Bridge 16d · update the signed-in user's locale preference.
 *  Called from Settings and from an inline language toggle on
 *  legal-facing pages. Falls back to the /settings surface after
 *  write. */
export async function updateAccountLocaleAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const localeRaw = String(formData.get("locale") ?? "").trim();
  const nextHref = String(formData.get("next") ?? "").trim();
  const safeNext =
    nextHref.startsWith("/nex-native/") && !nextHref.includes("?e=")
      ? nextHref
      : "/nex-native/settings/language";

  const locale: "id" | "en" | null =
    localeRaw === "id" || localeRaw === "en" ? localeRaw : null;

  try {
    await accountService.updateAccountLocale(session.account.id, locale);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      safeNext +
        (safeNext.includes("?") ? "&" : "?") +
        "locale_error=" +
        encodeURIComponent(msg),
    );
  }

  revalidatePath(safeNext);
  redirect(safeNext);
}

/** Bridge 17d · flip the seller's safe-trade commitment flag.
 *  Called by a toggle on /manage/shop. */
export async function setBusinessSafeTradeActivatedAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=safe_trade_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const activated = String(formData.get("activated") ?? "").trim() === "true";

  try {
    await businessService.setSafeTradeActivated(businessId, activated);
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=safe_trade_failed&m=" +
        encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=safe_trade_ok&m=" +
      encodeURIComponent(
        activated ? "Safe trade activated" : "Safe trade deactivated",
      ),
  );
}

/** Bridge 16e · update the seller's city + free-text opening
 *  hours. Called by the "About page" section on /manage/shop. */
export async function updateBusinessCityAndHoursAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=about_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const cityInput = String(formData.get("city") ?? "").trim();
  const hoursDisplayInput = String(formData.get("hours_display") ?? "").trim();

  try {
    await businessService.updateBusinessCityAndHours(businessId, {
      city: cityInput.length > 0 ? cityInput : null,
      hoursDisplay:
        hoursDisplayInput.length > 0 ? hoursDisplayInput : null,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=about_failed&m=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=about_ok&m=" +
      encodeURIComponent("About page updated"),
  );
}

/** Bridge 25d · Save the seller's pickup lat/lng for the /cart bike-
 *  delivery estimator. Reads latitude + longitude off the form ·
 *  passing empty strings clears both. */
export async function updateBusinessLocationAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=location_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const latRaw = String(formData.get("location_lat") ?? "").trim();
  const lngRaw = String(formData.get("location_lng") ?? "").trim();
  const lat = latRaw.length > 0 ? Number.parseFloat(latRaw) : null;
  const lng = lngRaw.length > 0 ? Number.parseFloat(lngRaw) : null;

  try {
    await businessService.updateBusinessLocation(business.id, { lat, lng });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=location_failed&m=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=location_ok&m=" +
      encodeURIComponent("Pickup location saved"),
  );
}

/** Bridge 23b · update the seller's events profile jsonb. Every
 *  checkbox / number / text field arrives on formData and the service
 *  normalises + clamps before writing. Called from /manage/venue.
 *  Non-venue businesses can still call this; the About surface just
 *  won't render the section when nothing is set. */
export async function updateBusinessEventsProfileAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/venue?e=events_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const seatCapacityRaw = String(formData.get("seat_capacity") ?? "").trim();
  const seatCapacity = seatCapacityRaw.length
    ? Number.parseInt(seatCapacityRaw, 10)
    : null;

  try {
    await businessService.updateBusinessEventsProfile(businessId, {
      hosts_parties: formData.get("hosts_parties") === "on",
      seat_capacity:
        seatCapacity !== null && Number.isFinite(seatCapacity)
          ? seatCapacity
          : null,
      outside_catering: formData.get("outside_catering") === "on",
      has_live_music_or_dj: formData.get("has_live_music_or_dj") === "on",
      can_book_private_party: formData.get("can_book_private_party") === "on",
      has_sound_system_pa: formData.get("has_sound_system_pa") === "on",
      other_event_info:
        String(formData.get("other_event_info") ?? "").trim() || null,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/venue?e=events_failed&m=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/venue");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/venue?e=events_ok&m=" +
      encodeURIComponent("Event profile updated"),
  );
}

/** Bridge 23c-1 · Upload a single venue photo from a phone / laptop
 *  file picker. Owner-only. Returns the public URL as JSON so the
 *  client can put it into the next empty gallery slot without a page
 *  reload. Rejects non-image files. */
export async function uploadVenuePhotoAction(
  businessId: string,
  formData: FormData,
): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    return { ok: false, error: "not_owner" };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "no_file" };
  }

  try {
    const { url } = await businessService.uploadVenuePhoto(business.id, file);
    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "upload_failed",
    };
  }
}

/** Bridge 23b · replace the seller's venue_gallery text[] with the
 *  ordered set of URLs the client just uploaded. Client owns the
 *  upload flow (Bridge 8+9 attachments bucket already exists) · this
 *  action just persists the final URL list. */
export async function updateBusinessVenueGalleryAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/venue?e=gallery_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const urlsRaw = String(formData.get("urls") ?? "").trim();
  let urls: string[] = [];
  try {
    if (urlsRaw) {
      const parsed = JSON.parse(urlsRaw);
      if (Array.isArray(parsed)) urls = parsed.map((x) => String(x));
    }
  } catch {
    redirect(
      "/nex-native/manage/venue?e=gallery_failed&m=" +
        encodeURIComponent("Invalid gallery payload"),
    );
  }

  try {
    await businessService.updateBusinessVenueGallery(businessId, urls);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/venue?e=gallery_failed&m=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/venue");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/venue?e=gallery_ok&m=" +
      encodeURIComponent("Gallery updated"),
  );
}

/** Bridge 16b · record the buyer's/seller's acknowledgement of the
 *  NEX safe-trade doctrine + terms. Called by the JIT modal on
 *  first commerce chat entry. Stamps
 *  nex_account.safe_trade_consent_at + version. */
export async function acknowledgeSafeTradeAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nextHref = String(formData.get("next") ?? "").trim();
  const safeNext =
    nextHref.startsWith("/nex-native/") && !nextHref.includes("?e=")
      ? nextHref
      : "/nex-native/chat";

  try {
    await safeTradeConsentService.recordSafeTradeConsent(session.account.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      safeNext +
        (safeNext.includes("?") ? "&" : "?") +
        "consent_error=" +
        encodeURIComponent(msg),
    );
  }

  revalidatePath(safeNext);
  redirect(safeNext);
}

/** Bridge 16a · update the seller's accepted payment methods.
 *  Enforces the safe-trade chip vocabulary at the service layer ·
 *  action just marshals FormData.getAll and passes through. */
export async function updateBusinessPaymentMethodsAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=payments_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const methods = formData
    .getAll("payment_methods")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  try {
    await businessService.updateBusinessPaymentMethods(businessId, methods);
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=payments_failed&m=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=payments_ok&m=" +
      encodeURIComponent("Payment methods updated"),
  );
}

/** Bridge 13c · update a single product's dispatch_time +
 *  sample_request_time · owner-only. Called by the two text
 *  inputs on /manage/shop under each product row. */
export async function updateProductTurnaroundAction(
  productId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const dispatchTime = String(formData.get("dispatch_time") ?? "");
  const sampleTime = String(formData.get("sample_request_time") ?? "");

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      "/nex-native/manage/shop?e=turnaround_failed&m=" +
        encodeURIComponent("Product not found"),
    );
  }
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=turnaround_forbidden&m=" +
        encodeURIComponent("You don't own this product"),
    );
  }

  try {
    await productService.updateProductTurnaround(productId, {
      dispatchTime,
      sampleRequestTime: sampleTime,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=turnaround_failed&m=" +
        encodeURIComponent(msg),
    );
  }
  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath(`/nex-native/${business.slug}/${productId}`);
  redirect(
    "/nex-native/manage/shop?e=turnaround_ok&m=" +
      encodeURIComponent(`${product.name} · turnaround updated`),
  );
}

/** Bridge 6 · retract a peer message ("delete for everyone").
 *  Sender-only within a 1-hour window · service enforces both. */
/** Bridge 11 · send a product inquiry from the peer's shop into the
 *  chat. Called when the user taps "Ask about this" or "I want this"
 *  in the product detail sheet. Fetches the product, snapshots it into
 *  attachment_meta, then sends via peerMessageService with
 *  attachment_type='product'. The default body is derived from intent
 *  but the client may override via the `custom_body` field. */
export async function sendProductInquiryAction(
  peerAccountId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  const productId = String(formData.get("product_id") ?? "").trim();
  const intentRaw = String(formData.get("intent") ?? "").trim();
  const intent: "ask" | "want" =
    intentRaw === "want" ? "want" : "ask";
  const customBody = String(formData.get("body") ?? "").trim();
  // Bridge 19 · quantity from the +/- picker on product detail.
  const qtyRaw = String(formData.get("quantity") ?? "").trim();
  const qtyParsed = Number.parseInt(qtyRaw, 10);
  const quantity =
    Number.isFinite(qtyParsed) && qtyParsed >= 1 && qtyParsed <= 999
      ? qtyParsed
      : 1;

  if (!productId) redirect(`/nex-native/chat/peer/${peerAccountId}`);

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      `/nex-native/chat/peer/${peerAccountId}?product_error=not_found`,
    );
  }
  // Sanity: product must belong to the peer's business · we don't want
  // users injecting arbitrary product ids into someone else's chat.
  const businesses = await businessService.listBusinessesByOwner(
    peerAccountId,
  );
  const ownedByPeer = businesses.some((b) => b.id === product.business_id);
  if (!ownedByPeer) {
    redirect(
      `/nex-native/chat/peer/${peerAccountId}?product_error=not_from_peer`,
    );
  }
  const business = businesses.find((b) => b.id === product.business_id)!;

  const snapshot: peerMessageService.NexPeerProductSnapshot = {
    product_id: product.id,
    business_id: business.id,
    business_slug: business.slug ?? null,
    name: product.name,
    price_pence: product.price_pence,
    currency: product.currency,
    image_url: product.image_url ?? null,
    short_description:
      product.description?.split(/[.··]/)[0]?.trim().slice(0, 140) ?? null,
  };

  const qtyPrefix = quantity > 1 ? `${quantity}× ` : "";
  const defaultBody =
    intent === "want"
      ? `I'd like to buy ${qtyPrefix}${product.name} · what's next?`
      : `Is the ${product.name} still available?`;
  const body = customBody || defaultBody;

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peerAccountId,
    );

  // The DB pair-check + service both require url+type set together ·
  // when a product has no image we skip the attachment entirely and
  // send the inquiry as plain text (still with the product name in
  // the body). Once we relax the pair-check for product type, this
  // guard can go away.
  const hasImage = !!product.image_url;
  await peerMessageService.sendPeerMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body,
    attachment_url: hasImage ? product.image_url : null,
    attachment_type: hasImage ? "product" : null,
    attachment_meta: hasImage ? { product: snapshot } : null,
  });

  revalidatePath(`/nex-native/chat/peer/${peerAccountId}`);
  redirect(`/nex-native/chat/peer/${peerAccountId}`);
}

/** Bridge 15c · send a dish inquiry from a restaurant/cafe menu into
 *  the peer chat. Mirrors sendProductInquiryAction · snapshots the
 *  dish (with spice, dietary, portion) into attachment_meta so the
 *  bubble renders an inline menu-item card. Called by "Chat about X"
 *  on /nex-native/[slug]/menu and the dish detail sheet. */
export async function sendMenuItemInquiryAction(
  peerAccountId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  const menuItemId = String(formData.get("menu_item_id") ?? "").trim();
  const intentRaw = String(formData.get("intent") ?? "").trim();
  const intent: "ask" | "order" = intentRaw === "order" ? "order" : "ask";
  const customBody = String(formData.get("body") ?? "").trim();

  if (!menuItemId) redirect(`/nex-native/chat/peer/${peerAccountId}`);

  const item = await menuService.getMenuItemById(menuItemId);
  if (!item) {
    redirect(
      `/nex-native/chat/peer/${peerAccountId}?menu_error=not_found`,
    );
  }
  // Sanity: dish must belong to the peer's business.
  const businesses = await businessService.listBusinessesByOwner(
    peerAccountId,
  );
  const ownedByPeer = businesses.some((b) => b.id === item.business_id);
  if (!ownedByPeer) {
    redirect(
      `/nex-native/chat/peer/${peerAccountId}?menu_error=not_from_peer`,
    );
  }
  const business = businesses.find((b) => b.id === item.business_id)!;

  // Resolve section name for the snapshot · nice-to-have context.
  let sectionName: string | null = null;
  if (item.section_id) {
    const sections = await menuService.listSectionsByBusiness(business.id);
    sectionName = sections.find((s) => s.id === item.section_id)?.name ?? null;
  }

  const snapshot: peerMessageService.NexPeerMenuItemSnapshot = {
    menu_item_id: item.id,
    business_id: business.id,
    business_slug: business.slug ?? null,
    section_name: sectionName,
    name: item.name,
    price_pence: item.price_pence,
    currency: item.currency,
    image_url: item.image_url ?? null,
    short_description:
      item.description?.split(/[.··]/)[0]?.trim().slice(0, 140) ?? null,
    spice_level: item.spice_level,
    dietary_tags: item.dietary_tags,
    portion_note: item.portion_note,
    perks: item.perks ?? [],
    perks_note: item.perks_note ?? null,
  };

  const defaultBody =
    intent === "order"
      ? `I'd like to order the ${item.name} · what's next?`
      : `Is the ${item.name} available?`;
  const body = customBody || defaultBody;

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peerAccountId,
    );

  const hasImage = !!item.image_url;
  await peerMessageService.sendPeerMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body,
    attachment_url: hasImage ? item.image_url : null,
    attachment_type: hasImage ? "menu_item" : null,
    attachment_meta: hasImage ? { menu_item: snapshot } : null,
  });

  revalidatePath(`/nex-native/chat/peer/${peerAccountId}`);
  redirect(`/nex-native/chat/peer/${peerAccountId}`);
}

/** Bridge 22 · post a cart order to the seller's peer chat.
 *  Called by the /nex-native/cart page's "Send order to <shop>"
 *  button. The client serialises the whole cart (for this shop
 *  only) into a JSON payload; the server validates + snapshots
 *  into attachment_meta.cart · buyers see it as a rich card and
 *  sellers see exactly what was ordered. */
export async function sendCartOrderAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in?next=/nex-native/cart");

  const payloadRaw = String(formData.get("cart_payload") ?? "").trim();
  if (!payloadRaw) redirect("/nex-native/cart");

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadRaw);
  } catch {
    redirect("/nex-native/cart?send_error=" + encodeURIComponent("Invalid cart payload"));
  }
  if (!parsed || typeof parsed !== "object") {
    redirect("/nex-native/cart?send_error=" + encodeURIComponent("Empty cart payload"));
  }
  const p = parsed as Record<string, unknown>;
  const peerAccountId = String(p.peer_account_id ?? "").trim();
  const shopId = String(p.shop_id ?? "").trim();
  const shopSlug = String(p.shop_slug ?? "").trim() || null;
  const shopDisplayName = String(p.shop_display_name ?? "").trim();
  const currency = String(p.currency ?? "IDR").trim();
  const buyerNotesRaw = String(p.buyer_notes ?? "").trim();
  const buyerNotes =
    buyerNotesRaw.length > 0 ? buyerNotesRaw.slice(0, 2000) : null;
  const itemsRaw = Array.isArray(p.items) ? p.items : [];

  // Bridge 22c-2 · structured delivery address. Clip each field so a
  // bad client can't blow up the JSONB column · never trust client
  // length limits alone.
  const addressRaw =
    p.delivery_address && typeof p.delivery_address === "object"
      ? (p.delivery_address as Record<string, unknown>)
      : null;
  const deliveryAddress: import("@/lib/nex-native/peer-message-service").NexPeerCartOrderDeliveryAddress | null =
    addressRaw
      ? {
          recipient_name: String(addressRaw.recipient_name ?? "")
            .trim()
            .slice(0, 200),
          phone: String(addressRaw.phone ?? "").trim().slice(0, 40),
          street: String(addressRaw.street ?? "").trim().slice(0, 300),
          street_2: String(addressRaw.street_2 ?? "").trim().slice(0, 300),
          city: String(addressRaw.city ?? "").trim().slice(0, 120),
          region: String(addressRaw.region ?? "").trim().slice(0, 120),
          postal_code: String(addressRaw.postal_code ?? "").trim().slice(0, 24),
          country: String(addressRaw.country ?? "").trim().slice(0, 80),
          notes: String(addressRaw.notes ?? "").trim().slice(0, 500),
        }
      : null;
  const addressComplete = !!(
    deliveryAddress &&
    deliveryAddress.recipient_name &&
    deliveryAddress.phone &&
    deliveryAddress.street &&
    deliveryAddress.city
  );

  // Bridge 25c · bike-delivery quote from the estimator · one of
  // free/estimate/unknown. Coerce every field so a bad client can't
  // stuff junk into the snapshot.
  let deliveryQuote:
    | {
        kind: "free" | "estimate" | "unknown";
        distance_km?: number;
        fare_pence?: number;
        currency?: "IDR";
        eta_minutes?: number;
        free_reason?: string | null;
      }
    | null = null;
  if (p.delivery_quote && typeof p.delivery_quote === "object") {
    const dq = p.delivery_quote as Record<string, unknown>;
    const kindRaw = String(dq.kind ?? "unknown");
    const kind: "free" | "estimate" | "unknown" =
      kindRaw === "free" || kindRaw === "estimate" ? kindRaw : "unknown";
    deliveryQuote = { kind };
    if (kind === "estimate") {
      const d = Number(dq.distance_km);
      const f = Number(dq.fare_pence);
      const e = Number(dq.eta_minutes);
      if (Number.isFinite(d) && d >= 0) deliveryQuote.distance_km = d;
      if (Number.isFinite(f) && f >= 0) deliveryQuote.fare_pence = f;
      if (Number.isFinite(e) && e >= 0) deliveryQuote.eta_minutes = e;
      deliveryQuote.currency = "IDR";
    }
    if (kind === "free") {
      const reason = String(dq.free_reason ?? "").trim();
      deliveryQuote.free_reason = reason.length > 0 ? reason.slice(0, 200) : null;
    }
  }

  if (!peerAccountId || peerAccountId === session.account.id || !shopId) {
    redirect("/nex-native/cart?send_error=" + encodeURIComponent("Bad shop or peer"));
  }
  if (itemsRaw.length === 0) {
    redirect("/nex-native/cart?send_error=" + encodeURIComponent("Cart is empty"));
  }

  // Validate + normalise items server-side. Buyer-supplied prices are
  // trusted for now (snapshot) · a stricter world could re-fetch from
  // nex_product/nex_menu_item to prevent tampering. Doing that here
  // for products (physical goods) so prices are authoritative; menu
  // items keep the client-provided price to avoid an extra DB roundtrip
  // per line.
  const items: import("@/lib/nex-native/peer-message-service").NexPeerCartOrderItem[] = [];
  let subtotal = 0;
  let firstImage: string | null = null;
  for (const raw of itemsRaw) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const kind = String(it.kind ?? "product");
    const id = String(it.id ?? "").trim();
    const name = String(it.name ?? "").trim().slice(0, 200);
    const quantity = Math.max(
      1,
      Math.min(999, Math.floor(Number(it.quantity ?? 1))),
    );
    if (!id || !name) continue;

    let price = Math.max(0, Math.floor(Number(it.price_pence ?? 0)));
    // Refresh authoritative price for products (physical goods only).
    if (kind === "product") {
      try {
        const product = await productService.getProductById(id);
        if (product) {
          price = product.price_pence;
          // Sanity: item's shop must be the target shop.
          if (product.business_id !== shopId) continue;
        }
      } catch {
        // Silently trust the client-provided price · fail-open.
      }
    }

    const variantsRaw = Array.isArray(it.variants) ? it.variants : [];
    const variants = variantsRaw
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0)
      .slice(0, 6);
    // Bridge 23c-3 · perks flow onto the cart-line snapshot · known
    // tokens only (bogo · free_drink · free_rice · free_fries ·
    // free_delivery · other) · unknown values dropped for safety.
    const allowedPerks = new Set([
      "bogo",
      "free_drink",
      "free_rice",
      "free_fries",
      "free_delivery",
      "other",
    ]);
    const perksRaw = Array.isArray(it.perks) ? it.perks : [];
    const perks = perksRaw
      .map((v) => String(v).trim().toLowerCase())
      .filter((v) => allowedPerks.has(v))
      .slice(0, 6);
    const perksNoteRaw = String(it.perks_note ?? "").trim();
    const perksNote =
      perksNoteRaw.length > 0 ? perksNoteRaw.slice(0, 200) : null;
    const noteRaw = String(it.note ?? "").trim();
    const note = noteRaw.length > 0 ? noteRaw.slice(0, 400) : null;
    const imageUrl =
      typeof it.image_url === "string" && it.image_url.length > 0
        ? it.image_url
        : null;
    if (!firstImage && imageUrl) firstImage = imageUrl;

    items.push({
      kind: kind === "menu_item" ? "menu_item" : "product",
      id,
      name,
      price_pence: price,
      currency,
      quantity,
      variants,
      perks,
      perks_note: perksNote,
      note,
      image_url: imageUrl,
    });
    subtotal += price * quantity;
  }
  if (items.length === 0) {
    redirect("/nex-native/cart?send_error=" + encodeURIComponent("No valid items"));
  }

  const snapshot: import("@/lib/nex-native/peer-message-service").NexPeerCartOrderSnapshot = {
    shop_id: shopId,
    shop_slug: shopSlug,
    shop_display_name: shopDisplayName || "shop",
    items,
    buyer_notes: buyerNotes,
    subtotal_pence: subtotal,
    currency,
    item_count: items.reduce((n, it) => n + it.quantity, 0),
    delivery_address: addressComplete ? deliveryAddress : null,
    delivery_quote: deliveryQuote,
  };

  // Body renders in plain-text clients that don't know cart_order.
  const bodyLines: string[] = [
    `🛒 New order · ${shopDisplayName}`,
    ...items.map((it) => {
      const perkLabels: Record<string, string> = {
        bogo: "🎁 BOGO",
        free_drink: "🥤 Free drink",
        free_rice: "🍚 Free rice",
        free_fries: "🍟 Free fries",
        free_delivery: "🚚 Free delivery",
        other: "✨ Perk",
      };
      const perkText = (it.perks ?? [])
        .map((p) =>
          p === "other" && it.perks_note ? `✨ ${it.perks_note}` : perkLabels[p] ?? p,
        )
        .join(" · ");
      return `· ${it.quantity}× ${it.name}${
        it.variants.length > 0 ? ` (${it.variants.join(" · ")})` : ""
      }${perkText ? ` [${perkText}]` : ""}${it.note ? ` — ${it.note}` : ""}`;
    }),
  ];
  if (buyerNotes) {
    bodyLines.push("");
    bodyLines.push(`Note from buyer: ${buyerNotes}`);
  }
  if (addressComplete && deliveryAddress) {
    bodyLines.push("");
    bodyLines.push("📦 Deliver to:");
    bodyLines.push(deliveryAddress.recipient_name);
    if (deliveryAddress.phone) bodyLines.push(`☎ ${deliveryAddress.phone}`);
    bodyLines.push(deliveryAddress.street);
    if (deliveryAddress.street_2) bodyLines.push(deliveryAddress.street_2);
    const cityLine = [
      deliveryAddress.city,
      deliveryAddress.region,
      deliveryAddress.postal_code,
    ]
      .filter(Boolean)
      .join(", ");
    if (cityLine) bodyLines.push(cityLine);
    if (deliveryAddress.country) bodyLines.push(deliveryAddress.country);
    if (deliveryAddress.notes) {
      bodyLines.push(`Delivery note: ${deliveryAddress.notes}`);
    }
  }
  if (deliveryQuote) {
    bodyLines.push("");
    if (deliveryQuote.kind === "free") {
      bodyLines.push(
        `🚚 Delivery · FREE${
          deliveryQuote.free_reason ? ` (${deliveryQuote.free_reason})` : ""
        }`,
      );
    } else if (
      deliveryQuote.kind === "estimate" &&
      typeof deliveryQuote.fare_pence === "number"
    ) {
      bodyLines.push(
        `🚚 Bike-delivery estimate · ${formatCartPrice(
          deliveryQuote.fare_pence,
          "IDR",
        )}${
          typeof deliveryQuote.distance_km === "number"
            ? ` · ${deliveryQuote.distance_km.toFixed(1)} km`
            : ""
        }${
          typeof deliveryQuote.eta_minutes === "number"
            ? ` · ~${deliveryQuote.eta_minutes} min`
            : ""
        }`,
      );
    } else {
      bodyLines.push("🚚 Delivery · confirm in chat");
    }
  }
  bodyLines.push("");
  bodyLines.push(
    `Subtotal · ${formatCartPrice(subtotal, currency)} · ${snapshot.item_count} item${
      snapshot.item_count === 1 ? "" : "s"
    }`,
  );
  const body = bodyLines.join("\n");

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peerAccountId,
    );

  await peerMessageService.sendPeerMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body,
    attachment_url: firstImage,
    attachment_type: firstImage ? "cart_order" : null,
    attachment_meta: firstImage ? { cart: snapshot } : { cart: snapshot },
  });
  // Note · attachment_url + attachment_type must be set together per
  // the DB CHECK · when no image, we fall back to text-only body.
  // The snapshot still lives on attachment_meta so if a client wants
  // to hydrate it via a separate mechanism it can.

  // Bridge 22c-3 · after a successful send, drop this shop's lines
  // from the server-side cart so the buyer's other devices don't
  // resurrect them. Delivery address stays saved for reuse.
  try {
    const existing = await cartService.getServerCart(session.account.id);
    const remaining = existing.items.filter((x) => x.shop_id !== shopId);
    await cartService.saveServerCart(
      session.account.id,
      remaining,
      existing.delivery_address,
    );
  } catch {
    // Non-blocking · the client's optimistic clear covers this device.
  }

  revalidatePath(`/nex-native/chat/peer/${peerAccountId}`);
  redirect(`/nex-native/chat/peer/${peerAccountId}?cart_sent=1`);
}

/** Bridge 22c-3 · Sync the signed-in buyer's cart to the server so
 *  it follows them across devices. Client calls this debounced on
 *  every localStorage write · payload is the entire cart + address
 *  snapshot. Signed-out buyers get a redirect to /sign-in (which the
 *  client short-circuits by only calling this when signed-in). */
export async function saveServerCartAction(
  formData: FormData,
): Promise<{ ok: true; updated_at: string } | { ok: false; error: string }> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };

  const itemsRaw = String(formData.get("items") ?? "").trim();
  const addressRaw = String(formData.get("delivery_address") ?? "").trim();

  let items: NexCartItem[] = [];
  let address: NexDeliveryAddress = NEX_DELIVERY_ADDRESS_EMPTY;
  try {
    if (itemsRaw) {
      const parsed = JSON.parse(itemsRaw);
      if (Array.isArray(parsed)) items = parsed;
    }
    if (addressRaw) {
      const parsed = JSON.parse(addressRaw);
      if (parsed && typeof parsed === "object") {
        address = { ...NEX_DELIVERY_ADDRESS_EMPTY, ...parsed };
      }
    }
  } catch {
    return { ok: false, error: "invalid_payload" };
  }

  try {
    const saved = await cartService.saveServerCart(
      session.account.id,
      items,
      address,
    );
    return { ok: true, updated_at: saved.updated_at };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "save_failed",
    };
  }
}

/** Bridge 22c-3 · Wipe the buyer's server-side cart. Called after a
 *  successful cart send so remaining devices don't show phantom
 *  items · client mirrors by clearing localStorage on receipt of
 *  ok:true. */
export async function clearServerCartAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return { ok: false, error: "not_signed_in" };
  try {
    await cartService.clearServerCart(session.account.id);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "clear_failed",
    };
  }
}

function formatCartPrice(pence: number, currency: string): string {
  const majors = Math.round(pence / 100);
  const withCommas = majors.toLocaleString();
  if (currency === "IDR") return `Rp ${withCommas}`;
  if (currency === "GBP") return `£${(pence / 100).toFixed(2)}`;
  if (currency === "USD") return `$${(pence / 100).toFixed(2)}`;
  return `${currency} ${withCommas}`;
}

/** Bridge 21 · update the seller's return policy. Owner-only.
 *  Server-side enforces Indonesian legal minimums · seller can't
 *  weaken below UU No 8/1999. */
export async function updateReturnPolicyAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage/shop?e=returns_forbidden&m=" +
        encodeURIComponent("You don't own this shop"),
    );
  }

  const asStr = (k: string) => String(formData.get(k) ?? "").trim();
  const asBool = (k: string) => asStr(k) === "on" || asStr(k) === "true";
  const asNum = (k: string) => {
    const n = Number.parseInt(asStr(k), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const reasons = formData.getAll("accepts_reasons").map((v) => String(v));
  const nonReturnable = String(formData.get("non_returnable") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  try {
    await businessService.updateReturnPolicy(businessId, {
      accepts_returns: asBool("accepts_returns"),
      window_days: asNum("window_days"),
      refund_days: asNum("refund_days"),
      accepts_reasons:
        reasons as import("@/lib/nex-native/types").NexReturnReason[],
      shipping_paid_by: (asStr("shipping_paid_by") ||
        "buyer_unless_defective") as import("@/lib/nex-native/types").NexReturnShippingPaidBy,
      restocking_fee_percent: asNum("restocking_fee_percent"),
      non_returnable: nonReturnable,
      notes: asStr("notes") || null,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/manage/shop?e=returns_failed&m=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/manage/shop");
  revalidatePath(`/nex-native/${business.slug}/returns`);
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    "/nex-native/manage/shop?e=returns_ok&m=" +
      encodeURIComponent("Return policy saved · legal minimums enforced"),
  );
}

/** Bridge 20b · create a typed product variant. Owner-only. Reads
 *  attribute (size/colour/etc.), name (S/M/L/Red/etc.), optional
 *  price override (IDR), optional per-variant stock status. */
export async function createProductVariantAction(
  productId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      "/nex-native/manage?e=variant_failed&m=" +
        encodeURIComponent("Product not found"),
    );
  }
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage?e=variant_forbidden&m=" +
        encodeURIComponent("You don't own this product"),
    );
  }

  const attribute = String(formData.get("attribute") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const priceIdrRaw = String(formData.get("price_idr") ?? "").trim();
  const stockRaw = String(formData.get("stock_status") ?? "").trim() || null;

  if (!name || !attribute) {
    redirect(
      `/nex-native/manage/products/${productId}?e=variant_failed&m=` +
        encodeURIComponent("Attribute + name are required"),
    );
  }

  let pricePence: number | null = null;
  if (priceIdrRaw) {
    const n = Number.parseInt(priceIdrRaw, 10);
    if (Number.isFinite(n) && n >= 0) {
      pricePence = n * 100; // IDR → pence storage convention
    }
  }

  type Attr = import("@/lib/nex-native/types").NexVariantAttribute;
  type Stock = import("@/lib/nex-native/types").NexProductStockStatus | null;
  try {
    await productService.createVariant({
      product_id: productId,
      name,
      attribute: attribute as Attr,
      price_pence: pricePence,
      stock_status: stockRaw as Stock,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      `/nex-native/manage/products/${productId}?e=variant_failed&m=` +
        encodeURIComponent(msg),
    );
  }

  revalidatePath(`/nex-native/manage/products/${productId}`);
  revalidatePath(`/nex-native/${business.slug}/${productId}`);
  redirect(
    `/nex-native/manage/products/${productId}?e=variant_ok&m=` +
      encodeURIComponent(`${name} added`),
  );
}

/** Bridge 20b · delete a variant. Owner-only. */
export async function deleteProductVariantAction(
  variantId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) redirect("/nex-native/manage");

  const product = await productService.getProductById(productId);
  if (!product) redirect("/nex-native/manage");
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      `/nex-native/manage/products/${productId}?e=variant_forbidden&m=` +
        encodeURIComponent("You don't own this product"),
    );
  }

  try {
    await productService.deleteVariant(variantId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      `/nex-native/manage/products/${productId}?e=variant_failed&m=` +
        encodeURIComponent(msg),
    );
  }

  revalidatePath(`/nex-native/manage/products/${productId}`);
  revalidatePath(`/nex-native/${business.slug}/${productId}`);
  redirect(
    `/nex-native/manage/products/${productId}?e=variant_ok&m=` +
      encodeURIComponent("Variant deleted"),
  );
}

/** Bridge 20 · update the Specifications JSONB on a product. Owner-
 *  only. Reads a curated set of fields from FormData, coerces to
 *  the NexProductSpec shape, and calls the service. Empty strings
 *  and empty arrays are dropped by the service normaliser so the
 *  JSONB stays lean. */
export async function updateProductSpecAction(
  productId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      "/nex-native/manage?e=product_not_found&m=" +
        encodeURIComponent("Product not found"),
    );
  }
  const business = await businessService.getBusinessById(product.business_id);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect(
      "/nex-native/manage?e=spec_forbidden&m=" +
        encodeURIComponent("You don't own this product"),
    );
  }

  const asStr = (key: string) => String(formData.get(key) ?? "").trim();
  const asList = (key: string) =>
    asStr(key)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  const asNum = (key: string): number | undefined => {
    const raw = asStr(key);
    if (!raw) return undefined;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  const spec: import("@/lib/nex-native/types").NexProductSpec = {
    condition: (asStr("condition") ||
      undefined) as import("@/lib/nex-native/types").NexProductSpec["condition"],
    origin: asStr("origin") || undefined,
    brand: asStr("brand") || undefined,
    model: asStr("model") || undefined,
    authenticity: (asStr("authenticity") ||
      undefined) as import("@/lib/nex-native/types").NexProductSpec["authenticity"],
    materials: asList("materials"),
    dimensions: {
      w: asNum("dim_w"),
      h: asNum("dim_h"),
      d: asNum("dim_d"),
      unit: (asStr("dim_unit") ||
        "mm") as NonNullable<
        import("@/lib/nex-native/types").NexProductSpec["dimensions"]
      >["unit"],
    },
    weight: {
      value: asNum("weight_value"),
      unit: (asStr("weight_unit") ||
        "g") as NonNullable<
        import("@/lib/nex-native/types").NexProductSpec["weight"]
      >["unit"],
    },
    included: asList("included"),
    warranty: asStr("warranty") || undefined,
    certifications: asList("certifications"),
    age_rating: asStr("age_rating") || undefined,
    year_produced: asNum("year_produced"),
    care_instructions: asStr("care_instructions") || undefined,
    duration: asStr("duration") || undefined,
    service_location: (asStr("service_location") ||
      undefined) as import("@/lib/nex-native/types").NexProductSpec["service_location"],
    advance_booking: asStr("advance_booking") || undefined,
    age_range: asStr("age_range") || undefined,
    hs_code: asStr("hs_code") || undefined,
    export_markets: asList("export_markets"),
    factory_location: asStr("factory_location") || undefined,
    production_capacity: asStr("production_capacity") || undefined,
    lead_time: asStr("lead_time") || undefined,
  };

  try {
    await productService.updateProductSpec(productId, spec);
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      `/nex-native/manage/products/${productId}?e=spec_failed&m=` +
        encodeURIComponent(msg),
    );
  }

  revalidatePath(`/nex-native/manage/products/${productId}`);
  revalidatePath(`/nex-native/${business.slug}/${productId}`);
  revalidatePath(`/nex-native/${business.slug}`);
  redirect(
    `/nex-native/manage/products/${productId}?e=spec_ok&m=` +
      encodeURIComponent("Specifications saved"),
  );
}

/** Bridge 18 · toggle a like on a product. The hidden `intent`
 *  field tells us whether to add or remove · caller can also just
 *  omit it and the action flips whatever the current state is. */
export async function toggleLikeProductAction(
  productId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (!productId) redirect("/nex-native/liked");

  const backHref =
    String(formData.get("back") ?? "").trim() || "/nex-native/liked";
  const safeBack = backHref.startsWith("/nex-native/")
    ? backHref
    : "/nex-native/liked";
  const intent = String(formData.get("intent") ?? "").trim();

  try {
    if (intent === "unlike") {
      await likedProductService.unlikeProduct(session.account.id, productId);
    } else if (intent === "like") {
      await likedProductService.likeProduct(session.account.id, productId);
    } else {
      // No explicit intent · flip the state.
      const liked = await likedProductService.isLikedByViewer(
        session.account.id,
        productId,
      );
      if (liked) {
        await likedProductService.unlikeProduct(session.account.id, productId);
      } else {
        await likedProductService.likeProduct(session.account.id, productId);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      safeBack +
        (safeBack.includes("?") ? "&" : "?") +
        "like_error=" +
        encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/liked");
  revalidatePath(safeBack);
  redirect(safeBack);
}

/** Bridge 18 · bulk-delete liked rows by id · consumes the checked
 *  boxes on /nex-native/liked. */
export async function bulkDeleteLikedProductsAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const ids = formData
    .getAll("liked_id")
    .map((v) => String(v).trim())
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));

  if (ids.length === 0) {
    redirect(
      "/nex-native/liked?bulk_error=" +
        encodeURIComponent("Pick at least one item"),
    );
  }

  try {
    await likedProductService.deleteLikedRowsByIds(session.account.id, ids);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirect(
      "/nex-native/liked?bulk_error=" + encodeURIComponent(msg),
    );
  }

  revalidatePath("/nex-native/liked");
  redirect(
    "/nex-native/liked?bulk_ok=" +
      encodeURIComponent(`${ids.length} removed`),
  );
}

/** Bridge 17 · share a product from ANY seller's shop to a NEX
 *  contact. Different from sendProductInquiryAction (Bridge 11)
 *  which locks the product to the peer's own shop. This one is
 *  cross-shop by design · Philip can browse Aisha's cameras and
 *  drop one into Priya's chat with a "just seen and it looks
 *  keen?" note.
 *
 *  Requires: viewer is signed in · peer != viewer · product exists.
 *  Snapshot carries the ORIGINATING shop's slug + name so the
 *  product card links back to the source shop, not to the peer's
 *  shop (peer may not have a shop at all). */
export async function shareProductToContactAction(
  peerAccountId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (peerAccountId === session.account.id) redirect("/nex-native/chat");

  const productId = String(formData.get("product_id") ?? "").trim();
  const customBody = String(formData.get("body") ?? "").trim();
  const shareBackHref = String(formData.get("back") ?? "").trim();
  const safeBack =
    shareBackHref.startsWith("/nex-native/") && !shareBackHref.includes("?e=")
      ? shareBackHref
      : "/nex-native/chat";

  if (!productId) {
    redirect(
      safeBack +
        (safeBack.includes("?") ? "&" : "?") +
        "share_error=missing_product",
    );
  }

  const product = await productService.getProductById(productId);
  if (!product) {
    redirect(
      safeBack +
        (safeBack.includes("?") ? "&" : "?") +
        "share_error=not_found",
    );
  }

  // Resolve the originating shop from the product's business_id.
  const originShop = await businessService.getBusinessById(
    product.business_id,
  );
  if (!originShop) {
    redirect(
      safeBack +
        (safeBack.includes("?") ? "&" : "?") +
        "share_error=shop_not_found",
    );
  }

  const snapshot: peerMessageService.NexPeerProductSnapshot = {
    product_id: product.id,
    business_id: originShop.id,
    business_slug: originShop.slug ?? null,
    name: product.name,
    price_pence: product.price_pence,
    currency: product.currency,
    image_url: product.image_url ?? null,
    short_description:
      product.description?.split(/[.··]/)[0]?.trim().slice(0, 140) ?? null,
  };

  const defaultBody = `Just seen and it looks keen 👀 · from ${originShop.display_name}`;
  const body = customBody || defaultBody;

  const conversation =
    await peerConversationService.getOrCreatePeerConversation(
      session.account.id,
      peerAccountId,
    );

  const hasImage = !!product.image_url;
  await peerMessageService.sendPeerMessage({
    conversation_id: conversation.id,
    sender_account_id: session.account.id,
    body,
    attachment_url: hasImage ? product.image_url : null,
    attachment_type: hasImage ? "product" : null,
    attachment_meta: hasImage ? { product: snapshot } : null,
  });

  revalidatePath(`/nex-native/chat/peer/${peerAccountId}`);
  redirect(`/nex-native/chat/peer/${peerAccountId}`);
}

export async function deletePeerMessageAction(
  peerAccountId: string,
  formData: FormData,
): Promise<never> {
  const messageId = String(formData.get("message_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (!messageId) redirect(`/nex-native/chat/peer/${peerAccountId}`);

  try {
    await peerMessageService.deletePeerMessageForEveryone(
      messageId,
      session.account.id,
    );
  } catch (e) {
    // Failure surfaces in the URL as a small banner. Keeps the send
    // path simple · no throw across the server boundary.
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ delete_error: msg });
    redirect(`/nex-native/chat/peer/${peerAccountId}?${qs.toString()}`);
  }

  revalidatePath(`/nex-native/chat/peer/${peerAccountId}`);
  redirect(`/nex-native/chat/peer/${peerAccountId}`);
}

// ---------------------------------------------------------------------------
// Onboarding · create business + first product
// ---------------------------------------------------------------------------

export async function createBusinessAction(formData: FormData): Promise<never> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const productName = String(formData.get("product_name") ?? "").trim();
  const priceRaw = String(formData.get("product_price_gbp") ?? "").trim();
  // Bridge 16e · optional profile fields collected during shop create.
  const cityInput = String(formData.get("city") ?? "").trim();
  const hoursDisplayInput = String(formData.get("hours_display") ?? "").trim();
  // Bridge 16f · category dropdown from onboarding.
  const categoryInput = String(formData.get("business_category") ?? "").trim();

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to create a business");
  }

  if (!displayName) {
    redirectToOnboardingWithError("missing_display_name", "business name required");
  }
  if (displayName.length > 200) {
    redirectToOnboardingWithError("long_display_name", "business name too long");
  }
  if (!slug) {
    redirectToOnboardingWithError("missing_slug", "slug required");
  }
  if (!NEX_SLUG_REGEX.test(slug)) {
    redirectToOnboardingWithError(
      "invalid_slug",
      "slug must be lowercase letters, digits, or hyphens · 1-64 chars · no leading/trailing hyphen"
    );
  }
  if (!productName) {
    redirectToOnboardingWithError("missing_product_name", "product name required");
  }
  if (productName.length > 200) {
    redirectToOnboardingWithError("long_product_name", "product name too long");
  }
  if (!priceRaw) {
    redirectToOnboardingWithError("missing_price", "product price required");
  }
  const priceGbp = Number(priceRaw);
  if (!Number.isFinite(priceGbp) || Number.isNaN(priceGbp)) {
    redirectToOnboardingWithError("invalid_price", "price must be a number in GBP e.g. 24.50");
  }
  if (priceGbp <= 0) {
    redirectToOnboardingWithError("non_positive_price", "price must be greater than zero");
  }
  const pricePence = Math.round(priceGbp * 100);
  if (!Number.isFinite(pricePence) || pricePence <= 0) {
    redirectToOnboardingWithError("invalid_price", "price could not be converted to pence");
  }
  if (Math.abs(priceGbp * 100 - pricePence) > 0.5) {
    redirectToOnboardingWithError(
      "sub_penny_price",
      "price must be to the penny · e.g. 24.50 not 24.5678"
    );
  }

  const existing = await businessService.listBusinessesByOwner(session.account.id);
  if (existing.length > 0) {
    redirectToOnboardingWithError(
      "already_has_business",
      `you already own ${existing[0].slug} · one business per account in the pilot`
    );
  }

  let business;
  try {
    business = await businessService.createBusiness({
      owner_account_id: session.account.id,
      display_name: displayName,
      slug,
    });
    // Bridge 16e · stash the two optional profile fields right after
    // create · silent if either is blank · non-blocking failure.
    if (cityInput.length > 0 || hoursDisplayInput.length > 0) {
      try {
        await businessService.updateBusinessCityAndHours(business.id, {
          city: cityInput.length > 0 ? cityInput : null,
          hoursDisplay:
            hoursDisplayInput.length > 0 ? hoursDisplayInput : null,
        });
      } catch (persistErr) {
        // eslint-disable-next-line no-console
        console.warn(
          "createBusinessAction · city/hours soft-fail:",
          persistErr,
        );
      }
    }
    // Bridge 16f · category from onboarding dropdown · non-blocking.
    if (categoryInput.length > 0) {
      try {
        await businessService.updateBusinessCategoryAndKeywords(
          business.id,
          { category: categoryInput },
        );
      } catch (catErr) {
        // eslint-disable-next-line no-console
        console.warn(
          "createBusinessAction · category soft-fail:",
          catErr,
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const looksLikeSlugCollision =
      /duplicate key/i.test(msg) || /already exists/i.test(msg) || /unique/i.test(msg);
    redirectToOnboardingWithError(
      looksLikeSlugCollision ? "slug_taken" : "business_create_failed",
      looksLikeSlugCollision ? "that slug is already taken · choose another" : msg
    );
  }

  try {
    await productService.createProduct({
      business_id: business.id,
      name: productName,
      price_pence: pricePence,
      currency: "GBP",
      status: "live",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "product_create_failed", m: msg });
    revalidatePath(`/nex-native/${business.slug}`);
    redirect(`/nex-native/${business.slug}?${qs.toString()}`);
  }

  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath("/nex-native/conversations");
  redirect(`/nex-native/${business.slug}`);
}

// ---------------------------------------------------------------------------
// Business profile edit (Slice 3 + Slice 4b offline payment)
// ---------------------------------------------------------------------------

export async function updateBusinessProfileAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit your business");
  }

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) {
    redirectToOnboardingWithError(
      "no_business",
      "create a business before editing profile fields"
    );
  }

  const patch: Record<string, string | boolean | null> = {};
  const textFields = [
    "description",
    "logo_url",
    "address",
    "public_phone",
    "public_email",
    "website_url",
    "payment_instructions",
    "status_message",
    "status_message_expires_at",
    "instagram_handle",
    "facebook_handle",
    "tiktok_handle",
    "linkedin_handle",
    "x_handle",
  ] as const;
  for (const f of textFields) {
    if (!formData.has(f)) continue;
    patch[f] = String(formData.get(f) ?? "");
  }
  const boolFields = ["accepts_cod", "accepts_pickup"] as const;
  for (const f of boolFields) {
    if (!formData.has(`${f}_sentinel`)) continue;
    patch[f] = formData.get(f) === "on";
  }

  try {
    await businessService.updateBusinessProfile(business.id, patch);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("business_profile_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("business_profile_updated", business.display_name);
}

export async function updateBusinessHoursAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to edit hours");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business first");

  const clear = String(formData.get("clear_hours") ?? "") === "on";
  if (clear) {
    try { await businessService.updateBusinessHours(business.id, null); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      redirectToManageWithBanner("hours_update_failed", msg);
    }
    revalidatePath("/nex-native/manage");
    revalidatePath(`/nex-native/${business.slug}`);
    redirectToManageWithBanner("hours_cleared", business.display_name);
  }

  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const hours: Record<string, { open: string; close: string } | null> = {};
  for (const d of days) {
    const closed = String(formData.get(`${d}_closed`) ?? "") === "on";
    if (closed) {
      hours[d] = null;
      continue;
    }
    const open = String(formData.get(`${d}_open`) ?? "").trim();
    const close = String(formData.get(`${d}_close`) ?? "").trim();
    if (!open || !close) {
      redirectToManageWithBanner("hours_incomplete", `${d}: fill both open and close, or mark closed`);
    }
    hours[d] = { open, close };
  }

  try {
    await businessService.updateBusinessHours(business.id, hours as never);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("hours_update_failed", msg);
  }
  revalidatePath("/nex-native/manage");
  revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("hours_updated", business.display_name);
}

// ---------------------------------------------------------------------------
// Merchant product management
// ---------------------------------------------------------------------------

function parseGbpPriceOrRedirect(priceRaw: string): number {
  if (!priceRaw) {
    redirectToManageWithBanner("missing_price", "product price required");
  }
  const priceGbp = Number(priceRaw);
  if (!Number.isFinite(priceGbp) || Number.isNaN(priceGbp)) {
    redirectToManageWithBanner("invalid_price", "price must be a number in GBP e.g. 24.50");
  }
  if (priceGbp <= 0) {
    redirectToManageWithBanner("non_positive_price", "price must be greater than zero");
  }
  const pricePence = Math.round(priceGbp * 100);
  if (!Number.isFinite(pricePence) || pricePence <= 0) {
    redirectToManageWithBanner("invalid_price", "price could not be converted to pence");
  }
  if (Math.abs(priceGbp * 100 - pricePence) > 0.5) {
    redirectToManageWithBanner(
      "sub_penny_price",
      "price must be to the penny · e.g. 24.50 not 24.5678"
    );
  }
  return pricePence;
}

export async function createManagedProductAction(formData: FormData): Promise<never> {
  const productName = String(formData.get("product_name") ?? "").trim();
  const priceRaw = String(formData.get("product_price_gbp") ?? "").trim();
  const descriptionRaw = String(formData.get("product_description") ?? "");
  const imageUrlRaw = String(formData.get("product_image_url") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to add a product");
  }

  if (!productName) {
    redirectToManageWithBanner("missing_product_name", "product name required");
  }
  if (productName.length > 200) {
    redirectToManageWithBanner("long_product_name", "product name too long");
  }

  const description = descriptionRaw.trim().length === 0 ? null : descriptionRaw.trim();
  if (description !== null && description.length > 2000) {
    redirectToManageWithBanner(
      "long_description",
      "description too long · max 2000 characters"
    );
  }

  const imageUrl = imageUrlRaw.trim().length === 0 ? null : imageUrlRaw.trim();
  if (imageUrl !== null) {
    if (imageUrl.length > 1024) {
      redirectToManageWithBanner("long_image_url", "image URL too long");
    }
    if (!/^https?:\/\//i.test(imageUrl)) {
      redirectToManageWithBanner(
        "invalid_image_url",
        "image URL must start with http:// or https://"
      );
    }
  }

  const pricePence = parseGbpPriceOrRedirect(priceRaw);

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) {
    redirectToOnboardingWithError(
      "no_business",
      "create a business before adding products"
    );
  }

  try {
    await productService.createProduct({
      business_id: business.id,
      name: productName,
      description,
      image_url: imageUrl,
      price_pence: pricePence,
      currency: "GBP",
      status: "live",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("product_create_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("created", productName);
}

export async function updateProductPriceAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const priceRaw = String(formData.get("product_price_gbp") ?? "").trim();

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }

  const pricePence = parseGbpPriceOrRedirect(priceRaw);

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner(
      "not_owner",
      "you do not own the business this product belongs to"
    );
  }

  try {
    await productService.updateProductPrice(productId, pricePence);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("price_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("price_updated", product.name);
}

export async function updateProductDescriptionAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const descriptionRaw = String(formData.get("product_description") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }

  const description = descriptionRaw.trim().length === 0 ? null : descriptionRaw.trim();
  if (description !== null && description.length > 2000) {
    redirectToManageWithBanner(
      "long_description",
      "description too long · max 2000 characters"
    );
  }

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner(
      "not_owner",
      "you do not own the business this product belongs to"
    );
  }

  try {
    await productService.updateProductDescription(productId, description);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("description_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("description_updated", product.name);
}

export async function updateProductImageUrlAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const imageUrlRaw = String(formData.get("image_url") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }

  const imageUrl = imageUrlRaw.trim().length === 0 ? null : imageUrlRaw.trim();

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner(
      "not_owner",
      "you do not own the business this product belongs to"
    );
  }

  try {
    await productService.updateProductImageUrl(productId, imageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("image_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("image_updated", product.name);
}

export async function updateProductGalleryAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const galleryRaw = String(formData.get("gallery_urls") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }

  const urls = galleryRaw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const normalisedUrls: string[] | null = urls.length === 0 ? null : urls;

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner(
      "not_owner",
      "you do not own the business this product belongs to"
    );
  }

  try {
    await productService.updateProductGalleryUrls(productId, normalisedUrls);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("gallery_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("gallery_updated", product.name);
}

export async function updateProductTagsAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const tagsRaw = String(formData.get("tags") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }

  const tags = tagsRaw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const normalised: string[] | null = tags.length === 0 ? null : tags;

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner(
      "not_owner",
      "you do not own the business this product belongs to"
    );
  }

  try {
    await productService.updateProductTags(productId, normalised);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("tags_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("tags_updated", product.name);
}

/** Legacy Slice-6 stock-status action · takes product_id from the
 *  FormData rather than the bound-id signature. Renamed 2026-09-28
 *  to unblock a duplicate-export error introduced by Bridge 13's
 *  bound-id equivalent. Kept live because /manage/page.tsx still
 *  uses this form shape. */
export async function updateProductStockStatusFromManageAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const raw = String(formData.get("stock_status") ?? "").trim();
  const clearing = raw === "" || raw === "none";
  const stockStatus = clearing ? null : (raw as NexProductStockStatus);

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }
  if (stockStatus !== null && !NEX_PRODUCT_STOCK_STATUSES.includes(stockStatus)) {
    redirectToManageWithBanner("invalid_stock_status", `unknown stock status '${raw}'`);
  }

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner("not_owner", "you do not own this product's business");
  }

  try {
    await productService.updateProductStockStatus(productId, stockStatus);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("stock_status_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("stock_status_updated", product.name);
}

// Slice 6c · Product variants
async function resolveOwnerAndProduct(productId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to manage variants");
  if (!productId) redirectToManageWithBanner("missing_product_id", "product id required");
  const product = await productService.getProductById(productId);
  if (!product) redirectToManageWithBanner("product_not_found", "product not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner("not_owner", "you do not own this product's business");
  }
  return { session, product };
}

export async function createVariantAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const name = String(formData.get("name") ?? "");
  const priceMajorRaw = String(formData.get("price_major") ?? "").trim();
  const positionRaw = String(formData.get("position") ?? "").trim();
  const { product } = await resolveOwnerAndProduct(productId);
  let pricePence: number | null = null;
  if (priceMajorRaw) {
    const parsed = Math.round(Number(priceMajorRaw) * 100);
    if (!Number.isFinite(parsed) || parsed < 0) {
      redirectToManageWithBanner("invalid_variant_price", "price must be a non-negative number");
    }
    pricePence = parsed;
  }
  const position = positionRaw ? Number(positionRaw) : 0;
  try {
    await productService.createVariant({
      product_id: product.id, name, price_pence: pricePence, position,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("variant_create_failed", msg);
  }
  revalidatePath("/nex-native/manage");
  redirectToManageWithBanner("variant_created", name.slice(0, 40));
}

export async function deleteVariantAction(formData: FormData): Promise<never> {
  const variantId = String(formData.get("variant_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to manage variants");
  if (!variantId) redirectToManageWithBanner("missing_variant_id", "variant id required");
  const variant = await productService.getVariantById(variantId);
  if (!variant) redirectToManageWithBanner("variant_not_found", "variant not found");
  const product = await productService.getProductById(variant.product_id);
  if (!product) redirectToManageWithBanner("product_not_found", "parent product not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner("not_owner", "you do not own this product's business");
  }
  try {
    await productService.deleteVariant(variantId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("variant_delete_failed", msg);
  }
  revalidatePath("/nex-native/manage");
  redirectToManageWithBanner("variant_deleted", variant.name.slice(0, 40));
}

export async function updateProductSkuAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const rawSku = String(formData.get("sku") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to edit products");
  if (!productId) redirectToManageWithBanner("missing_product_id", "product id required");

  const product = await productService.getProductById(productId);
  if (!product) redirectToManageWithBanner("product_not_found", "product not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner("not_owner", "you do not own this product's business");
  }

  try {
    await productService.updateProductSku(productId, rawSku);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Duplicate-key from partial unique index appears as `23505` or "duplicate key" — surface plainly.
    if (/duplicate key|23505|unique/i.test(msg)) {
      redirectToManageWithBanner("sku_duplicate", "another product in your business already has that SKU");
    }
    redirectToManageWithBanner("sku_update_failed", msg);
  }
  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner("sku_updated", product.name);
}

export async function changeProductStatusAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit products");
  }
  if (!productId) {
    redirectToManageWithBanner("missing_product_id", "product id required");
  }
  if (statusRaw !== "live" && statusRaw !== "archived") {
    redirectToManageWithBanner(
      "invalid_status",
      "status must be 'live' or 'archived'"
    );
  }

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToManageWithBanner("product_not_found", "product not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(product.business_id)) {
    redirectToManageWithBanner(
      "not_owner",
      "you do not own the business this product belongs to"
    );
  }

  try {
    await productService.updateProductStatus(
      productId,
      statusRaw as "live" | "archived"
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageWithBanner("status_update_failed", msg);
  }

  revalidatePath("/nex-native/manage");
  const business = owned.find((b) => b.id === product.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageWithBanner(
    statusRaw === "live" ? "made_live" : "archived",
    product.name
  );
}

// ---------------------------------------------------------------------------
// Merchant order fulfilment · state transitions + ledger side-effects (Slice 4a)
// ---------------------------------------------------------------------------

async function resolveOwnerAndOrder(orderId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to manage orders");
  }
  if (!orderId) {
    redirectToManageOrdersWithBanner("missing_order_id", "order id required");
  }
  const order = await orderService.getOrderById(orderId);
  if (!order) {
    redirectToManageOrdersWithBanner("order_not_found", "order not found");
  }
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(order.business_id)) {
    redirectToManageOrdersWithBanner("not_owner", "you do not own this order's business");
  }
  return { session, order };
}

/**
 * Merchant updates their internal note on an order. Editable at any state.
 * Owner check via resolveOwnerAndOrder · storage untouched on rejection.
 */
export async function updateMerchantNoteAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const merchantNoteRaw = String(formData.get("merchant_note") ?? "");
  const { order } = await resolveOwnerAndOrder(orderId);

  const merchantNote = merchantNoteRaw.trim().length === 0 ? null : merchantNoteRaw.trim();
  if (merchantNote !== null && merchantNote.length > 500) {
    redirectToManageOrdersWithBanner(
      "long_merchant_note",
      "note too long · max 500 characters"
    );
  }

  try {
    await orderService.updateMerchantNote(order.id, merchantNote);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageOrdersWithBanner("merchant_note_update_failed", msg);
  }
  revalidatePath("/nex-native/manage/orders");
  redirectToManageOrdersWithBanner("merchant_note_updated", order.id.slice(0, 8));
}

// Slice 4g · Order dispatch/tracking URL
export async function updateOrderTrackingAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const urlRaw = String(formData.get("dispatch_tracking_url") ?? "");
  const { order } = await resolveOwnerAndOrder(orderId);
  try {
    await orderService.updateOrderTracking(order.id, urlRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageOrdersWithBanner("tracking_update_failed", msg);
  }
  revalidatePath("/nex-native/manage/orders");
  revalidatePath(`/nex-native/orders/${order.id}`);
  redirectToManageOrdersWithBanner("tracking_updated", order.id.slice(0, 8));
}

export async function markOrderPaidAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const { session, order } = await resolveOwnerAndOrder(orderId);
  try {
    await commerceService.markOrderPaid(order.id, session.account.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageOrdersWithBanner("mark_paid_failed", msg);
  }
  revalidatePath("/nex-native/manage/orders");
  redirectToManageOrdersWithBanner("marked_paid", order.id.slice(0, 8));
}

export async function markOrderCompletedAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const { session, order } = await resolveOwnerAndOrder(orderId);
  try {
    await commerceService.markOrderCompleted(order.id, session.account.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageOrdersWithBanner("mark_completed_failed", msg);
  }
  revalidatePath("/nex-native/manage/orders");
  redirectToManageOrdersWithBanner("marked_completed", order.id.slice(0, 8));
}

export async function cancelOrderAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const { session, order } = await resolveOwnerAndOrder(orderId);
  try {
    await commerceService.cancelOrder(order.id, session.account.id, reason);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageOrdersWithBanner("cancel_failed", msg);
  }
  revalidatePath("/nex-native/manage/orders");
  redirectToManageOrdersWithBanner("cancelled", order.id.slice(0, 8));
}

export async function refundOrderAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;
  const { session, order } = await resolveOwnerAndOrder(orderId);
  try {
    await commerceService.refundOrder(order.id, session.account.id, reason);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageOrdersWithBanner("refund_failed", msg);
  }
  revalidatePath("/nex-native/manage/orders");
  redirectToManageOrdersWithBanner("refunded", order.id.slice(0, 8));
}

// ---------------------------------------------------------------------------
// Customer-side order cancellation (Slice 4d)
// ---------------------------------------------------------------------------
// The buyer can cancel their own order while it is still pre-payment
// (state ∈ {created, pending}). After payment (state=paid, completed) the
// buyer must contact the seller to arrange a refund via the merchant
// refund flow · unilateral post-payment cancellation is not allowed.

/**
 * Buyer taps "I've sent payment" · transitions state created → pending.
 * The seller then either confirms (marks paid) or contacts the buyer.
 * State machine trigger only permits this transition from `created`.
 */
export async function customerMarkPaymentSentAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to manage your order");
  }
  if (!orderId) {
    redirect("/nex-native/orders");
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) {
    redirect("/nex-native/orders");
  }
  if (order.customer_account_id !== session.account.id) {
    redirect("/nex-native/orders");
  }
  if (order.state !== "created") {
    const qs = new URLSearchParams({
      e: "not_created",
      m: `payment already recorded · state is '${order.state}'`,
    });
    redirect(`/nex-native/orders/${orderId}?${qs.toString()}`);
  }

  try {
    await commerceService.markOrderPending(orderId, session.account.id, reason);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "mark_sent_failed", m: msg });
    redirect(`/nex-native/orders/${orderId}?${qs.toString()}`);
  }

  revalidatePath("/nex-native/orders");
  revalidatePath(`/nex-native/orders/${orderId}`);
  const qs = new URLSearchParams({ e: "payment_sent", m: "seller has been notified" });
  redirect(`/nex-native/orders/${orderId}?${qs.toString()}`);
}

/**
 * Update the caller's chat theme preference. Account-scoped ·
 * survives sign-out/sign-in per Chat Theme sealed doctrine · never
 * URL parameter state.
 */
export async function updateChatThemeAction(formData: FormData): Promise<never> {
  const raw = String(formData.get("chat_theme") ?? "").trim();
  const clearing = raw === "" || raw === "default";
  const theme = clearing ? null : raw;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to change your theme");
  }
  // Bridge 25a · Validate against the live catalogue (chatThemeService)
  // instead of the frozen NEX_CHAT_THEMES list · any theme registered
  // via nex_chat_theme + active passes. Fall back to static list only
  // if the DB lookup fails so we never leak stack traces on transient
  // connection blips.
  if (theme !== null) {
    let allowed = false;
    try {
      const row = await chatThemeService.getThemeById(theme);
      if (row && row.is_active) allowed = true;
    } catch {
      // fall through
    }
    if (!allowed && !(NEX_CHAT_THEMES as readonly string[]).includes(theme)) {
      const qs = new URLSearchParams({
        e: "invalid_theme",
        m: `unknown theme '${raw}'`,
      });
      redirect(`/nex-native/settings/theme?${qs.toString()}`);
    }
  }
  try {
    await accountService.updateChatTheme(session.account.id, theme);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "theme_update_failed", m: msg });
    redirect(`/nex-native/settings/theme?${qs.toString()}`);
  }
  revalidatePath("/nex-native/settings/theme");
  revalidatePath("/nex-native/conversations");
  const qs = new URLSearchParams({ e: "theme_updated", m: theme ?? "default" });
  redirect(`/nex-native/settings/theme?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Banner actions (Wave B Slice 12a · on top of banner-service)
// ---------------------------------------------------------------------------

async function resolveBannerOwner(bannerId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to edit banners");
  if (!bannerId) redirectToManageBannersWithBanner("missing_banner_id", "banner id required");
  const banner = await bannerService.getBannerById(bannerId);
  if (!banner) redirectToManageBannersWithBanner("banner_not_found", "banner not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(banner.business_id)) {
    redirectToManageBannersWithBanner("not_owner", "you do not own this banner's business");
  }
  return { session, banner };
}

export async function createBannerAction(formData: FormData): Promise<never> {
  const headline = String(formData.get("headline") ?? "").trim();
  const subline  = String(formData.get("subline") ?? "");
  const paletteRaw = String(formData.get("palette") ?? "ink").trim();
  const productIdRaw = String(formData.get("product_id") ?? "").trim();

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to create a banner");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business before adding banners");

  if (!headline) redirectToManageBannersWithBanner("missing_headline", "headline required");
  if (headline.length > 80) redirectToManageBannersWithBanner("long_headline", "headline max 80 chars");
  if (subline.trim().length > 160) redirectToManageBannersWithBanner("long_subline", "subline max 160 chars");
  if (!NEX_BANNER_PALETTES.includes(paletteRaw as NexBannerPalette)) {
    redirectToManageBannersWithBanner("invalid_palette", `unknown palette '${paletteRaw}'`);
  }

  // product_id validation: if provided, must belong to caller's business
  let productId: string | null = null;
  if (productIdRaw) {
    const prod = await productService.getProductById(productIdRaw);
    if (!prod || prod.business_id !== business.id) {
      redirectToManageBannersWithBanner("invalid_product", "selected product is not one of yours");
    }
    productId = productIdRaw;
  }

  try {
    await bannerService.createBanner({
      business_id: business.id,
      product_id: productId,
      headline,
      subline: subline.trim() || null,
      palette: paletteRaw as NexBannerPalette,
      status: "draft",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageBannersWithBanner("banner_create_failed", msg);
  }
  revalidatePath("/nex-native/manage/banners");
  revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageBannersWithBanner("banner_created", headline);
}

export async function updateBannerStatusAction(formData: FormData): Promise<never> {
  const bannerId = String(formData.get("banner_id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!NEX_BANNER_STATUSES.includes(statusRaw as NexBannerStatus)) {
    redirectToManageBannersWithBanner("invalid_status", `unknown status '${statusRaw}'`);
  }
  const { banner } = await resolveBannerOwner(bannerId);
  try {
    await bannerService.updateBannerStatus(banner.id, statusRaw as NexBannerStatus);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageBannersWithBanner("banner_status_update_failed", msg);
  }
  const owned = await businessService.listBusinessesByOwner((await resolveNexAppSessionFromContext())!.account.id);
  const business = owned.find((b) => b.id === banner.business_id);
  revalidatePath("/nex-native/manage/banners");
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageBannersWithBanner(
    statusRaw === "live" ? "banner_live" : statusRaw === "archived" ? "banner_archived" : "banner_draft",
    banner.headline
  );
}

// ---------------------------------------------------------------------------
// Live actions (Wave B Slice 13a · phase-1 business announcements)
// ---------------------------------------------------------------------------

export async function createLivePostAction(formData: FormData): Promise<never> {
  const body = String(formData.get("body") ?? "").trim();
  const expiresInHoursRaw = String(formData.get("expires_in_hours") ?? "").trim();

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to post live");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business before posting live");

  if (!body) redirectToManageLiveWithBanner("missing_body", "announcement body required");
  if (body.length > 280) redirectToManageLiveWithBanner("long_body", "announcement max 280 chars");

  let expiresAt: string | null = null;
  if (expiresInHoursRaw) {
    const hours = Number(expiresInHoursRaw);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 168) {
      redirectToManageLiveWithBanner("invalid_expiry", "expiry must be 1..168 hours");
    }
    expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  }

  try {
    await liveService.createLivePost({
      business_id: business.id,
      body,
      expires_at: expiresAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageLiveWithBanner("live_create_failed", msg);
  }
  revalidatePath("/nex-native/manage/live");
  revalidatePath("/nex-native/live");
  revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageLiveWithBanner("live_created", body.slice(0, 60));
}

export async function expireLivePostAction(formData: FormData): Promise<never> {
  const postId = String(formData.get("post_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to manage live posts");
  if (!postId) redirectToManageLiveWithBanner("missing_post_id", "post id required");

  const post = await liveService.getLivePostById(postId);
  if (!post) redirectToManageLiveWithBanner("post_not_found", "live post not found");

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(post.business_id)) {
    redirectToManageLiveWithBanner("not_owner", "you do not own this business's live posts");
  }

  try {
    await liveService.expireLivePost(post.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageLiveWithBanner("live_expire_failed", msg);
  }
  revalidatePath("/nex-native/manage/live");
  revalidatePath("/nex-native/live");
  const business = owned.find((b) => b.id === post.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageLiveWithBanner("live_expired", "post retired");
}

// Slice 13b · Live polish
async function resolveOwnerAndLivePost(postId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to edit live posts");
  if (!postId) redirectToManageLiveWithBanner("missing_post_id", "post id required");
  const post = await liveService.getLivePostById(postId);
  if (!post) redirectToManageLiveWithBanner("post_not_found", "live post not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(post.business_id)) {
    redirectToManageLiveWithBanner("not_owner", "you do not own this business's live posts");
  }
  return { session, post, owned };
}

export async function updateLivePostBodyAction(formData: FormData): Promise<never> {
  const postId = String(formData.get("post_id") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  const { post, owned } = await resolveOwnerAndLivePost(postId);
  try {
    await liveService.updateLivePostBody(post.id, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageLiveWithBanner("live_body_update_failed", msg);
  }
  revalidatePath("/nex-native/manage/live");
  revalidatePath("/nex-native/live");
  const business = owned.find((b) => b.id === post.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageLiveWithBanner("live_body_updated", post.id.slice(0, 8));
}

export async function extendLivePostExpiryAction(formData: FormData): Promise<never> {
  const postId = String(formData.get("post_id") ?? "").trim();
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const hours = Number(hoursRaw);
  const { post, owned } = await resolveOwnerAndLivePost(postId);
  try {
    await liveService.extendLivePostExpiry(post.id, hours);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToManageLiveWithBanner("live_extend_failed", msg);
  }
  revalidatePath("/nex-native/manage/live");
  revalidatePath("/nex-native/live");
  const business = owned.find((b) => b.id === post.business_id);
  if (business) revalidatePath(`/nex-native/${business.slug}`);
  redirectToManageLiveWithBanner("live_expiry_extended", `+${hours}h`);
}

// Slice 3f-b · Theme-share toggle
export async function setThemeShareAction(formData: FormData): Promise<never> {
  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const shareStr = String(formData.get("share") ?? "").trim();
  const share = shareStr === "true" || shareStr === "on";

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to change theme sharing");
  if (!otherId) redirectToContactsWithBanner("missing_other", "invalid contact reference");

  try {
    await relationshipService.setThemeShare(session.account.id, otherId, share);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToContactsWithBanner("theme_share_failed", msg);
  }
  revalidatePath("/nex-native/contacts");
  redirectToContactsWithBanner(
    share ? "theme_shared" : "theme_unshared",
    otherId.slice(0, 8),
  );
}

// Wave C Slice 11b · Email lists actions
async function resolveOwnerAndList(listId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to manage lists");
  if (!listId) redirectToEmailListsWithBanner("missing_list_id", "list id required");
  const list = await emailService.getListById(listId);
  if (!list) redirectToEmailListsWithBanner("list_not_found", "list not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(list.business_id)) {
    redirectToEmailListsWithBanner("not_owner", "you do not own this list");
  }
  return { session, list };
}

export async function createEmailListAction(formData: FormData): Promise<never> {
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to create a list");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business first");
  try {
    await emailService.createList({
      business_id: business.id, name, description: description || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListsWithBanner("list_create_failed", msg);
  }
  revalidatePath("/nex-native/manage/email");
  redirectToEmailListsWithBanner("list_created", name.slice(0, 60));
}

export async function deleteEmailListAction(formData: FormData): Promise<never> {
  const listId = String(formData.get("list_id") ?? "").trim();
  const { list } = await resolveOwnerAndList(listId);
  try {
    await emailService.deleteList(list.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListsWithBanner("list_delete_failed", msg);
  }
  revalidatePath("/nex-native/manage/email");
  redirectToEmailListsWithBanner("list_deleted", list.name.slice(0, 60));
}

export async function addEmailSubscriberAction(formData: FormData): Promise<never> {
  const listId = String(formData.get("list_id") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const { list } = await resolveOwnerAndList(listId);
  try {
    await emailService.addSubscriber({ list_id: list.id, email });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListWithBanner(list.id, "subscriber_add_failed", msg);
  }
  revalidatePath(`/nex-native/manage/email/${list.id}`);
  redirectToEmailListWithBanner(list.id, "subscriber_added", email.slice(0, 60));
}

// Slice 11c · Campaign actions
async function resolveOwnerAndCampaign(campaignId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in");
  if (!campaignId) redirectToEmailListsWithBanner("missing_campaign_id", "campaign id required");
  const campaign = await emailService.getCampaignById(campaignId);
  if (!campaign) redirectToEmailListsWithBanner("campaign_not_found", "campaign not found");
  const list = await emailService.getListById(campaign.list_id);
  if (!list) redirectToEmailListsWithBanner("list_not_found", "list not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const ownedIds = new Set(owned.map((b) => b.id));
  if (!ownedIds.has(list.business_id)) {
    redirectToEmailListWithBanner(list.id, "not_owner", "you do not own this campaign");
  }
  return { session, campaign, list };
}

export async function createCampaignAction(formData: FormData): Promise<never> {
  const listId = String(formData.get("list_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "");
  const bodyText = String(formData.get("body_text") ?? "");
  const bodyHtml = String(formData.get("body_html") ?? "");
  const { list } = await resolveOwnerAndList(listId);
  let created;
  try {
    created = await emailService.createCampaign({
      list_id: list.id,
      subject,
      body_text: bodyText,
      body_html: bodyHtml || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListWithBanner(list.id, "campaign_create_failed", msg);
  }
  revalidatePath(`/nex-native/manage/email/${list.id}`);
  redirect(`/nex-native/manage/email/${list.id}/campaigns/${created.id}`);
}

export async function updateCampaignAction(formData: FormData): Promise<never> {
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const subject = String(formData.get("subject") ?? "");
  const bodyText = String(formData.get("body_text") ?? "");
  const bodyHtml = String(formData.get("body_html") ?? "");
  const { campaign, list } = await resolveOwnerAndCampaign(campaignId);
  try {
    await emailService.updateCampaign(campaign.id, {
      subject,
      body_text: bodyText,
      body_html: bodyHtml || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListWithBanner(list.id, "campaign_update_failed", msg);
  }
  revalidatePath(`/nex-native/manage/email/${list.id}/campaigns/${campaign.id}`);
  redirect(`/nex-native/manage/email/${list.id}/campaigns/${campaign.id}?e=campaign_updated&m=${encodeURIComponent(subject.slice(0, 40))}`);
}

export async function dispatchCampaignAction(formData: FormData): Promise<never> {
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const { campaign, list } = await resolveOwnerAndCampaign(campaignId);
  let result;
  try {
    result = await emailService.dispatchCampaign(campaign.id, {
      unsubscribe_base_url: process.env.NEX_PUBLIC_BASE_URL
        ? `${process.env.NEX_PUBLIC_BASE_URL}/nex-native/unsubscribe`
        : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListWithBanner(list.id, "campaign_dispatch_failed", msg);
  }
  revalidatePath(`/nex-native/manage/email/${list.id}/campaigns/${campaign.id}`);
  const banner = result.adapter_is_dry_run
    ? `dry-run · ${result.sent} sent · ${result.skipped} skipped · adapter=${result.adapter_name}`
    : `${result.sent} sent · ${result.failed} failed · ${result.skipped} skipped`;
  redirect(`/nex-native/manage/email/${list.id}/campaigns/${campaign.id}?e=campaign_dispatched&m=${encodeURIComponent(banner)}`);
}

export async function deleteCampaignAction(formData: FormData): Promise<never> {
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const { campaign, list } = await resolveOwnerAndCampaign(campaignId);
  try {
    await emailService.deleteCampaign(campaign.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListWithBanner(list.id, "campaign_delete_failed", msg);
  }
  revalidatePath(`/nex-native/manage/email/${list.id}`);
  redirectToEmailListWithBanner(list.id, "campaign_deleted", campaign.subject.slice(0, 40));
}

export async function unsubscribeEmailSubscriberAction(formData: FormData): Promise<never> {
  const listId = String(formData.get("list_id") ?? "").trim();
  const subscriberId = String(formData.get("subscriber_id") ?? "").trim();
  const { list } = await resolveOwnerAndList(listId);
  if (!subscriberId) redirectToEmailListWithBanner(list.id, "missing_subscriber_id", "subscriber id required");
  try {
    await emailService.unsubscribeById(subscriberId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToEmailListWithBanner(list.id, "subscriber_unsub_failed", msg);
  }
  revalidatePath(`/nex-native/manage/email/${list.id}`);
  redirectToEmailListWithBanner(list.id, "subscriber_unsubscribed", subscriberId.slice(0, 8));
}

// Wave D Slice 16a · Site builder actions
async function resolveOwnerAndSite(siteId: string) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in");
  if (!siteId) redirectToSiteBuilderWithBanner("missing_site_id", "site id required");
  const site = await siteService.getSiteById(siteId);
  if (!site) redirectToSiteBuilderWithBanner("site_not_found", "site not found");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned.find((b) => b.id === site.business_id);
  if (!business) redirectToSiteBuilderWithBanner("not_owner", "you do not own this site");
  return { session, site, business };
}

export async function createSiteAction(formData: FormData): Promise<never> {
  const prompt = String(formData.get("prompt") ?? "");
  const templateName = String(formData.get("template_name") ?? "modern-minimal");
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to build a site");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business first");
  let created;
  try {
    created = await siteService.createSite({
      business_id: business.id,
      prompt,
      template_name: templateName as "modern-minimal" | "warm-artisan",
      business: { display_name: business.display_name, description: business.description },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_create_failed", msg);
  }
  revalidatePath("/nex-native/manage/site");
  redirect(`/nex-native/manage/site/${created.id}`);
}

export async function updateSitePromptAction(formData: FormData): Promise<never> {
  const siteId = String(formData.get("site_id") ?? "").trim();
  const prompt = String(formData.get("prompt") ?? "");
  const { site, business } = await resolveOwnerAndSite(siteId);
  try {
    await siteService.updateSite(site.id, {
      prompt,
      business: { display_name: business.display_name, description: business.description },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_update_failed", msg);
  }
  revalidatePath(`/nex-native/manage/site/${site.id}`);
  redirect(`/nex-native/manage/site/${site.id}?e=site_updated&m=${encodeURIComponent("prompt regenerated")}`);
}

export async function publishSiteAction(formData: FormData): Promise<never> {
  const siteId = String(formData.get("site_id") ?? "").trim();
  const { site } = await resolveOwnerAndSite(siteId);
  try { await siteService.publishSite(site.id); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_publish_failed", msg);
  }
  revalidatePath(`/nex-native/manage/site/${site.id}`);
  revalidatePath(`/nex-native/site/${site.view_token}`);
  redirect(`/nex-native/manage/site/${site.id}?e=site_published&m=${encodeURIComponent("live")}`);
}

// Wave D Slice 16g · NEX AI Builder · spec-driven create (Engine 2)
export async function generateSiteFromPromptAction(formData: FormData): Promise<never> {
  const prompt = String(formData.get("prompt") ?? "");
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business first");
  let created;
  try {
    const genResult = await DEFAULT_SITE_GEN_ADAPTER.generate({
      prompt,
      business: {
        business_id: business.id,
        display_name: business.display_name,
        description: business.description,
      },
    });
    created = await siteService.applySpec(genResult.spec, {
      business: { display_name: business.display_name, description: business.description },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("ai_generation_failed", msg);
  }
  revalidatePath("/nex-native/manage/site");
  redirect(`/nex-native/manage/site/${created.id}?e=site_updated&m=${encodeURIComponent(`AI-generated · adapter=${DEFAULT_SITE_GEN_ADAPTER.name}`)}`);
}

// Wave 4A · Template Picker · deterministic template-driven site build.
// Consumes a real registry entry + real NEX business, produces a coherent
// spec by construction, applies via applySpec which fires the Wave 3
// coherence gate. Never prompts the LLM: this is the "I want a real
// bakery site, not a mystery spec" path.
export async function startTemplateBuildAction(formData: FormData): Promise<never> {
  const templateId = String(formData.get("template_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in");
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned[0];
  if (!business) redirectToOnboardingWithError("no_business", "create a business first");

  const templates = await import("@/lib/nex-native/site-templates");
  const template = templates.getTemplate(templateId);
  if (!template) {
    const qs = new URLSearchParams({ e: "unknown_template", m: `template '${templateId}' not in registry` });
    redirect(`/nex-native/manage/site/new?${qs.toString()}`);
  }
  const spec = templates.buildSpecFromTemplate(template, {
    business_id: business.id,
    display_name: business.display_name,
    description: business.description,
  });
  let created;
  try {
    created = await siteService.applySpec(spec, {
      business: { display_name: business.display_name, description: business.description },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "coherence_or_shape_failure", m: msg });
    redirect(`/nex-native/manage/site/new?${qs.toString()}`);
  }
  revalidatePath("/nex-native/manage/site");
  revalidatePath(`/nex-native/manage/site/${created.id}`);
  redirect(`/nex-native/manage/site/${created.id}?e=site_updated&m=${encodeURIComponent(`built from template ${template.id}`)}`);
}

// Slice 16e · direct field update (Engine 1)
export async function updateSiteFieldAction(formData: FormData): Promise<never> {
  const siteId = String(formData.get("site_id") ?? "").trim();
  const field = String(formData.get("field") ?? "").trim();
  const value = String(formData.get("value") ?? "");
  const { site } = await resolveOwnerAndSite(siteId);
  try {
    await siteService.updateSiteField(site.id, field as never, value);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_field_update_failed", msg);
  }
  revalidatePath(`/nex-native/manage/site/${site.id}`);
  revalidatePath(`/nex-native/site/${site.view_token}`);
  redirect(`/nex-native/manage/site/${site.id}?e=site_updated&m=${encodeURIComponent(`${field} saved`)}`);
}

export async function updateSiteSectionsAction(formData: FormData): Promise<never> {
  const siteId = String(formData.get("site_id") ?? "").trim();
  const orderedRaw = String(formData.get("sections_ordered") ?? "").trim();
  const { site } = await resolveOwnerAndSite(siteId);
  const sections = orderedRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  try {
    await siteService.updateSiteSections(site.id, sections as never);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_sections_update_failed", msg);
  }
  revalidatePath(`/nex-native/manage/site/${site.id}`);
  revalidatePath(`/nex-native/site/${site.view_token}`);
  redirect(`/nex-native/manage/site/${site.id}?e=site_updated&m=${encodeURIComponent("sections updated")}`);
}

export async function unpublishSiteAction(formData: FormData): Promise<never> {
  const siteId = String(formData.get("site_id") ?? "").trim();
  const { site } = await resolveOwnerAndSite(siteId);
  try { await siteService.unpublishSite(site.id); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_unpublish_failed", msg);
  }
  revalidatePath(`/nex-native/manage/site/${site.id}`);
  redirect(`/nex-native/manage/site/${site.id}?e=site_unpublished&m=${encodeURIComponent("draft")}`);
}

export async function deleteSiteAction(formData: FormData): Promise<never> {
  const siteId = String(formData.get("site_id") ?? "").trim();
  const { site } = await resolveOwnerAndSite(siteId);
  try { await siteService.deleteSite(site.id); }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToSiteBuilderWithBanner("site_delete_failed", msg);
  }
  revalidatePath("/nex-native/manage/site");
  redirectToSiteBuilderWithBanner("site_deleted", site.prompt.slice(0, 40) || "site");
}

// Slice 12b · Banner share-to-chat
export async function shareBannerToChatAction(formData: FormData): Promise<never> {
  const bannerId = String(formData.get("banner_id") ?? "").trim();

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to message a business");
  if (!bannerId) redirectToInboxWithError("missing_banner_id", "banner id required");

  const banner = await bannerService.getBannerById(bannerId);
  if (!banner) redirectToInboxWithError("banner_not_found", "banner not found");
  if (banner.status !== "live") {
    redirectToInboxWithError("banner_not_live", "this banner is not live");
  }

  const business = await businessService.getBusinessById(banner.business_id);
  if (!business) redirectToInboxWithError("business_not_found", "business not found");

  if (business.owner_account_id === session.account.id) {
    const qs = new URLSearchParams({
      e: "own_banner",
      m: "you own this banner · buyers see the share button, not you",
    });
    redirect(`/nex-native/${business.slug}?${qs.toString()}`);
  }

  // Product context: banner may reference a product · thread scopes to it if so.
  const aboutProductId = banner.product_id ?? null;
  let productName: string | null = null;
  if (aboutProductId) {
    const prod = await productService.getProductById(aboutProductId);
    productName = prod?.name ?? null;
  }

  let conversation = await conversationService.findLatestCustomerConversation({
    customer_account_id: session.account.id,
    business_id: business.id,
    about_product_id: aboutProductId,
  });
  if (!conversation) {
    conversation = await conversationService.createConversation({
      business_id: business.id,
      about_product_id: aboutProductId,
    });
    await conversationService.addParticipant({
      conversation_id: conversation.id,
      account_id: session.account.id,
      side: "customer",
    });
    await conversationService.addParticipant({
      conversation_id: conversation.id,
      account_id: business.owner_account_id,
      side: "business",
    });
  }

  const productLine = productName ? `\nProduct: ${productName}` : "";
  const subLine = banner.subline ? `\n${banner.subline}` : "";
  const body =
    `Hello · I'm reaching out about your live banner:\n\n` +
    `"${banner.headline}"${subLine}${productLine}`;

  try {
    await conversationService.postMessage({
      conversation_id: conversation.id,
      sender_account_id: session.account.id,
      body,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "share_failed", m: msg });
    redirect(`/nex-native/${business.slug}?${qs.toString()}`);
  }

  revalidatePath(`/nex-native/conversations`);
  revalidatePath(`/nex-native/conversations/${conversation.id}`);
  redirect(`/nex-native/conversations/${conversation.id}`);
}

// ---------------------------------------------------------------------------
// Friends actions (Wave B Slice 9b · on top of 9a backend)
// ---------------------------------------------------------------------------

export async function sendFriendInviteAction(formData: FormData): Promise<never> {
  const rawHandle = String(formData.get("handle") ?? "").trim().toLowerCase();
  // Accept "36474" as a shortcut for "nex-36474"
  const handle = rawHandle.startsWith("nex-") ? rawHandle : `nex-${rawHandle}`;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to add a friend");
  }
  if (!/^nex-[0-9]{5,}$/.test(handle)) {
    redirectToFriendsWithBanner("invalid_handle", "handle must be a NEX identity · e.g. nex-36474");
  }
  const target = await accountService.getAccountByNexHandle(handle);
  if (!target) {
    redirectToFriendsWithBanner("handle_not_found", `no NEX identity matches ${handle}`);
  }
  if (target.id === session.account.id) {
    redirectToFriendsWithBanner("self_friend", "you cannot friend yourself");
  }
  try {
    await friendService.sendInvite(session.account.id, target.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToFriendsWithBanner("invite_failed", msg);
  }
  revalidatePath("/nex-native/friends");
  redirectToFriendsWithBanner("invite_sent", handle);
}

export async function acceptFriendInviteAction(formData: FormData): Promise<never> {
  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to respond to invites");
  }
  if (!otherId) {
    redirectToFriendsWithBanner("missing_other", "invalid invite reference");
  }
  try {
    await friendService.respondToInvite(session.account.id, otherId, "accept");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToFriendsWithBanner("accept_failed", msg);
  }
  revalidatePath("/nex-native/friends");
  redirectToFriendsWithBanner("accepted", otherId.slice(0, 8));
}

export async function declineFriendInviteAction(formData: FormData): Promise<never> {
  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to respond to invites");
  }
  if (!otherId) {
    redirectToFriendsWithBanner("missing_other", "invalid invite reference");
  }
  try {
    await friendService.respondToInvite(session.account.id, otherId, "decline");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToFriendsWithBanner("decline_failed", msg);
  }
  revalidatePath("/nex-native/friends");
  redirectToFriendsWithBanner("declined", otherId.slice(0, 8));
}

// Slice 9d · block user
export async function blockAccountAction(formData: FormData): Promise<never> {
  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to block");
  if (!otherId) redirectToFriendsWithBanner("missing_other", "invalid account reference");
  try {
    await friendService.blockAccount(session.account.id, otherId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToFriendsWithBanner("block_failed", msg);
  }
  revalidatePath("/nex-native/friends");
  revalidatePath("/nex-native/contacts");
  redirectToFriendsWithBanner("blocked", otherId.slice(0, 8));
}

export async function unblockAccountAction(formData: FormData): Promise<never> {
  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to unblock");
  if (!otherId) redirectToFriendsWithBanner("missing_other", "invalid account reference");
  try {
    await friendService.unblockAccount(session.account.id, otherId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToFriendsWithBanner("unblock_failed", msg);
  }
  revalidatePath("/nex-native/friends");
  revalidatePath("/nex-native/contacts");
  redirectToFriendsWithBanner("unblocked", otherId.slice(0, 8));
}

// Slice 9c · unfriend
export async function removeFriendAction(formData: FormData): Promise<never> {
  const otherId = String(formData.get("other_account_id") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to remove a friend");
  if (!otherId) redirectToFriendsWithBanner("missing_other", "invalid friend reference");
  try {
    await friendService.removeFriend(session.account.id, otherId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToFriendsWithBanner("remove_failed", msg);
  }
  revalidatePath("/nex-native/friends");
  redirectToFriendsWithBanner("friend_removed", "friendship removed");
}

export async function customerCancelOrderAction(formData: FormData): Promise<never> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || undefined;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to manage your order");
  }
  if (!orderId) {
    redirect("/nex-native/orders");
  }

  const order = await orderService.getOrderById(orderId);
  if (!order) {
    redirect("/nex-native/orders");
  }
  if (order.customer_account_id !== session.account.id) {
    // Silently redirect · never leak existence of another user's order
    redirect("/nex-native/orders");
  }
  if (order.state !== "created" && order.state !== "pending") {
    const qs = new URLSearchParams({
      e: "cannot_cancel",
      m: `orders in state '${order.state}' cannot be cancelled by the buyer · message the seller for a refund`,
    });
    redirect(`/nex-native/orders/${orderId}?${qs.toString()}`);
  }

  try {
    await commerceService.cancelOrder(orderId, session.account.id, reason);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "cancel_failed", m: msg });
    redirect(`/nex-native/orders/${orderId}?${qs.toString()}`);
  }

  revalidatePath("/nex-native/orders");
  revalidatePath(`/nex-native/orders/${orderId}`);
  const qs = new URLSearchParams({ e: "cancelled", m: "order cancelled" });
  redirect(`/nex-native/orders/${orderId}?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Customer place-order (Slice 4b · offline payment doctrine)
// ---------------------------------------------------------------------------

export async function placeOrderAction(formData: FormData): Promise<never> {
  const productId = String(formData.get("product_id") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim() || undefined;
  const customerNoteRaw = String(formData.get("customer_note") ?? "");

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to place an order");
  }
  if (!productId) {
    redirectToInboxWithError("missing_product_id", "product id required");
  }

  const product = await productService.getProductById(productId);
  if (!product) {
    redirectToInboxWithError("product_not_found", "product not found");
  }
  if (product.status !== "live") {
    redirectToInboxWithError("product_not_live", "this product is not available right now");
  }

  const business = await businessService.getBusinessById(product.business_id);
  if (!business) {
    redirectToInboxWithError("business_not_found", "business not found");
  }

  if (business.owner_account_id === session.account.id) {
    const qs = new URLSearchParams({
      e: "own_business",
      m: "you own this business · manage orders from the queue",
    });
    redirect(`/nex-native/${business.slug}?${qs.toString()}`);
  }

  let conversation = await conversationService.findLatestCustomerConversation({
    customer_account_id: session.account.id,
    business_id: business.id,
    about_product_id: product.id,
  });
  if (!conversation) {
    conversation = await conversationService.createConversation({
      business_id: business.id,
      about_product_id: product.id,
    });
    await conversationService.addParticipant({
      conversation_id: conversation.id,
      account_id: session.account.id,
      side: "customer",
    });
    await conversationService.addParticipant({
      conversation_id: conversation.id,
      account_id: business.owner_account_id,
      side: "business",
    });
  }

  const customerNote = customerNoteRaw.trim().length === 0 ? null : customerNoteRaw.trim();
  if (customerNote !== null && customerNote.length > 500) {
    const qs = new URLSearchParams({
      e: "long_note",
      m: "note too long · max 500 characters",
    });
    redirect(`/nex-native/${business.slug}?${qs.toString()}`);
  }

  let order;
  try {
    order = await orderService.createOrder({
      customer_account_id: session.account.id,
      product_id: product.id,
      source_conversation_id: conversation.id,
      idempotency_key: idempotencyKey,
      customer_note: customerNote,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const qs = new URLSearchParams({ e: "order_create_failed", m: msg });
    redirect(`/nex-native/${business.slug}?${qs.toString()}`);
  }

  try {
    const noteLine = customerNote ? `\nBuyer note: ${customerNote}` : "";
    await conversationService.postMessage({
      conversation_id: conversation.id,
      sender_account_id: session.account.id,
      body:
        `Order placed · ${product.name} · ${product.currency} ${(product.price_pence / 100).toFixed(2)}\n` +
        `Order id: ${order.id.slice(0, 8)}\n` +
        `Payment: offline · please share details or confirm COD / pickup.` +
        noteLine,
    });
  } catch {
    /* non-fatal · the order exists · the message is a UX affordance */
  }

  revalidatePath("/nex-native/orders");
  revalidatePath(`/nex-native/orders/${order.id}`);
  revalidatePath(`/nex-native/conversations/${conversation.id}`);
  redirect(`/nex-native/orders/${order.id}`);
}

// ---------------------------------------------------------------------------
// Bridge 2 · nex_account_profile actions (migration 042)
// ---------------------------------------------------------------------------

function redirectToKindStepWithError(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/create-account/kind?${qs.toString()}`);
}

function redirectToProfileWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/settings/profile?${qs.toString()}`);
}

/** Onboarding step · "What best describes what you do?" · sets kind on the
 *  caller's nex_account_profile (upsert). No other profile fields touched.
 *  On success, redirects to the inbox. */
export async function setProfileKindAction(formData: FormData): Promise<never> {
  const raw = String(formData.get("kind") ?? "").trim();
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to answer this");
  }
  if (!raw) {
    redirectToKindStepWithError("missing_kind", "Choose one so we know how to help.");
  }
  if (!NEX_ACCOUNT_KINDS.includes(raw as NexAccountKind)) {
    redirectToKindStepWithError("invalid_kind", `unknown kind '${raw}'`);
  }
  try {
    await accountProfileService.upsertProfile(session.account.id, {
      kind: raw as NexAccountKind,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToKindStepWithError("kind_save_failed", msg);
  }
  revalidatePath("/nex-native/conversations");
  revalidatePath("/nex-native/settings/profile");
  // Post-signup chain: kind → face enrolment offer → inbox. The face
  // page presents a deliberate two-button consent · users who don't
  // want biometric enrolment can decline there and land on /conversations.
  redirect("/nex-native/create-account/face");
}

// ---------------------------------------------------------------------------
// Bridge 2c · profile avatar upload (migration 045)
// ---------------------------------------------------------------------------

const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Accept a File from the settings/profile form, validate MIME + size,
 *  upload it to the public `nex-avatars` Supabase Storage bucket under
 *  `{account_id}/avatar-{timestamp}.{ext}`, and persist the resulting
 *  public URL into nex_account_profile.avatar_url. */
export async function uploadAvatarAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in to upload a profile image");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    redirectToProfileWithBanner("avatar_missing_file", "Pick an image to upload.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    redirectToProfileWithBanner(
      "avatar_too_large",
      `Image must be ≤ 5 MB · yours is ${(file.size / 1024 / 1024).toFixed(1)} MB`,
    );
  }
  if (!AVATAR_ALLOWED_TYPES.has(file.type)) {
    redirectToProfileWithBanner(
      "avatar_wrong_type",
      `Only JPEG, PNG, and WebP images are allowed · got ${file.type || "unknown"}`,
    );
  }

  const ext = AVATAR_TYPE_TO_EXT[file.type]!;
  const path = `${session.account.id}/avatar-${Date.now()}.${ext}`;

  const admin = (await import("@/lib/nex-native/supabase-admin")).nexSupabaseAdmin;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const uploadResult = await admin.storage
    .from("nex-avatars")
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadResult.error) {
    redirectToProfileWithBanner(
      "avatar_upload_failed",
      uploadResult.error.message.slice(0, 200),
    );
  }

  const publicUrl = admin.storage.from("nex-avatars").getPublicUrl(path).data.publicUrl;
  if (!publicUrl) {
    redirectToProfileWithBanner("avatar_url_missing", "Upload succeeded but URL missing.");
  }

  try {
    await accountProfileService.upsertProfile(session.account.id, {
      avatar_url: publicUrl,
    });
  } catch (e) {
    redirectToProfileWithBanner(
      "avatar_save_failed",
      e instanceof Error ? e.message.slice(0, 200) : "unknown",
    );
  }

  revalidatePath("/nex-native/settings/profile");
  revalidatePath("/nex-native/home");
  revalidatePath("/nex-native/chat");
  redirectToProfileWithBanner("profile_saved", "Profile image updated.");
}

function parseCsvList(raw: string): string[] {
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Full profile editor · settings/profile form target · every field optional
 *  · empty inputs become null · saves via account-profile-service which
 *  validates against migration 042 CHECK constraints. */
export async function updateProfileAction(formData: FormData): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to edit your profile");
  }
  const kindRaw = String(formData.get("kind") ?? "").trim();
  const headline = String(formData.get("headline") ?? "");
  const bio = String(formData.get("bio") ?? "");
  const profession = String(formData.get("profession") ?? "");
  const locationLabel = String(formData.get("location_label") ?? "");
  const skillsRaw = String(formData.get("skills") ?? "");
  const lookingForRaw = String(formData.get("looking_for") ?? "");
  const isPublic = String(formData.get("is_public") ?? "") === "on";

  let kind: NexAccountKind | null = null;
  if (kindRaw !== "" && kindRaw !== "unset") {
    if (!NEX_ACCOUNT_KINDS.includes(kindRaw as NexAccountKind)) {
      redirectToProfileWithBanner("invalid_kind", `unknown kind '${kindRaw}'`);
    }
    kind = kindRaw as NexAccountKind;
  }

  try {
    await accountProfileService.upsertProfile(session.account.id, {
      kind,
      headline,
      bio,
      profession,
      location_label: locationLabel,
      skills: parseCsvList(skillsRaw),
      looking_for: parseCsvList(lookingForRaw),
      is_public: isPublic,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToProfileWithBanner("profile_save_failed", msg);
  }
  revalidatePath("/nex-native/settings/profile");
  redirectToProfileWithBanner("profile_saved", "Profile saved.");
}

// ---------------------------------------------------------------------------
// Admin tier management · migration 046 · package doctrine (sealed 2026-09-27)
// ---------------------------------------------------------------------------

function redirectToAdminTierWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-native/admin/tier?${qs.toString()}`);
}

/** Dev-admin-only server action to promote or demote an account tier.
 *
 *  Gate stack (BOTH must pass):
 *    1 · env `NEX_ALLOW_DEV_ADMIN=1` (never enabled in production)
 *    2 · caller's session is the provisioned dev-admin account
 *        (`dev-admin@nex-native.local`)
 *
 *  On success: sets `tier` and `bisnis_expires_at` on the target account
 *  and redirects back to /admin/tier with a success banner.
 *
 *  Phase 1 of the Indonesia payment sequence · unblocks first paying
 *  customers before wallet/subscription infra exists.
 */
export async function adminSetAccountTierAction(formData: FormData): Promise<never> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") {
    redirectToAdminTierWithBanner(
      "admin_disabled",
      "dev-admin mode is disabled in this environment",
    );
  }

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in first");

  // Verify the caller's auth user matches the provisioned dev-admin
  const auth = await accountService.getAccountBySupabaseUserId(session.account.supabase_user_id!);
  if (!auth) redirectToAdminTierWithBanner("account_missing", "session has no account");
  const supabaseUserId = auth.supabase_user_id;
  if (!supabaseUserId) redirectToAdminTierWithBanner("no_auth_user", "session has no supabase user");
  const authRow = await nexSupabaseAdmin.auth.admin.getUserById(supabaseUserId);
  if (authRow.error || !authRow.data.user) {
    redirectToAdminTierWithBanner("auth_lookup_failed", authRow.error?.message ?? "unknown");
  }
  if ((authRow.data.user.email ?? "").toLowerCase() !== "dev-admin@nex-native.local") {
    redirectToAdminTierWithBanner(
      "not_dev_admin",
      "only the provisioned dev-admin account can promote tiers",
    );
  }

  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const tierRaw = String(formData.get("tier") ?? "").trim();
  const monthsRaw = String(formData.get("months") ?? "1").trim();

  if (!emailRaw) redirectToAdminTierWithBanner("missing_email", "enter an account email");
  if (!NEX_ACCOUNT_TIERS.includes(tierRaw as NexAccountTier)) {
    redirectToAdminTierWithBanner("invalid_tier", `unknown tier '${tierRaw}'`);
  }
  const tier = tierRaw as NexAccountTier;
  const months = Number(monthsRaw);
  if (!Number.isFinite(months) || months < 0 || months > 120) {
    redirectToAdminTierWithBanner("invalid_months", "months must be a number 0-120");
  }

  // Look up the target account by email → supabase auth → nex_account
  const list = await nexSupabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = (list.data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === emailRaw);
  if (!found) {
    redirectToAdminTierWithBanner("no_auth_user_for_email", `no auth user for ${emailRaw}`);
  }
  const targetAcc = await nexSupabaseAdmin
    .from("nex_account")
    .select("id, display_name")
    .eq("supabase_user_id", found.id)
    .maybeSingle();
  if (targetAcc.error || !targetAcc.data) {
    redirectToAdminTierWithBanner(
      "no_nex_account",
      `no nex_account for auth user ${emailRaw}`,
    );
  }
  const target = targetAcc.data as { id: string; display_name: string };

  // Compute expiry for paid tiers
  let bisnisExpiresAt: string | null = null;
  if (tier === "bisnis" || tier === "pro") {
    if (months > 0) {
      const expiry = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
      bisnisExpiresAt = expiry.toISOString();
    } else {
      // months=0 → indefinite subscription (admin comp · never lapses)
      bisnisExpiresAt = null;
    }
  }

  const upd = await nexSupabaseAdmin
    .from("nex_account")
    .update({ tier, bisnis_expires_at: bisnisExpiresAt })
    .eq("id", target.id);
  if (upd.error) {
    redirectToAdminTierWithBanner("update_failed", upd.error.message);
  }

  const successMsg =
    tier === "gratis"
      ? `${target.display_name} (${emailRaw}) → gratis`
      : `${target.display_name} (${emailRaw}) → ${tier}${
          bisnisExpiresAt
            ? ` · expires ${bisnisExpiresAt.slice(0, 10)}`
            : " · indefinite"
        }`;

  revalidatePath("/nex-native/admin/tier");
  redirectToAdminTierWithBanner("tier_set", successMsg);
}

// ---------------------------------------------------------------------------
// Admin theme builder · Bridge 4 · migration 048
// ---------------------------------------------------------------------------

function redirectToAdminThemeWithBanner(code: string, message: string): never {
  const qs = new URLSearchParams({ e: code, m: message });
  redirect(`/nex-head-quarters/nex-native-themes?${qs.toString()}`);
}

/** Dev-admin-only server action to CREATE a new chat theme.
 *
 *  Gate stack (BOTH must pass):
 *    1 · env `NEX_ALLOW_DEV_ADMIN=1`
 *    2 · caller's session is `dev-admin@nex-native.local`
 *
 *  Persists via chat-theme-service.createTheme. Slug must be unique.
 */
export async function adminCreateChatThemeAction(
  formData: FormData,
): Promise<never> {
  if (process.env.NEX_ALLOW_DEV_ADMIN !== "1") {
    redirectToAdminThemeWithBanner(
      "admin_disabled",
      "dev-admin mode is disabled in this environment",
    );
  }

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirectToInboxWithError("unauthenticated", "sign in first");

  const auth = await accountService.getAccountBySupabaseUserId(
    session.account.supabase_user_id!,
  );
  if (!auth) redirectToAdminThemeWithBanner("account_missing", "session has no account");
  const supabaseUserId = auth.supabase_user_id;
  if (!supabaseUserId) redirectToAdminThemeWithBanner("no_auth_user", "session has no supabase user");
  const authRow = await nexSupabaseAdmin.auth.admin.getUserById(supabaseUserId);
  if (authRow.error || !authRow.data.user) {
    redirectToAdminThemeWithBanner("auth_lookup_failed", authRow.error?.message ?? "unknown");
  }
  if ((authRow.data.user.email ?? "").toLowerCase() !== "dev-admin@nex-native.local") {
    redirectToAdminThemeWithBanner(
      "not_dev_admin",
      "only the provisioned dev-admin account can create themes",
    );
  }

  const id = String(formData.get("id") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const accentHex = String(formData.get("accent_hex") ?? "").trim();
  const tier = String(formData.get("tier") ?? "gratis").trim() as
    | "gratis"
    | "bisnis";
  const sortOrderRaw = String(formData.get("sort_order") ?? "100").trim();
  // Category is derived from tier · gratis → standard · bisnis →
  // premium. Keeps the admin form simple by removing a redundant field.
  const category: "standard" | "premium" =
    tier === "bisnis" ? "premium" : "standard";
  // Hero image · optional file upload. When provided, upload to the
  // nex-chat-theme-hero bucket and use the returned public URL.
  const heroFile = formData.get("hero_image_file");

  if (!id) redirectToAdminThemeWithBanner("missing_id", "theme id is required");
  if (!/^[a-z][a-z0-9_-]{1,30}$/.test(id)) {
    redirectToAdminThemeWithBanner(
      "invalid_id",
      "theme id must be 2-31 chars, lowercase letters/numbers/hyphens/underscores, starting with a letter",
    );
  }
  if (!name) redirectToAdminThemeWithBanner("missing_name", "theme name is required");
  if (!/^#[0-9A-Fa-f]{6}$/.test(accentHex)) {
    redirectToAdminThemeWithBanner(
      "invalid_accent",
      "accent must be a hex colour like #009FEF",
    );
  }
  if (tier !== "gratis" && tier !== "bisnis") {
    redirectToAdminThemeWithBanner("invalid_tier", `unknown tier '${tier}'`);
  }
  const sortOrder = Number(sortOrderRaw);
  if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 10000) {
    redirectToAdminThemeWithBanner("invalid_sort", "sort order must be a number between 0 and 10000");
  }

  let heroImageUrl: string | null = null;
  if (heroFile && heroFile instanceof File && heroFile.size > 0) {
    if (heroFile.size > 5 * 1024 * 1024) {
      redirectToAdminThemeWithBanner(
        "image_too_big",
        "background image must be under 5 MB",
      );
    }
    const okMime = ["image/png", "image/jpeg", "image/webp", "image/avif"].includes(
      heroFile.type,
    );
    if (!okMime) {
      redirectToAdminThemeWithBanner(
        "image_bad_type",
        `background image must be PNG, JPG, WebP or AVIF (got ${heroFile.type || "unknown"})`,
      );
    }
    try {
      heroImageUrl = await chatThemeService.uploadThemeHero(id, heroFile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      redirectToAdminThemeWithBanner("upload_failed", `image upload failed · ${msg}`);
    }
  }

  try {
    await chatThemeService.createTheme({
      id,
      name,
      tagline: tagline || null,
      accent_hex: accentHex.toUpperCase(),
      tier,
      category,
      hero_image_url: heroImageUrl,
      sort_order: sortOrder,
      is_active: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirectToAdminThemeWithBanner("create_failed", msg);
  }

  revalidatePath("/nex-head-quarters/nex-native-themes");
  revalidatePath("/nex-native/settings/theme");
  redirectToAdminThemeWithBanner(
    "theme_created",
    `${name} (${id}) created${heroImageUrl ? " with background image" : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Bridge 15b · Menu editor (restaurants + cafes)
// ---------------------------------------------------------------------------
//
// Ownership pattern: for section actions we bind businessId; for item
// actions we bind either businessId (create) or itemId (mutate/delete).
// In every case we resolve back to the business + verify
// owner_account_id === session.account.id before touching the DB.

function redirectToMenuWithBanner(code: string, message: string): never {
  redirect(
    "/nex-native/manage/menu?e=" + code + "&m=" + encodeURIComponent(message),
  );
}

/** Bridge 15b · create a new menu section for the seller's business. */
export async function createMenuSectionAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirectToMenuWithBanner("section_forbidden", "You don't own this shop");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
  const sortOrder = sortOrderRaw ? Number.parseInt(sortOrderRaw, 10) : 0;

  if (name.length < 1 || name.length > 80) {
    redirectToMenuWithBanner(
      "section_failed",
      "Section name must be 1-80 characters",
    );
  }

  try {
    await menuService.createSection({
      business_id: businessId,
      name,
      description,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("section_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath(`/nex-native/${business.slug}/menu`);
  redirectToMenuWithBanner("section_ok", `Section "${name}" added`);
}

/** Bridge 15b · rename a menu section · owner-only. */
export async function updateMenuSectionAction(
  sectionId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const sections = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  // Resolve owner via section → business join. Simpler path: fetch the
  // section row via any listSectionsByBusiness call across owned
  // businesses. Cheaper alt: expose a getSectionById in the service.
  // For now iterate owned businesses (usually 1) and match.
  let ownerBusiness: (typeof sections)[number] | null = null;
  for (const b of sections) {
    const arr = await menuService.listSectionsByBusiness(b.id);
    if (arr.some((s) => s.id === sectionId)) {
      ownerBusiness = b;
      break;
    }
  }
  if (!ownerBusiness) {
    redirectToMenuWithBanner("section_forbidden", "Section not found");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 1 || name.length > 80) {
    redirectToMenuWithBanner(
      "section_failed",
      "Section name must be 1-80 characters",
    );
  }

  try {
    await menuService.updateSection(sectionId, {
      name,
      description: description.length > 0 ? description : null,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("section_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${ownerBusiness.slug}/menu`);
  redirectToMenuWithBanner("section_ok", "Section updated");
}

/** Bridge 15b · delete a menu section · items in it become uncategorised. */
export async function deleteMenuSectionAction(
  sectionId: string,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const ownedBusinesses = await businessService.listBusinessesByOwner(
    session.account.id,
  );
  let ownerBusiness: (typeof ownedBusinesses)[number] | null = null;
  for (const b of ownedBusinesses) {
    const arr = await menuService.listSectionsByBusiness(b.id);
    if (arr.some((s) => s.id === sectionId)) {
      ownerBusiness = b;
      break;
    }
  }
  if (!ownerBusiness) {
    redirectToMenuWithBanner("section_forbidden", "Section not found");
  }

  try {
    await menuService.deleteSection(sectionId);
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("section_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${ownerBusiness.slug}`);
  revalidatePath(`/nex-native/${ownerBusiness.slug}/menu`);
  redirectToMenuWithBanner("section_ok", "Section deleted");
}

/** Bridge 15b · create a menu item. Reads canonical dietary_tags[] +
 *  allergens[] via FormData.getAll. Price is IDR (whole rupiah stored
 *  as price_pence · IDR has no fractional unit). */
export async function createMenuItemAction(
  businessId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const business = await businessService.getBusinessById(businessId);
  if (!business || business.owner_account_id !== session.account.id) {
    redirectToMenuWithBanner("item_forbidden", "You don't own this shop");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sectionIdRaw = String(formData.get("section_id") ?? "").trim();
  const sectionId = sectionIdRaw.length > 0 ? sectionIdRaw : null;
  const priceRaw = String(formData.get("price_idr") ?? "").trim();
  const priceIdr = Number.parseInt(priceRaw, 10);
  // Menu items store centi-rupiah (matches product-service) · UI takes
  // whole IDR, service stores * 100.
  const price = Number.isFinite(priceIdr) ? priceIdr * 100 : NaN;
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const dietaryTags = formData
    .getAll("dietary_tags")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const allergens = formData
    .getAll("allergens")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const spiceRaw = String(formData.get("spice_level") ?? "0").trim();
  const spice = Number.parseInt(spiceRaw, 10);
  const isFeatured = String(formData.get("is_featured") ?? "") === "on";
  const preparationTime =
    String(formData.get("preparation_time") ?? "").trim() || null;
  const portionNote =
    String(formData.get("portion_note") ?? "").trim() || null;
  // Bridge 23a · free-perk chips · service normalises unknown values away.
  const perks = formData
    .getAll("perks")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const perksNote =
    String(formData.get("perks_note") ?? "").trim() || null;

  if (name.length < 1 || name.length > 120) {
    redirectToMenuWithBanner(
      "item_failed",
      "Dish name must be 1-120 characters",
    );
  }
  if (!Number.isFinite(price) || price < 0) {
    redirectToMenuWithBanner("item_failed", "Price must be a positive number");
  }

  try {
    await menuService.createMenuItem({
      business_id: businessId,
      section_id: sectionId,
      name,
      description,
      price_pence: price,
      currency: "IDR",
      image_url: imageUrl,
      dietary_tags: dietaryTags,
      allergens: allergens,
      spice_level: Number.isFinite(spice) ? spice : 0,
      is_available: true,
      is_featured: isFeatured,
      preparation_time: preparationTime,
      portion_note: portionNote,
      perks,
      perks_note: perksNote,
      status: "live",
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("item_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${business.slug}`);
  revalidatePath(`/nex-native/${business.slug}/menu`);
  redirectToMenuWithBanner("item_ok", `"${name}" added to the menu`);
}

async function resolveMenuItemOwnership(
  itemId: string,
  accountId: string,
): Promise<{
  item: NonNullable<Awaited<ReturnType<typeof menuService.getMenuItemById>>>;
  business: NonNullable<Awaited<ReturnType<typeof businessService.getBusinessById>>>;
} | null> {
  const item = await menuService.getMenuItemById(itemId);
  if (!item) return null;
  const business = await businessService.getBusinessById(item.business_id);
  if (!business || business.owner_account_id !== accountId) return null;
  return { item, business };
}

/** Bridge 15b · toggle a menu item's daily availability (sold-out state). */
export async function toggleMenuItemAvailableAction(
  itemId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nextRaw = String(formData.get("is_available") ?? "").trim();
  const nextAvailable = nextRaw === "true";

  const owned = await resolveMenuItemOwnership(itemId, session.account.id);
  if (!owned) {
    redirectToMenuWithBanner("item_forbidden", "Dish not found");
  }

  try {
    await menuService.updateMenuItem(itemId, { is_available: nextAvailable });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("item_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${owned.business.slug}/menu`);
  redirectToMenuWithBanner(
    "item_ok",
    nextAvailable
      ? `${owned.item.name} · available`
      : `${owned.item.name} · sold out today`,
  );
}

/** Bridge 15b · toggle the chef's-choice star on a menu item. */
export async function toggleMenuItemFeaturedAction(
  itemId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nextRaw = String(formData.get("is_featured") ?? "").trim();
  const nextFeatured = nextRaw === "true";

  const owned = await resolveMenuItemOwnership(itemId, session.account.id);
  if (!owned) {
    redirectToMenuWithBanner("item_forbidden", "Dish not found");
  }

  try {
    await menuService.updateMenuItem(itemId, { is_featured: nextFeatured });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("item_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${owned.business.slug}`);
  revalidatePath(`/nex-native/${owned.business.slug}/menu`);
  redirectToMenuWithBanner(
    "item_ok",
    nextFeatured
      ? `${owned.item.name} · marked as house special`
      : `${owned.item.name} · no longer featured`,
  );
}

/** Bridge 15b · delete a menu item permanently. */
/** Bridge 23c-2 · Update every editable field on an existing dish
 *  · seller-only. Includes the fields the create form supports plus
 *  spice + perks + perks_note so the edit form can adjust them
 *  after launch. Redirects back to /manage/menu on success. */
export async function updateMenuItemAction(
  itemId: string,
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const owned = await resolveMenuItemOwnership(itemId, session.account.id);
  if (!owned) {
    redirectToMenuWithBanner("item_forbidden", "Dish not found");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const sectionIdRaw = String(formData.get("section_id") ?? "").trim();
  const sectionId = sectionIdRaw.length > 0 ? sectionIdRaw : null;
  const priceRaw = String(formData.get("price_idr") ?? "").trim();
  const priceIdr = Number.parseInt(priceRaw, 10);
  const price = Number.isFinite(priceIdr) ? priceIdr * 100 : NaN;
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const dietaryTags = formData
    .getAll("dietary_tags")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const allergens = formData
    .getAll("allergens")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const spiceRaw = String(formData.get("spice_level") ?? "0").trim();
  const spice = Number.parseInt(spiceRaw, 10);
  const isFeatured = String(formData.get("is_featured") ?? "") === "on";
  const preparationTime =
    String(formData.get("preparation_time") ?? "").trim() || null;
  const portionNote =
    String(formData.get("portion_note") ?? "").trim() || null;
  const perks = formData
    .getAll("perks")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const perksNote =
    String(formData.get("perks_note") ?? "").trim() || null;

  if (name.length < 1 || name.length > 120) {
    redirectToMenuWithBanner(
      "item_failed",
      "Dish name must be 1-120 characters",
    );
  }
  if (!Number.isFinite(price) || price < 0) {
    redirectToMenuWithBanner("item_failed", "Price must be a positive number");
  }

  try {
    await menuService.updateMenuItem(itemId, {
      section_id: sectionId,
      name,
      description,
      price_pence: price,
      image_url: imageUrl,
      dietary_tags: dietaryTags,
      allergens,
      spice_level: Number.isFinite(spice) ? spice : 0,
      is_featured: isFeatured,
      preparation_time: preparationTime,
      portion_note: portionNote,
      perks,
      perks_note: perksNote,
    });
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("item_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/manage/menu/${itemId}`);
  revalidatePath(`/nex-native/${owned.business.slug}`);
  revalidatePath(`/nex-native/${owned.business.slug}/menu`);
  redirectToMenuWithBanner("item_ok", `${name} updated`);
}

export async function deleteMenuItemAction(
  itemId: string,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const owned = await resolveMenuItemOwnership(itemId, session.account.id);
  if (!owned) {
    redirectToMenuWithBanner("item_forbidden", "Dish not found");
  }

  try {
    await menuService.deleteMenuItem(itemId);
    await sellerResponsivenessService
      .markBusinessOwnerActive(session.account.id)
      .catch(() => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    redirectToMenuWithBanner("item_failed", msg);
  }

  revalidatePath("/nex-native/manage/menu");
  revalidatePath(`/nex-native/${owned.business.slug}`);
  revalidatePath(`/nex-native/${owned.business.slug}/menu`);
  redirectToMenuWithBanner("item_ok", `${owned.item.name} deleted`);
}
