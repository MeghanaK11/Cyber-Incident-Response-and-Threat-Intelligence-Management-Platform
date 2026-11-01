import { humanize } from "@/lib/client";

const SEVERITY: Record<string, string> = {
  LOW: "bg-sev-1/15 text-sev-4",
  MEDIUM: "bg-sev-2/15 text-sev-4",
  HIGH: "bg-serious/12 text-[#a8431c]",
  CRITICAL: "bg-critical text-white",
};

export function SeverityBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[12px] font-semibold tracking-wide ${SEVERITY[value] ?? ""}`}>
      {value}
    </span>
  );
}

const STATUS: Record<string, string> = {
  NEW: "border-accent/40 text-accent-dark",
  TRIAGED: "border-sev-2/50 text-sev-4",
  IN_PROGRESS: "border-warn/70 text-[#8a5d00]",
  CONTAINED: "border-serious/50 text-[#a8431c]",
  RESOLVED: "border-good/50 text-[#087008]",
  CLOSED: "border-line text-ink-3",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium ${STATUS[value] ?? ""}`}>
      {humanize(value)}
    </span>
  );
}

// SLA state always carries a text label next to its dot, never colour alone
const SLA: Record<string, { dot: string; label: string }> = {
  ON_TRACK: { dot: "bg-good", label: "On track" },
  AT_RISK: { dot: "bg-warn", label: "At risk" },
  BREACHED: { dot: "bg-critical", label: "Breached" },
  MET: { dot: "bg-good", label: "Met" },
  NOT_APPLICABLE: { dot: "bg-line", label: "n/a" },
};

export function SlaBadge({ value }: { value: string }) {
  const s = SLA[value] ?? SLA.NOT_APPLICABLE;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}
