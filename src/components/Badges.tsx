import { humanize } from "@/lib/client";

// Colours come from the white and olive palette. Text uses a darker shade of
// each colour so labels stay at 4.5:1 contrast or better on the light surface;
// bars and dots use the lighter fill.

// Severity: heat colour plus the word, never colour alone
const SEVERITY: Record<string, { fill: string; text: string; bars: number }> = {
  LOW: { fill: "#82977F", text: "#62755F", bars: 1 },
  MEDIUM: { fill: "#B58A4A", text: "#8A6938", bars: 2 },
  HIGH: { fill: "#D18B57", text: "#A05E2C", bars: 3 },
  CRITICAL: { fill: "#C45E59", text: "#BC4843", bars: 4 },
};

export function SeverityBadge({ value }: { value: string }) {
  const s = SEVERITY[value] ?? SEVERITY.LOW;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium" style={{ color: s.text }}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className="w-[3px] rounded-[1px]"
                style={{ height: 4 + b * 2.5, background: b <= s.bars ? s.fill : "#E1E6DC" }} />
        ))}
      </span>
      {humanize(value)}
    </span>
  );
}

const STATUS: Record<string, string> = {
  NEW: "#517296",
  TRIAGED: "#62745B",
  IN_PROGRESS: "#8A6938",
  CONTAINED: "#A05E2C",
  RESOLVED: "#59775F",
  CLOSED: "#687063",
};

export function StatusBadge({ value }: { value: string }) {
  const c = STATUS[value] ?? STATUS.CLOSED;
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[12px] font-medium"
          style={{ color: c, borderColor: `${c}40`, background: `${c}10` }}>
      {humanize(value)}
    </span>
  );
}

const SLA: Record<string, { color: string; label: string }> = {
  ON_TRACK: { color: "#64866B", label: "On track" },
  AT_RISK: { color: "#B58A4A", label: "At risk" },
  BREACHED: { color: "#C45E59", label: "Breached" },
  MET: { color: "#64866B", label: "Met" },
  NOT_APPLICABLE: { color: "#B8C2B1", label: "n/a" },
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
    <p role="status" className={`rounded-lg border px-3 py-2 text-[14px] ${
      msg.ok ? "border-good/40 bg-good/10 text-[#4B6650]" : "border-critical/40 bg-critical/10 text-[#A13E3A]"
    }`}>
      {msg.text}
    </p>
  );
}
