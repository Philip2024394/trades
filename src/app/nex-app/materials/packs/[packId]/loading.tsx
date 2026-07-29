// Loading skeleton for the pack detail screen. Rendered by Next.js
// while the server component fetches. Uses the same tokens so the
// transition into the loaded state is seamless.

import "../../../nex-app.css";

const BG        = "#F6F3ED";
const CARD      = "#FFFFFF";
const BORDER    = "#ECEAE4";
const SHIMMER   = "linear-gradient(90deg,#F1EEE7 0%,#FBF7F0 50%,#F1EEE7 100%)";

export default function PackDetailLoading() {
  return (
    <div className="nex-app-root">
      <div
        className="relative mx-auto flex min-h-screen w-full flex-col"
        style={{ background: BG, maxWidth: 440 }}
      >
        {/* Header skeleton */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-start gap-2">
            <span className="h-12 w-12 shrink-0 rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }} />
            <div className="flex-1 space-y-2 pt-1">
              <Bar w={140} h={22} />
              <Bar w={200} h={14} />
              <Bar w={240} h={12} />
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-3 flex gap-3 overflow-hidden px-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="shrink-0" style={{ width: 140, height: 90, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
              <div className="p-4 space-y-2">
                <Bar w={22} h={22} rounded />
                <Bar w={70} h={20} />
                <Bar w={50} h={10} />
              </div>
            </div>
          ))}
        </div>

        {/* Search skeleton */}
        <div className="mt-4 flex gap-2 px-4">
          <Bar w={92} h={48} rounded />
          <div className="flex-1"><Bar w="100%" h={48} rounded /></div>
          <Bar w={48} h={48} rounded />
          <Bar w={48} h={48} rounded />
        </div>

        {/* Board card skeletons */}
        <div className="mt-4 space-y-3 px-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex overflow-hidden" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, minHeight: 176 }}>
              <div className="w-[36%]" style={{ background: SHIMMER, backgroundSize: "200% 100%", animation: "shim 1.4s linear infinite" }} />
              <div className="flex-1 space-y-2 p-4">
                <Bar w={110} h={18} />
                <Bar w={160} h={12} />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Bar w="100%" h={28} />
                  <Bar w="100%" h={28} />
                  <Bar w="100%" h={28} />
                </div>
                <div className="mt-4 flex gap-2">
                  <Bar w="45%" h={38} />
                  <Bar w="45%" h={38} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes shim {
          from { background-position: 200% 0; }
          to   { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function Bar({ w, h, rounded = false }: { w: number | string; h: number; rounded?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: w,
        height: h,
        background: SHIMMER,
        backgroundSize: "200% 100%",
        animation: "shim 1.4s linear infinite",
        borderRadius: rounded ? 999 : 6,
      }}
    />
  );
}
