// Threat posture levels, shared by the sidebar indicator and the dashboard readout
export type Posture = {
  score: number;
  level: "GUARDED" | "ELEVATED" | "HIGH" | "SEVERE";
  level_rank: number;
  open_incidents: number;
  open_critical: number;
  open_breached: number;
};

export const POSTURE_LEVELS = [
  { level: "GUARDED", label: "Guarded", color: "#8fa18a", text: "Routine activity. No critical incidents open." },
  { level: "ELEVATED", label: "Elevated", color: "#b99a64", text: "Several incidents in progress. Watch the queue." },
  { level: "HIGH", label: "High", color: "#d18b57", text: "A critical incident or SLA breaches need attention." },
  { level: "SEVERE", label: "Severe", color: "#cf6f68", text: "Multiple critical incidents. All hands on the queue." },
] as const;

export function postureInfo(level: string) {
  return POSTURE_LEVELS.find((p) => p.level === level) ?? POSTURE_LEVELS[0];
}
