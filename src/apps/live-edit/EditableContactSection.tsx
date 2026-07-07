// EditableContactSection — phone / WhatsApp / email / hours block.
// The one section every UK tradesperson needs. Tap-to-call, tap-to-
// WhatsApp, tap-to-email work directly. Sticky on mobile is a
// natural upgrade path — deferred.

"use client";

import {
  Mail,
  MessageCircle,
  Phone,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { useEditMode } from "./EditModeContext";
import { EditableSection } from "./EditableSection";
import { useSectionPlacement } from "./useSectionPlacement";

export type EditableContactSectionProps = {
  id: string;
  initial?: {
    heading?: string;
    subhead?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    hours?: string;
  };
};

export function EditableContactSection({
  id,
  initial
}: EditableContactSectionProps) {
  const editCtx = useEditMode();
  const [heading, setHeading] = useState(initial?.heading ?? "Get in touch");
  const [subhead, setSubhead] = useState(
    initial?.subhead ?? "We reply the same day, weekdays 8am–6pm."
  );
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(initial?.whatsapp ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [hours, setHours] = useState(
    initial?.hours ?? "Mon–Fri 8am–6pm · Sat by appointment"
  );
  const [editing, setEditing] = useState(false);
  const { variant } = useSectionPlacement(id, "3col");
  const gridCols = variant === "stacked" ? "" : "md:grid-cols-3";

  useEffect(() => {
    editCtx.registerSectionState(id, {
      heading,
      subhead,
      phone,
      whatsapp,
      email,
      hours
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, heading, subhead, phone, whatsapp, email, hours]);

  const patch = (setter: (v: string) => void, v: string) => {
    setter(v);
    editCtx.markDirty();
  };

  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined;
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`
    : undefined;
  const mailtoHref = email ? `mailto:${email}` : undefined;

  return (
    <EditableSection
      id={id}
      type="contact"
      label="Contact"
      onEdit={() => setEditing(true)}
    >
      <div className="px-4 py-10">
        <div className="mb-6 text-center">
          <h2 className="text-[22px] font-bold text-neutral-900 md:text-[28px]">
            {heading}
          </h2>
          {subhead ? (
            <p className="mx-auto mt-1 max-w-2xl text-[13px] text-neutral-600 md:text-[14px]">
              {subhead}
            </p>
          ) : null}
        </div>
        <div className={`mx-auto grid max-w-3xl gap-3 ${gridCols}`}>
          {telHref ? (
            <a
              href={telHref}
              className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 text-center transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <Phone className="h-5 w-5" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Call
              </div>
              <div className="text-[15px] font-semibold text-neutral-900">
                {phone}
              </div>
            </a>
          ) : null}
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 text-center transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                WhatsApp
              </div>
              <div className="text-[15px] font-semibold text-neutral-900">
                {whatsapp}
              </div>
            </a>
          ) : null}
          {mailtoHref ? (
            <a
              href={mailtoHref}
              className="flex flex-col items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-5 text-center transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                <Mail className="h-5 w-5" />
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Email
              </div>
              <div className="break-all text-[13px] font-semibold text-neutral-900">
                {email}
              </div>
            </a>
          ) : null}
        </div>
        {hours ? (
          <div className="mt-5 text-center text-[12px] text-neutral-500">
            {hours}
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-neutral-900">
                Edit contact block
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close editor"
                className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Heading
                </span>
                <input
                  type="text"
                  value={heading}
                  onChange={(e) => patch(setHeading, e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Subhead
                </span>
                <input
                  type="text"
                  value={subhead}
                  onChange={(e) => patch(setSubhead, e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Phone
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => patch(setPhone, e.currentTarget.value)}
                    placeholder="+44 7…"
                    className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    WhatsApp
                  </span>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => patch(setWhatsapp, e.currentTarget.value)}
                    placeholder="+44 7…"
                    className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => patch(setEmail, e.currentTarget.value)}
                  placeholder="you@example.com"
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Hours
                </span>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => patch(setHours, e.currentTarget.value)}
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px]"
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </EditableSection>
  );
}
