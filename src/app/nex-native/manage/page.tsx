// src/app/nex-native/manage/page.tsx
//
// Merchant product-management surface · pilot scope.
// --------------------------------------------------
// Server Component. Reads the caller's session · reads the caller's
// single owned business (pilot rule: one business per user) · lists
// every product for that business (live + draft + archived) · renders:
//   · header with business name + public slug URL + sign-out + inbox link
//   · one row per existing product with:
//       - name + price (GBP · formatted from integer pence)
//       - inline "edit price" form  → updateProductPriceAction
//       - inline "change status" form → changeProductStatusAction
//       - NO delete (pilot doctrine · products are archived, not deleted)
//   · "add product" form at the bottom → createManagedProductAction
//
// Doctrine references:
//   · Identity Doctrine · every mutation validated by owner_account_id
//   · Persistence integrity · archive, never delete
//   · Anti-fabrication · every value comes from real caller input
//   · Mobile-first · 44px inputs · full-width buttons at 320px viewport

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import type { NexProductRow } from "@/lib/nex-native/types";
import {
  changeProductStatusAction,
  createManagedProductAction,
  signOutAction,
  updateBusinessHoursAction,
  updateBusinessProfileAction,
  updateProductDescriptionAction,
  updateProductGalleryAction,
  updateProductImageUrlAction,
  updateProductPriceAction,
  createVariantAction,
  deleteVariantAction,
  updateProductSkuAction,
  updateProductStockStatusFromManageAction,
  updateProductTagsAction,
} from "../_actions";
import { SubmitButton } from "../_submit-button";
import { NexNativeShell } from "../_shell";
import { YourNexCard } from "../_your-nex-card";
import { nexAddressForBusiness } from "@/lib/nex-native/nex-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS_CODES = new Set([
  "created",
  "price_updated",
  "description_updated",
  "image_updated",
  "gallery_updated",
  "tags_updated",
  "stock_status_updated",
  "sku_updated",
  "variant_created",
  "variant_deleted",
  "hours_updated",
  "hours_cleared",
  "made_live",
  "archived",
  "business_profile_updated",
]);

function formatGbp(pence: number): string {
  return (pence / 100).toFixed(2);
}

function statusLabel(status: NexProductRow["status"]): string {
  if (status === "live") return "live";
  if (status === "draft") return "draft";
  return "archived";
}

function statusBadgeClass(status: NexProductRow["status"]): string {
  if (status === "live") return "bg-green-100 text-green-900 border-green-300";
  if (status === "draft") return "bg-amber-100 text-amber-900 border-amber-300";
  return "bg-neutral-200 text-neutral-700 border-neutral-300";
}

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in");
  }

  const params = await searchParams;
  const banner = params.e && params.m
    ? { code: params.e, message: params.m }
    : null;
  const bannerIsSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) {
    redirect("/nex-native/onboarding");
  }
  // Pilot bound: one business per account. If somehow more exist we show
  // only the first and note the pilot limit honestly.
  const business = owned[0];
  const multipleBusinesses = owned.length > 1;

  // No status filter · include live + draft + archived so the merchant
  // can bring an archived product back live.
  const products = await productService.listProductsByBusiness(business.id);

  // Slice 6c · fetch variants per product (parallel)
  const variantsByProduct = new Map<string, Awaited<ReturnType<typeof productService.listVariants>>>();
  await Promise.all(products.map(async (p) => {
    variantsByProduct.set(p.id, await productService.listVariants(p.id));
  }));

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4 border-b border-[var(--nex-neutral-300)] pb-3">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-[var(--nex-neutral-900)]">
              Manage · {business.display_name}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--nex-neutral-500)]">
            <Link href="/nex-native/conversations" className="underline">
              inbox
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="underline">
                sign out
              </button>
            </form>
          </div>
        </div>
        {(() => {
          const addr = nexAddressForBusiness(business);
          return addr ? <YourNexCard address={addr} /> : null;
        })()}
        {multipleBusinesses && (
          <p className="text-xs text-amber-800">
            Pilot limit · showing your first business only · {owned.length} total on this account.
          </p>
        )}
      </header>

      {banner && (
        <div
          className={`mb-4 rounded border p-3 text-xs ${
            bannerIsSuccess
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
          role="status"
        >
          {banner.code === "created" && (
            <>Product created · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "price_updated" && (
            <>Price updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "description_updated" && (
            <>Description updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "image_updated" && (
            <>Image updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "gallery_updated" && (
            <>Gallery updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "tags_updated" && (
            <>Tags updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "stock_status_updated" && (
            <>Stock status updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "sku_updated" && (
            <>SKU updated · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "business_profile_updated" && (
            <>Business profile saved · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "hours_updated" && (
            <>Weekly hours saved · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "hours_cleared" && (
            <>Weekly hours cleared · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "made_live" && (
            <>Now live · <span className="font-medium">{banner.message}</span></>
          )}
          {banner.code === "archived" && (
            <>Archived · <span className="font-medium">{banner.message}</span></>
          )}
          {!SUCCESS_CODES.has(banner.code) && banner.message}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Business profile
        </h2>
        <form
          action={updateBusinessProfileAction}
          className="rounded border border-neutral-300 bg-white p-4"
        >
          <label className="mb-3 block text-xs text-neutral-600">
            About the business
            <textarea
              name="description"
              maxLength={2000}
              rows={3}
              placeholder="Two or three sentences · what you do · where · what makes you different."
              defaultValue={business.description ?? ""}
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Logo URL
            <input
              type="url"
              name="logo_url"
              maxLength={1024}
              placeholder="https://…"
              defaultValue={business.logo_url ?? ""}
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              must start with http:// or https:// · leave blank to clear
            </span>
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Address
            <textarea
              name="address"
              maxLength={500}
              rows={2}
              placeholder="Street · town · postcode"
              defaultValue={business.address ?? ""}
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Public phone
            <input
              type="tel"
              name="public_phone"
              maxLength={64}
              placeholder="e.g. +44 20 7946 0000"
              defaultValue={business.public_phone ?? ""}
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              shown on your public page · not the auth phone
            </span>
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Public email
            <input
              type="email"
              name="public_email"
              maxLength={320}
              placeholder="hello@example.com"
              defaultValue={business.public_email ?? ""}
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>

          <label className="mb-4 block text-xs text-neutral-600">
            Website
            <input
              type="url"
              name="website_url"
              maxLength={1024}
              placeholder="https://…"
              defaultValue={business.website_url ?? ""}
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>

          <fieldset className="mb-4 rounded border border-neutral-200 p-3">
            <legend className="px-1 text-xs font-medium text-neutral-700">
              Social handles · shown as icons on your public page
            </legend>
            <p className="mb-3 text-xs text-neutral-500">
              Enter each handle WITHOUT the leading @ (or with · we strip it). Letters, digits, dots, dashes, underscores · 1-64 chars.
              Leave blank for platforms you don&apos;t use.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block text-xs text-neutral-600">
                Instagram
                <input
                  type="text"
                  name="instagram_handle"
                  maxLength={64}
                  placeholder="yourshop"
                  defaultValue={business.instagram_handle ?? ""}
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-xs text-neutral-600">
                Facebook
                <input
                  type="text"
                  name="facebook_handle"
                  maxLength={64}
                  placeholder="yourshop"
                  defaultValue={business.facebook_handle ?? ""}
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-xs text-neutral-600">
                TikTok
                <input
                  type="text"
                  name="tiktok_handle"
                  maxLength={64}
                  placeholder="yourshop"
                  defaultValue={business.tiktok_handle ?? ""}
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-xs text-neutral-600">
                LinkedIn
                <input
                  type="text"
                  name="linkedin_handle"
                  maxLength={64}
                  placeholder="company/yourshop"
                  defaultValue={business.linkedin_handle ?? ""}
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-xs text-neutral-600">
                X (Twitter)
                <input
                  type="text"
                  name="x_handle"
                  maxLength={64}
                  placeholder="yourshop"
                  defaultValue={business.x_handle ?? ""}
                  className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="mb-4 rounded border border-neutral-200 p-3">
            <legend className="px-1 text-xs font-medium text-neutral-700">
              Status message · one-liner shown on your public page
            </legend>
            <p className="mb-3 text-xs text-neutral-500">
              e.g. &quot;Open till 8pm today&quot; · &quot;Restocked oak&quot; · &quot;Closed Mon reopening Tue&quot;.
              Optional TTL · when the time passes the message auto-hides. Leave TTL blank for no expiry.
            </p>
            <label className="mb-3 block text-xs text-neutral-600">
              Message (max 200)
              <input
                type="text"
                name="status_message"
                maxLength={200}
                placeholder="What's happening today?"
                defaultValue={business.status_message ?? ""}
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="mb-1 block text-xs text-neutral-600">
              Expires at (optional · ISO or datetime-local)
              <input
                type="datetime-local"
                name="status_message_expires_at"
                defaultValue={business.status_message_expires_at
                  ? new Date(business.status_message_expires_at).toISOString().slice(0, 16)
                  : ""}
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-neutral-500">
                Leave blank to keep the message until manually cleared.
              </span>
            </label>
          </fieldset>

          <fieldset className="mb-4 rounded border border-neutral-200 p-3">
            <legend className="px-1 text-xs font-medium text-neutral-700">
              Payment · offline · seller and buyer settle directly
            </legend>
            <p className="mb-3 text-xs text-neutral-500">
              NEX does not process payments. Customers place orders here, then
              you settle payment out-of-band (bank transfer · cash on delivery ·
              in-person pickup · whatever you prefer). Fill this in so buyers
              know how to pay you.
            </p>
            <label className="mb-3 block text-xs text-neutral-600">
              Payment instructions (shown on order page)
              <textarea
                name="payment_instructions"
                maxLength={2000}
                rows={3}
                placeholder="e.g. Bank transfer · Sort code 12-34-56 · Acc 12345678 · Reference your order id."
                defaultValue={business.payment_instructions ?? ""}
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="mb-2 flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                name="accepts_cod"
                defaultChecked={business.accepts_cod}
                className="h-4 w-4"
              />
              <input type="hidden" name="accepts_cod_sentinel" value="1" />
              Cash on delivery available
            </label>
            <label className="mb-1 flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                name="accepts_pickup"
                defaultChecked={business.accepts_pickup}
                className="h-4 w-4"
              />
              <input type="hidden" name="accepts_pickup_sentinel" value="1" />
              Customer collection (pay in person)
            </label>
          </fieldset>

          <SubmitButton
            label="Save business profile"
            pendingLabel="Saving…"
            fullWidth
          />
        </form>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Weekly hours
        </h2>
        <form action={updateBusinessHoursAction} className="rounded border border-neutral-300 bg-white p-4">
          <fieldset className="space-y-2">
            {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => {
              const dayHours = business.hours && typeof business.hours === "object" ? (business.hours as Record<string, {open:string;close:string}|null>)[day] : null;
              const isClosed = dayHours === null && business.hours !== null;
              const openDefault = dayHours?.open ?? "09:00";
              const closeDefault = dayHours?.close ?? "17:00";
              const dayLabel = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" }[day];
              return (
                <div key={day} className="grid grid-cols-[3rem_auto_1fr_1fr] items-center gap-2 text-xs">
                  <span className="font-medium text-neutral-700">{dayLabel}</span>
                  <label className="inline-flex items-center gap-1 text-neutral-600">
                    <input
                      type="checkbox"
                      name={`${day}_closed`}
                      defaultChecked={isClosed}
                      className="h-4 w-4"
                    />
                    closed
                  </label>
                  <input
                    type="time"
                    name={`${day}_open`}
                    defaultValue={openDefault}
                    className="min-h-[36px] rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    name={`${day}_close`}
                    defaultValue={closeDefault}
                    className="min-h-[36px] rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                </div>
              );
            })}
          </fieldset>
          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <input type="checkbox" name="clear_hours" className="h-4 w-4" />
              clear all hours (mark as unspecified)
            </label>
            <SubmitButton label="Save hours" pendingLabel="Saving…" variant="secondary" />
          </div>
          <p className="mt-2 text-[11px] text-neutral-500">
            One interval per day · times are your local business time · leave &ldquo;closed&rdquo; unchecked and fill open+close to publish.
          </p>
        </form>
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Products ({products.length})
          </h2>
          <div className="flex items-baseline gap-3 text-xs">
            <Link href="/nex-native/manage/orders" className="text-neutral-700 underline">
              orders →
            </Link>
            <Link href="/nex-native/manage/analytics" className="text-neutral-700 underline">
              analytics →
            </Link>
          </div>
        </div>
        {products.length === 0 ? (
          <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
            No products yet · add your first one below.
          </p>
        ) : (
          <ul className="grid gap-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-800"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900">{p.name}</div>
                    <div className="text-xs text-neutral-500">
                      {p.currency} {formatGbp(p.price_pence)} · id{" "}
                      <code className="font-mono">{p.id.slice(0, 8)}…</code>
                    </div>
                  </div>
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}
                  >
                    {statusLabel(p.status)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <form
                    action={updateProductPriceAction}
                    className="rounded border border-neutral-200 bg-neutral-50 p-2"
                  >
                    <input type="hidden" name="product_id" value={p.id} />
                    <label className="block text-xs text-neutral-600">
                      Edit price (GBP)
                      <input
                        required
                        type="number"
                        name="product_price_gbp"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        defaultValue={formatGbp(p.price_pence)}
                        className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                      />
                    </label>
                    <div className="mt-2">
                      <SubmitButton
                        label="Save price"
                        pendingLabel="Saving…"
                        variant="secondary"
                        fullWidth
                      />
                    </div>
                  </form>

                  <form
                    action={changeProductStatusAction}
                    className="rounded border border-neutral-200 bg-neutral-50 p-2"
                  >
                    <input type="hidden" name="product_id" value={p.id} />
                    <label className="block text-xs text-neutral-600">
                      Change status
                      <select
                        name="status"
                        defaultValue={p.status === "archived" ? "live" : "archived"}
                        className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
                      >
                        <option value="live">live · visible on public page</option>
                        <option value="archived">archived · hidden</option>
                      </select>
                    </label>
                    <div className="mt-2">
                      <SubmitButton
                        label="Update status"
                        pendingLabel="Updating…"
                        variant="secondary"
                        fullWidth
                      />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      Products cannot be deleted in the pilot · archive hides them from the public page.
                    </p>
                  </form>
                </div>

                <form
                  action={updateProductImageUrlAction}
                  className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <input type="hidden" name="product_id" value={p.id} />
                  <label className="block text-xs text-neutral-600">
                    Image URL
                    {p.image_url && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-500">
                        · current preview
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.image_url}
                          alt=""
                          className="h-6 w-6 rounded border border-neutral-200 object-contain bg-white"
                        />
                      </span>
                    )}
                    <input
                      type="url"
                      name="image_url"
                      maxLength={1024}
                      placeholder="https://…"
                      defaultValue={p.image_url ?? ""}
                      className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                    />
                  </label>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">
                      http:// or https:// · leave blank to clear
                    </span>
                    <SubmitButton
                      label="Save image"
                      pendingLabel="Saving…"
                      variant="secondary"
                    />
                  </div>
                </form>

                <form
                  action={updateProductGalleryAction}
                  className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <input type="hidden" name="product_id" value={p.id} />
                  <label className="block text-xs text-neutral-600">
                    Gallery URLs (one per line · max 10)
                    <textarea
                      name="gallery_urls"
                      rows={3}
                      placeholder={"https://cdn.example.com/a.jpg\nhttps://cdn.example.com/b.jpg"}
                      defaultValue={p.gallery_urls?.join("\n") ?? ""}
                      className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 font-mono text-xs"
                    />
                  </label>
                  {p.gallery_urls && p.gallery_urls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.gallery_urls.map((u, i) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={`${u}-${i}`}
                          src={u}
                          alt=""
                          className="h-10 w-10 rounded border border-neutral-200 object-contain bg-white"
                        />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">
                      http:// or https:// · leave blank to clear
                    </span>
                    <SubmitButton
                      label="Save gallery"
                      pendingLabel="Saving…"
                      variant="secondary"
                    />
                  </div>
                </form>

                {/* Slice 6c · Variants section */}
                <details className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2">
                  <summary className="cursor-pointer text-xs font-medium text-neutral-700">
                    Variants ({(variantsByProduct.get(p.id) ?? []).length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {(variantsByProduct.get(p.id) ?? []).map((v) => (
                      <div key={v.id} className="flex items-center gap-2 rounded border border-neutral-200 bg-white p-2 text-xs">
                        <span className="flex-1 font-medium">{v.name}</span>
                        <span className="text-neutral-600">
                          {v.price_pence !== null
                            ? `${p.currency} ${(v.price_pence / 100).toFixed(2)}`
                            : <span className="text-neutral-400">parent price</span>}
                        </span>
                        <form action={deleteVariantAction}>
                          <input type="hidden" name="variant_id" value={v.id} />
                          <SubmitButton label="✕" pendingLabel="…" variant="secondary" />
                        </form>
                      </div>
                    ))}
                    <form action={createVariantAction} className="rounded border border-neutral-200 bg-white p-2">
                      <input type="hidden" name="product_id" value={p.id} />
                      <div className="grid grid-cols-[1fr_5rem_3rem_auto] gap-1">
                        <input
                          required
                          type="text"
                          name="name"
                          maxLength={200}
                          placeholder="variant name (e.g. Size M)"
                          className="min-h-[36px] rounded border border-neutral-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          name="price_major"
                          step="0.01"
                          min="0"
                          placeholder="price (optional)"
                          className="min-h-[36px] rounded border border-neutral-300 px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          name="position"
                          min="0"
                          defaultValue={0}
                          className="min-h-[36px] rounded border border-neutral-300 px-2 py-1 text-xs"
                        />
                        <SubmitButton label="Add" pendingLabel="…" variant="secondary" />
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-500">
                        leave price blank to use parent product price · position controls display order (0 first)
                      </p>
                    </form>
                  </div>
                </details>

                <form
                  action={updateProductSkuAction}
                  className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <input type="hidden" name="product_id" value={p.id} />
                  <label className="block text-xs text-neutral-600">
                    SKU (product code · unique in your business · optional)
                    <input
                      type="text"
                      name="sku"
                      maxLength={50}
                      placeholder="e.g. OAK-STAIR-01"
                      defaultValue={p.sku ?? ""}
                      pattern="[A-Za-z0-9._\-]{1,50}"
                      className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-xs"
                    />
                  </label>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">
                      letters, digits, dot, dash, underscore · leave blank to clear
                    </span>
                    <SubmitButton label="Save SKU" pendingLabel="Saving…" variant="secondary" />
                  </div>
                </form>

                <form
                  action={updateProductStockStatusFromManageAction}
                  className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <input type="hidden" name="product_id" value={p.id} />
                  <label className="block text-xs text-neutral-600">
                    Stock status (shown to buyers on your public page)
                    <select
                      name="stock_status"
                      defaultValue={p.stock_status ?? "none"}
                      className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
                    >
                      <option value="none">no signal (default)</option>
                      <option value="in_stock">in stock</option>
                      <option value="low_stock">low stock</option>
                      <option value="made_to_order">made to order</option>
                      <option value="sold_out">sold out</option>
                    </select>
                  </label>
                  <div className="mt-2 flex justify-end">
                    <SubmitButton
                      label="Save stock status"
                      pendingLabel="Saving…"
                      variant="secondary"
                    />
                  </div>
                </form>

                <form
                  action={updateProductTagsAction}
                  className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <input type="hidden" name="product_id" value={p.id} />
                  <label className="block text-xs text-neutral-600">
                    Tags (comma or newline separated · max 20)
                    <input
                      type="text"
                      name="tags"
                      placeholder="oak, bespoke, staircase, kitchen-fitting"
                      defaultValue={p.tags?.join(", ") ?? ""}
                      className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-xs"
                    />
                  </label>
                  {p.tags && p.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Link
                          key={t}
                          href={`/nex-native/search?q=${encodeURIComponent(t)}`}
                          className="inline-block rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700 hover:border-neutral-500 hover:bg-neutral-50"
                          title={`See more products tagged '${t}'`}
                        >
                          {t}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">
                      lowercase · digits + hyphens · leave blank to clear
                    </span>
                    <SubmitButton
                      label="Save tags"
                      pendingLabel="Saving…"
                      variant="secondary"
                    />
                  </div>
                </form>

                <form
                  action={updateProductDescriptionAction}
                  className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-2"
                >
                  <input type="hidden" name="product_id" value={p.id} />
                  <label className="block text-xs text-neutral-600">
                    Description
                    <textarea
                      name="product_description"
                      maxLength={2000}
                      rows={3}
                      placeholder="Describe what customers actually get · materials · dimensions · what makes it yours. Max 2000 chars."
                      defaultValue={p.description ?? ""}
                      className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
                    />
                  </label>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-neutral-500">
                      shown on your public page + inside NEX Chat replies
                    </span>
                    <SubmitButton
                      label="Save description"
                      pendingLabel="Saving…"
                      variant="secondary"
                    />
                  </div>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Add product
        </h2>
        <form
          action={createManagedProductAction}
          className="rounded border border-neutral-300 bg-white p-4"
        >
          <label className="mb-3 block text-xs text-neutral-600">
            Product name
            <input
              required
              type="text"
              name="product_name"
              maxLength={200}
              placeholder="e.g. Bespoke oak staircase"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Price (GBP)
            <input
              required
              type="number"
              name="product_price_gbp"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 24.50"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              stored as integer pence · GBP only for the pilot
            </span>
          </label>

          <label className="mb-3 block text-xs text-neutral-600">
            Description (optional)
            <textarea
              name="product_description"
              maxLength={2000}
              rows={3}
              placeholder="Describe what customers get · materials · dimensions · what makes it yours."
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              max 2000 characters · shown on your public page
            </span>
          </label>

          <label className="mb-4 block text-xs text-neutral-600">
            Image URL (optional)
            <input
              type="url"
              name="product_image_url"
              maxLength={1024}
              placeholder="https://…"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              http:// or https:// · shown on public page and in NEX Chat
            </span>
          </label>

          <SubmitButton
            label="Add product"
            pendingLabel="Adding product…"
            fullWidth
          />
        </form>
      </section>
    </main>
    </NexNativeShell>
  );
}
