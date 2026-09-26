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
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as orderService from "@/lib/nex-native/order-service";
import * as commerceService from "@/lib/nex-native/commerce-service";
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
import { NEX_ACCOUNT_KINDS, NEX_CHAT_THEMES, NEX_PRODUCT_STOCK_STATUSES, type NexAccountKind, type NexChatTheme, type NexProductStockStatus } from "@/lib/nex-native/types";
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
// Onboarding · create business + first product
// ---------------------------------------------------------------------------

export async function createBusinessAction(formData: FormData): Promise<never> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const productName = String(formData.get("product_name") ?? "").trim();
  const priceRaw = String(formData.get("product_price_gbp") ?? "").trim();

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

export async function updateProductStockStatusAction(formData: FormData): Promise<never> {
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
  const theme = clearing ? null : (raw as NexChatTheme);

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirectToInboxWithError("unauthenticated", "sign in to change your theme");
  }
  if (theme !== null && !NEX_CHAT_THEMES.includes(theme)) {
    const qs = new URLSearchParams({ e: "invalid_theme", m: `unknown theme '${raw}'` });
    redirect(`/nex-native/settings/theme?${qs.toString()}`);
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
