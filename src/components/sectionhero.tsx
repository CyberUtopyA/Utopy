type Props = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function SectionHero({ eyebrow, title, description }: Props) {
  return (
    <section className="mx-auto w-full max-w-7xl">
      <div className="relative overflow-hidden rounded-[34px] border border-cyan-300/20 bg-slate-950 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:px-9 md:py-10">
        {/* Fondo vivo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
          <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_35%,rgba(34,211,238,0.08))]" />
        </div>

        {/* Grid sutil */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:38px_38px]" />

        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.12)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
            {eyebrow}
          </div>

          <h1 className="max-w-5xl text-3xl font-black leading-[0.98] tracking-[-0.055em] text-white md:text-5xl lg:text-6xl">
            {title}
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-200/85 md:text-base">
            {description}
          </p>

        </div>
      </div>
    </section>
  );
}