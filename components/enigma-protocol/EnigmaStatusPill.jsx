export default function EnigmaStatusPill({ children, tone = 'neutral', className = '' }) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-200'
      : tone === 'emerald'
        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
        : tone === 'fuchsia'
          ? 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-200'
          : tone === 'amber'
            ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
            : tone === 'rose'
              ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
              : 'border-white/10 bg-white/5 text-slate-300';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.25em] ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}
