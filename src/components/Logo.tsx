// Radar sweep mark: three range rings and a sweep line
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="#26405f" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#26405f" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="4.5" fill="none" stroke="#26405f" strokeWidth="1.5" />
      <path d="M16 16 L16 1.5 A14.5 14.5 0 0 1 29.2 10 Z" fill="#59b2ff" opacity="0.28" />
      <line x1="16" y1="16" x2="29.2" y2="10" stroke="#59b2ff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="23" cy="9.5" r="1.8" fill="#f0803c" />
      <circle cx="16" cy="16" r="1.6" fill="#dce6f2" />
    </svg>
  );
}
