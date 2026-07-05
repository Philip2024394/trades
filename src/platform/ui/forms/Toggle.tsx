// Toggle — iOS-style switch. For boolean settings + preferences.

export type ToggleProps = {
  id: string;
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
};

export function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled
}: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-[52px] items-center justify-between gap-3 rounded-lg px-2 py-1 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-neutral-900">{label}</div>
        {description ? (
          <div className="mt-0.5 text-[12px] text-neutral-600">
            {description}
          </div>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-neutral-900" : "bg-neutral-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
