/** Decorative line-art sprig. Purely visual. */
export function Botanical({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden className={className}>
      <path d="M40 190 C 80 140, 110 90, 170 20" />
      <path d="M75 145 C 55 130, 45 110, 48 88 C 68 98, 80 118, 75 145 Z" />
      <path d="M92 120 C 112 112, 128 96, 132 74 C 110 78, 95 96, 92 120 Z" />
      <path d="M108 98 C 92 82, 88 62, 96 42 C 112 56, 116 78, 108 98 Z" />
      <path d="M128 72 C 146 68, 160 56, 166 38 C 146 40, 132 52, 128 72 Z" />
      <path d="M58 168 C 76 166, 92 156, 100 140 C 80 140, 64 150, 58 168 Z" />
    </svg>
  );
}
