import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type FalconCategory = {
  id: string;
  label?: string;
  title?: string;
};

type FalconSection = {
  slug?: string;
  categories: FalconCategory[];
};

export default function CategoryPills({ section }: { section: FalconSection }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const active = params.get("cat") || section.categories?.[0]?.id || "";

  function goTo(catId: string) {
    const next = new URLSearchParams(params);
    next.set("cat", catId);
    navigate(`?${next.toString()}`);
  }

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-wrap gap-3">
        {section.categories.map((cat) => {
          const label = cat.label || cat.title || cat.id;
          const isActive = active === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => goTo(cat.id)}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200",
                "border shadow-sm",
                isActive
                  ? "border-cyan-300 bg-cyan-100 text-cyan-900 shadow-[0_10px_24px_rgba(34,211,238,0.18)]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-900",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}