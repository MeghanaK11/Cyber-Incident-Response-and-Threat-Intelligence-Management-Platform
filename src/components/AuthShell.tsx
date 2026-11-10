import { Logo } from "./Logo";

// Two-column frame shared by the Sign in and Sign up pages:
// the radar artwork on the left, the form on the right.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-[#20271F] lg:block">
        <svg viewBox="0 0 600 600" className="absolute left-1/2 top-1/2 h-[120%] -translate-x-1/2 -translate-y-1/2 opacity-90" aria-hidden>
          <defs>
            <radialGradient id="sweep" cx="300" cy="300" r="280" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#A6B69A" stopOpacity="0.35" />
              <stop offset="1" stopColor="#A6B69A" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[70, 140, 210, 280].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#465341" strokeWidth="1.5" />
          ))}
          <line x1="20" y1="300" x2="580" y2="300" stroke="#465341" />
          <line x1="300" y1="20" x2="300" y2="580" stroke="#465341" />
          <path d="M300 300 L300 20 A280 280 0 0 1 542 160 Z" fill="url(#sweep)" />
          <line x1="300" y1="300" x2="542" y2="160" stroke="#A6B69A" strokeWidth="2" />
          {/* contacts, coloured by severity */}
          <circle cx="410" cy="170" r="6" fill="#CF6F68" />
          <circle cx="455" cy="250" r="4.5" fill="#D18B57" />
          <circle cx="215" cy="410" r="4" fill="#B99A64" />
          <circle cx="160" cy="210" r="3.5" fill="#82977F" />
          <circle cx="360" cy="455" r="3.5" fill="#82977F" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-[#EEF1EA]">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <span className="font-display text-[22px] font-semibold tracking-wider">CIRT</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-wide">
              Every alert, triaged and tracked to closure.
            </h1>
            <p className="mt-4 text-[16px] text-[#B7C3AE]">
              Incident response for the security operations team: SLAs, playbooks and a record of every decision.
            </p>
          </div>
        </div>
      </section>

      <section className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Logo size={30} />
            <span className="font-display text-[20px] font-semibold tracking-wider">CIRT</span>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}

/** Password box with a Show/Hide toggle */
export function PasswordInput(props: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  show: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="relative">
      <input id={props.id} type={props.show ? "text" : "password"} autoComplete={props.autoComplete} required
             className="input pr-16" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      {props.onToggle && (
        <button type="button" onClick={props.onToggle}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] font-medium text-ink-2 hover:text-accent-dark"
                aria-label={props.show ? "Hide password" : "Show password"}>
          {props.show ? "Hide" : "Show"}
        </button>
      )}
    </div>
  );
}
