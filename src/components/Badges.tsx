import { humanize } from "@/lib/client";

// Severity: heat colour plus the word, never colour alone
const SEVERITY: Record<string, { color: string; bars: number }> = {
  LOW: { color: "#6b8fbf", bars: 1 },
  MEDIUM: { color: "#e3b341", bars: 2 },
  HIGH: { color: "#f0803c", bars: 3 },
  CRITICAL: { color: "#f2385a", bars: 4 },
};

export function SeverityBadge({ value }: { value: string }) {
  const s = SEVERITY[value] ?? SEVERITY.LOW;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium" style={{ color: s.color }}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className="w-[3px] rounded-[1px]"
                style={{ height: 4 + b * 2.5, background: b <= s.bars ? s.color : "#26405f" }} />
        ))}
      </span>
      {humanize(value)}
    </span>
  );
}

const STATUS: Record<string, string> = {
  NEW: "#59b2ff",
  TRIAGED: "#8fb0e0",
  IN_PROGRESS: "#e3b341",
  CONTAINED: "#f0803c",
  RESOLVED: "#3fb950",
  CLOSED: "#62769a",
};

export function StatusBadge({ value }: { value: string }) {
  const c = STATUS[value] ?? "#62769a";
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[12px] font-medium"
          style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}>
      {humanize(value)}
    </span>
  );
}

const SLA: Record<string, { color: string; label: string }> = {
  ON_TRACK: { color: "#3fb950", label: "On track" },
  AT_RISK: { color: "#e3b341", label: "At risk" },
  BREACHED: { color: "#f2385a", label: "Breached" },
  MET: { color: "#3fb950", label: "Met" },
  NOT_APPLICABLE: { color: "#62769a", label: "n/a" },
};

export function SlaBadge({ value }: { value: string }) {
  const s = SLA[value] ?? SLA.NOT_APPLICABLE;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}

export function Flash({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role="status" className={`rounded-md border px-3 py-2 text-[14px] ${
      msg.ok ? "border-good/40 bg-good/10 text-[#7ee08c]" : "border-critical/40 bg-critical/10 text-[#ff8da1]"
    }`}>
      {msg.text}
    </p>
  );
}
