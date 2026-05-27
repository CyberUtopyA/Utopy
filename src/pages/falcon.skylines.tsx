import { useEffect, useState } from "react";
import SearchBar from "../components/search";
import CategoryPills from "../components/CategoryPills";
import SectionHero from "../components/sectionhero";
import { getFalconSection } from "../utils/falconsection";
import MapComponent from "../components/Mapcomponent";
import RealEstateForm from "../components/formulario";

type FiltersState = {
  type?: string;
  rooms?: string | number;
  transaction_fee?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  operation?: string;
  [key: string]: any;
};

type FavoriteItem = {
  id?: string | number;
  title?: string;
  name?: string;
  price?: number | string;
  city?: string;
  zone?: string;
  image?: string;
  description?: string;
};

function readFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];

  const keys = [
    "skylines:favorites",
    "falcon:skylines:favorites",
    "favorites",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // noop
    }
  }

  return [];
}

function formatGs(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "Consultar";
  return new Intl.NumberFormat("es-PY").format(n) + " Gs.";
}

function FavoritesSheet({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: FavoriteItem[];
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/20 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.26em] text-cyan-600">
              Falcon Skylines
            </div>
            <h3 className="text-xl font-black text-slate-950">Favoritos</h3>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {!items.length ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              Aún no tenés favoritos guardados.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm"
                >
                  <div className="aspect-[1.2/1] bg-slate-100">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title || item.name || "Favorito"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-sm font-semibold text-slate-400">
                        Sin imagen
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 p-4">
                    <div className="text-base font-black text-slate-950">
                      {item.title || item.name || "Propiedad"}
                    </div>

                    <div className="text-sm text-slate-600">
                      {[item.city, item.zone].filter(Boolean).join(" · ") || "Skylines"}
                    </div>

                    <div className="text-lg font-black text-slate-950">
                      {formatGs(item.price)}
                    </div>

                    {item.description ? (
                      <div className="line-clamp-2 text-sm text-slate-600">
                        {item.description}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FalconSkylinesPage() {
  const section = getFalconSection("skylines");
  const [filters, setFilters] = useState<FiltersState>({});
  const [passOpen, setPassOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const refresh = () => setFavorites(readFavorites());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  return (
    <div className="space-y-5">
      <SectionHero
        eyebrow="Falcon Skylines"
        title="Propiedades, alquileres y aterrizaje inteligente en Paraguay"
        description="Skylines concentra alquiler, compra, venta y onboarding con una lectura más limpia, más ligera y más útil."
      />

      <CategoryPills section={section} />

      {/* MOBILE CONTROLS */}
      <section className="mx-auto max-w-7xl lg:hidden">
        <div className="rounded-[26px] border border-slate-200/80 bg-white/85 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-600">
                Falcon Skylines
              </div>
              <h2 className="text-lg font-black text-slate-950">
                Buscar alquiler, compra o inversión
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Menos ruido, más foco territorial.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPassOpen(true)}
                className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-900 transition hover:bg-cyan-100"
              >
                Skylines Pass
              </button>

              <button
                onClick={() => setFavoritesOpen(true)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-50"
              >
                Favoritos
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">
                  {favorites.length}
                </span>
              </button>

              <button
                onClick={() => setShowFilters((v) => !v)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-50"
              >
                {showFilters ? "Ocultar filtros" : "Filtros"}
              </button>
            </div>

            {showFilters ? (
              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-3">
                <SearchBar setFilters={setFilters} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white/70 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          {/* DESKTOP OVERLAY CONTROLS */}
          <div className="absolute left-1/2 top-4 z-[1005] hidden w-[min(95%,980px)] -translate-x-1/2 lg:block">
            <div className="rounded-[28px] border border-white/70 bg-white/82 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
              <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-600">
                    Falcon Skylines
                  </div>
                  <h2 className="text-lg font-black text-slate-950 xl:text-xl">
                    Buscar alquiler, compra o inversión
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Menos ruido, más foco territorial.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPassOpen(true)}
                    className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-900 transition hover:bg-cyan-100"
                  >
                    Skylines Pass
                  </button>

                  <button
                    onClick={() => setFavoritesOpen(true)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-50"
                  >
                    Favoritos
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-700">
                      {favorites.length}
                    </span>
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-3">
                <SearchBar setFilters={setFilters} />
              </div>
            </div>
          </div>

          <MapComponent filters={filters} onCloseMap={() => {}} />
        </div>
      </section>

      <RealEstateForm isVisible={passOpen} onClose={() => setPassOpen(false)} />

      <FavoritesSheet
        open={favoritesOpen}
        items={favorites}
        onClose={() => setFavoritesOpen(false)}
      />
    </div>
  );
}