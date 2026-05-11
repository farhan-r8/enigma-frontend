export default function EnigmaGlassCard({
  children,
  className = '',
  as: Tag = 'section',
  accent = 'default',
}) {
  const accentClass =
    accent === 'cyan'
      ? 'border-cyan-400/20 shadow-cyan-950/20'
      : accent === 'fuchsia'
        ? 'border-fuchsia-400/20 shadow-fuchsia-950/20'
        : accent === 'emerald'
          ? 'border-emerald-400/20 shadow-emerald-950/20'
          : 'border-white/10 shadow-black/20';

  return (
    <Tag
      className={`rounded-[28px] border bg-white/5 p-6 shadow-2xl backdrop-blur-2xl lg:p-8 ${accentClass} ${className}`}
    >
      {children}
    </Tag>
  );
}
