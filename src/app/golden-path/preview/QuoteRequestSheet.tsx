// QuoteRequestSheet — proof-of-concept form for Phil's site.
//
// Real merchant surface. Opens as a BottomSheet on mobile / centered
// modal on desktop. Composes every Phase 3 form primitive:
//   TextInput · Select · RadioGroup · CheckboxGroup · TextArea ·
//   FileUpload · Checkbox · FormSection · StickySubmit.
//
// Not wired to a backend — this demonstrates the kit works.

"use client";

import { Building2, Home, Ruler, Wallet } from "lucide-react";
import { useState } from "react";
import {
  BottomSheet,
  Button,
  Checkbox,
  CheckboxGroup,
  FileUpload,
  FormSection,
  RadioGroup,
  Select,
  StickySubmit,
  TextArea,
  TextInput
} from "@/platform/ui";

export type QuoteRequestSheetProps = {
  open: boolean;
  onClose: () => void;
};

type QuoteState = {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  service: string;
  propertyType: string;
  budget: string;
  addOns: readonly string[];
  message: string;
  consent: boolean;
};

const INITIAL: QuoteState = {
  name: "",
  email: "",
  phone: "",
  postcode: "",
  service: "",
  propertyType: "residential",
  budget: "",
  addOns: [],
  message: "",
  consent: false
};

export function QuoteRequestSheet({ open, onClose }: QuoteRequestSheetProps) {
  const [state, setState] = useState<QuoteState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof QuoteState, string>>>({});

  const update = <K extends keyof QuoteState>(key: K, value: QuoteState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = () => {
    const next: Partial<Record<keyof QuoteState, string>> = {};
    if (!state.name.trim()) next.name = "Please tell us your name";
    if (!state.email.trim()) next.email = "We need an email to reply";
    if (!state.phone.trim()) next.phone = "A phone number helps us respond quickly";
    if (!state.postcode.trim()) next.postcode = "Postcode helps us confirm coverage";
    if (!state.service) next.service = "Pick the closest service — we'll clarify on the call";
    if (!state.consent) next.consent = "Please confirm you agree";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    setSubmitted(true);
  };

  const handleClose = () => {
    onClose();
    // Reset a moment later so the closing transition doesn't flicker
    setTimeout(() => {
      setState(INITIAL);
      setErrors({});
      setSubmitted(false);
    }, 300);
  };

  if (submitted) {
    return (
      <BottomSheet open={open} onClose={handleClose} title="Quote request sent">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-7 w-7 text-emerald-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h4 className="text-[16px] font-semibold text-neutral-900">
            Thanks, {state.name.split(" ")[0] || "there"}
          </h4>
          <p className="max-w-sm text-[13px] text-neutral-600">
            Phil replies to every quote within one working day. Check your
            inbox — including spam — for a confirmation.
          </p>
          <Button intent="primary" size="lg" onClick={handleClose}>
            Done
          </Button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Request a quote"
      footer={
        <StickySubmit
          helper="Free, no obligation. We reply within 1 working day."
          secondary={
            <Button
              intent="ghost"
              size="lg"
              block
              onClick={handleClose}
              type="button"
            >
              Cancel
            </Button>
          }
          primary={
            <Button intent="primary" size="lg" block onClick={handleSubmit}>
              Send request
            </Button>
          }
        />
      }
    >
      <div className="flex flex-col gap-6">
        <FormSection
          step={1}
          title="About you"
          description="So we know how to get back to you."
        >
          <TextInput
            id="qr-name"
            label="Your name"
            value={state.name}
            onChange={(e) => update("name", e.currentTarget.value)}
            error={errors.name}
            autoComplete="name"
            required
          />
          <TextInput
            id="qr-email"
            type="email"
            label="Email"
            value={state.email}
            onChange={(e) => update("email", e.currentTarget.value)}
            error={errors.email}
            autoComplete="email"
            required
          />
          <TextInput
            id="qr-phone"
            type="tel"
            label="Phone"
            value={state.phone}
            onChange={(e) => update("phone", e.currentTarget.value)}
            error={errors.phone}
            autoComplete="tel"
            required
          />
          <TextInput
            id="qr-postcode"
            label="Postcode"
            value={state.postcode}
            onChange={(e) => update("postcode", e.currentTarget.value)}
            error={errors.postcode}
            hint="Helps us confirm you're in our service area."
            autoComplete="postal-code"
            required
          />
        </FormSection>

        <FormSection
          step={2}
          title="Your job"
          description="A few quick details help us prepare the right quote."
        >
          <Select
            id="qr-service"
            label="Which service?"
            placeholder="Choose the closest one"
            value={state.service}
            onChange={(e) => update("service", e.currentTarget.value)}
            error={errors.service}
            options={[
              { value: "door-installation", label: "Door installation" },
              { value: "fire-doors", label: "Fire doors" },
              { value: "composite-doors", label: "Composite doors" },
              { value: "internal-doors", label: "Internal doors" },
              { value: "kitchen-fitting", label: "Kitchen fitting" },
              { value: "other", label: "Something else" }
            ]}
            required
          />
          <RadioGroup
            id="qr-property"
            name="propertyType"
            label="Property type"
            variant="cards"
            value={state.propertyType}
            onChange={(v) => update("propertyType", v)}
            options={[
              {
                value: "residential",
                label: "Residential",
                description: "Your own home or a rental you own.",
                icon: Home
              },
              {
                value: "commercial",
                label: "Commercial",
                description: "Office, retail, or hospitality space.",
                icon: Building2
              }
            ]}
          />
          <Select
            id="qr-budget"
            label="Rough budget"
            labelBadge="Optional"
            placeholder="Prefer not to say"
            value={state.budget}
            onChange={(e) => update("budget", e.currentTarget.value)}
            options={[
              { value: "under-1k", label: "Under €1,000" },
              { value: "1k-5k", label: "€1,000 – €5,000" },
              { value: "5k-15k", label: "€5,000 – €15,000" },
              { value: "15k-plus", label: "€15,000+" }
            ]}
          />
          <CheckboxGroup
            id="qr-addons"
            name="addOns"
            label="Add-ons you're interested in"
            labelBadge="Optional"
            variant="cards"
            values={state.addOns}
            onChange={(v) => update("addOns", v)}
            options={[
              {
                value: "survey",
                label: "Free on-site survey",
                description: "We come out, measure, and give a fixed quote — no pressure.",
                icon: Ruler
              },
              {
                value: "finance",
                label: "Finance / instalments",
                description: "Split the cost across 6 or 12 months.",
                icon: Wallet
              }
            ]}
          />
        </FormSection>

        <FormSection step={3} title="Anything else?">
          <TextArea
            id="qr-message"
            label="Message"
            labelBadge="Optional"
            placeholder="e.g. FD30 fire doors across 4 apartments before end of month."
            value={state.message}
            onChange={(e) => update("message", e.currentTarget.value)}
            maxLength={2000}
            rows={3}
          />
          <FileUpload
            id="qr-photos"
            label="Photos of the job"
            hint="Optional — but a couple of photos help us quote faster."
            multiple
            enableCamera
          />
          <Checkbox
            id="qr-consent"
            label="I agree to Phil's Carpentry contacting me about this quote. We never share your details."
            checked={state.consent}
            onChange={(v) => update("consent", v)}
            error={errors.consent}
            required
          />
        </FormSection>
      </div>
    </BottomSheet>
  );
}
