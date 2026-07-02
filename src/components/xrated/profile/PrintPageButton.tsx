"use client";

export function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center rounded-lg px-4 text-[12px] font-extrabold uppercase tracking-widest text-black"
      style={{ background: "#FFB300" }}
    >
      🖨 Print
    </button>
  );
}
