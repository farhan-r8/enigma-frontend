export default function EnigmaHero({ eyebrow, title, description, actions, className = '' }) {
  return (
    <section
      className={`rounded-[28px] border border-cyan-400/20 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl lg:p-8 ${className}`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-cyan-300">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-300">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
