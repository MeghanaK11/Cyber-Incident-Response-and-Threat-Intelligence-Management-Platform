// Similarity from pgvector cosine distance, shown as a bar and a percentage
export function MatchBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="flex items-center gap-2" title={`Cosine similarity ${value.toFixed(3)}`}>
      <span className="h-1.5 w-16 rounded-full bg-line">
        <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[12px] tabular-nums text-ink-2">{pct}%</span>
    </span>
  );
}
