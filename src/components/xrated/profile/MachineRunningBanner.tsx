// MachineRunningBanner — per-machine announcement marquee. Same visual
// pattern as the platform-wide RunningMarquee (CSS-only right-to-left
// scroll) but with SOLID brand yellow background + black text so the
// message reads at a distance against light page chrome.

export function MachineRunningBanner({ text }: { text: string }) {
  if (!text || text.trim().length === 0) return null;
  const content = `${text}  •  ${text}  •  ${text}  •  ${text}`;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <div
        className="relative overflow-hidden rounded-xl"
        style={{ background: "#FFB300" }}
        aria-label="Machine announcement"
      >
        <div
          className="machine-marquee whitespace-nowrap py-2 text-[13px] font-extrabold"
          style={{ color: "#0A0A0A" }}
        >
          <span className="inline-block px-4">{content}</span>
          <span className="inline-block px-4" aria-hidden="true">
            {content}
          </span>
        </div>
        <style>{`
          .machine-marquee {
            display: inline-flex;
            animation: machine-marquee 30s linear infinite;
          }
          @keyframes machine-marquee {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    </div>
  );
}
