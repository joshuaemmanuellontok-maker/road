import { Link } from "react-router";
import { ArrowRight, LockKeyhole, Shield, Sparkles } from "lucide-react";
import { LogoWithSecret } from "../components/LogoWithSecret";
import bgImage from "figma:asset/d571ab94c972a42774418c81ee3ff78236af1305.png";

const enterpriseSignals = [
  {
    title: "Responder Readiness",
    description: "Review accredited mechanics, towing teams, rescue riders, and local service coverage from one trusted workspace.",
  },
  {
    title: "Roadside Coordination",
    description: "Monitor service requests, responder approvals, and active roadside support with a calmer, clearer interface.",
  },
  {
    title: "Safety Oversight",
    description: "Keep road safety reports, community concerns, and administrative access organized for authorized Soteria operators.",
  },
];

const trustPoints = [
  "Roadside service coordination",
  "Safety reporting oversight",
  "Structured responder review",
];

export function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08111f] text-white">
      <img
        src={bgImage}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,107,61,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_24%),linear-gradient(180deg,rgba(5,10,18,0.88),rgba(10,18,31,0.94))]" />
      <div className="absolute inset-0 backdrop-blur-[10px]" />
      <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-[#ff6b3d]/10 blur-3xl sm:top-32 sm:h-80 sm:w-80" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:px-6 sm:py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <LogoWithSecret
              iconContainerClassName="h-10 w-10 sm:h-11 sm:w-11"
              iconClassName="h-5 w-5 sm:h-6 sm:w-6"
              textClassName="text-[1.5rem] font-semibold tracking-tight sm:text-[1.75rem]"
              className="max-w-full gap-2.5"
            />

            <div className="flex flex-col items-start gap-2 text-left sm:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                <Shield className="h-4 w-4 text-[#ff8a65]" />
                Administrative Access
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-300 sm:text-right">
                A professional control point for roadside assistance, safety reports, responders, and platform users.
              </p>
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center py-8 sm:py-10 lg:py-14">
          <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-8">
            <div className="rounded-[28px] border border-white/10 bg-[#0b1525]/72 px-5 py-7 shadow-[0_28px_90px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:px-7 sm:py-8 lg:px-10 lg:py-10">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#ff8a65]/25 bg-[#ff8a65]/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffd5c7] sm:px-4">
                <Sparkles className="h-4 w-4 text-[#ff8a65]" />
                Soteria Roadside Service & Safety
              </div>

              <div className="mt-6 max-w-3xl">
                <h1 className="text-[2.2rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-[2.8rem] lg:text-[4.25rem]">
                  Coordinated roadside service with safety at the center.
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base lg:text-lg">
                  Soteria helps authorized operators manage roadside help, responder accreditation, service requests, and safety concerns so stranded motorists can get support with clearer oversight.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  to="/admin/login"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff6b3d] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(255,107,61,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#ff7a52] sm:w-auto sm:min-w-[220px] sm:px-6 sm:text-base"
                >
                  Continue to Admin Login
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200">
                <LockKeyhole className="h-4 w-4" />
                Authorized users only. All existing routing and access flows remain unchanged.
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {trustPoints.map((point) => (
                  <div
                    key={point}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate-200"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  What Soteria supports
                </p>
                <div className="mt-5 space-y-4">
                  {enterpriseSignals.map((item, index) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-[#0f1b2d]/75 p-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#ff6b3d]/12 text-sm font-semibold text-[#ffb69f]">
                          0{index + 1}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-white">
                            {item.title}
                          </h2>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Operational posture
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-white/10 bg-[#0d1727]/75 px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Access model
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">Admin-first</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Purpose-built for authorized teams that manage roadside service and safety operations.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0d1727]/75 px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Interface goal
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">Clarity at a glance</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Clearer organization for requests, responder records, safety topics, and service oversight.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </main>

        <footer className="mt-auto pt-2">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <p className="leading-6">
                Soteria administration portal for roadside service and safety operations.
              </p>
              <p className="text-slate-400">
                Professional access layer for oversight, responder review, and community safety coordination.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
