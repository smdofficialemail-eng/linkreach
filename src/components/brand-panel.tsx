export function BrandPanel() {
  return (
    <div className="relative hidden w-[44%] overflow-hidden lg:block">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-600 to-ink-900" />
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-400/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-sky-400/20 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-white/15 text-xl font-extrabold text-white backdrop-blur">
            L
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">LinkReach</span>
        </div>

        <div>
          <h2 className="max-w-md text-3xl font-extrabold leading-tight tracking-tight text-white">
            Reach thousands of leads without sounding like a robot.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-100/80">
            Run personalized connection and message campaigns across multiple LinkedIn
            profiles — all from one inbox.
          </p>
          <div className="mt-8 space-y-3.5">
            {[
              ["▸", "Multi-profile campaigns with sequenced follow-ups"],
              ["▸", "Unified inbox for every conversation, every profile"],
              ["▸", "Human-like pacing with smart timezones and safety limits"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3 text-sm text-white/85">
                <span className="mt-0.5 font-bold text-brand-200">{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-brand-100/60">
          LinkedIn outreach automation · Campaigns · Unibox · Analytics
        </p>
      </div>
    </div>
  );
}
