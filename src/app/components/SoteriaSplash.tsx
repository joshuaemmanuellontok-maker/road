import { Wrench } from "lucide-react";

export function SoteriaSplash() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#050b14] text-white soteria-splash">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_22%,rgba(34,211,238,0.1)_68%,rgba(251,191,36,0.14))]" />
      <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#fbbf24]/15 soteria-splash-orbit" />
      <div className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/10 soteria-splash-orbit-reverse" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(180deg,transparent,rgba(8,17,31,0.98))]" />

      <div className="relative flex w-full max-w-xl flex-col items-center px-6 text-center soteria-splash-content">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] border border-[#f8d38a]/35 bg-[linear-gradient(135deg,rgba(249,115,22,0.28),rgba(14,165,233,0.18))] p-[1px] shadow-[0_28px_90px_rgba(249,115,22,0.35)]">
          <div className="flex h-full w-full items-center justify-center rounded-[1.9rem] bg-[#07111f]/95">
            <Wrench className="h-14 w-14 text-[#ffd08a]" />
          </div>
        </div>

        <div className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-[#fbbf24]">
            Enterprise Roadside Command
          </p>
          <h1 className="mt-3 bg-[linear-gradient(110deg,#ffffff_0%,#ffe0ad_44%,#7dd3fc_100%)] bg-clip-text text-5xl font-semibold tracking-[0.03em] text-transparent sm:text-6xl">
            Soteria
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
            Safety, response, and service intelligence coming online.
          </p>
        </div>

        <div className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#f97316,#fbbf24,#38bdf8)] soteria-splash-progress" />
        </div>
      </div>
    </div>
  );
}
