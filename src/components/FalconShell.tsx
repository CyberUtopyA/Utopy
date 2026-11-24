import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Activity, Compass, Home, MapPinned, Plus, Search, ShoppingBag, UserRound } from "lucide-react";
import FalconDock from "./FalconDock";
import LiveSearchOverlay from "./LiveSearchOverlay";
import LivingProfileQuickView from "./LivingProfileQuickView";
import LivingNodePanel from "./LivingNodePanel";
import GlobalConversationsModal from "./GlobalConversationsModal";
import { acquireLiveSymbiosis } from "../utopy/liveSymbiosis.singleton";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { getFalconSection } from "../utils/falconsection";
import { productPathFor } from "../mt/productRoute";
import { projectRentalProperties } from "../mt/rental.domain";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { profileHandleForIdentity } from "../mt/productRoute";
import { projectLiveProfiles } from "../social/liveProfile";
import "./falconUnifiedShell.css";

export default function FalconShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDVs, setSearchDVs] = useState<any[]>([]);
  const [profileQuickOpen, setProfileQuickOpen] = useState(false);
  const [profileIdentity, setProfileIdentity] = useState<any>(null);
  const [profileAvatar, setProfileAvatar] = useState("");
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [liveDVs, setLiveDVs] = useState<any[]>(() => mtLiveSnapshot() as any[]);

  useEffect(() => acquireLiveSymbiosis(), []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    void resolveCurrentIdentityContext({ allLive: mtLiveSnapshot() as any[] }).then((identity) => {
      if (!active) return;
      setProfileIdentity(identity);
      const updateAvatar = (live: any[]) => {
        setLiveDVs(live);
        const profile = projectLiveProfiles(live).find((item) => item.actorId === identity.actorId);
        setProfileAvatar(profile?.avatar || "");
      };
      updateAvatar(mtLiveSnapshot() as any[]);
      unsubscribe = mtLiveSubscribe(updateAvatar);
    }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);

  const section = useMemo(() => {
    if (location.pathname.includes("/daily")) return getFalconSection("daily");
    if (location.pathname.includes("/capital")) return getFalconSection("capital");
    if (location.pathname.includes("/skylines") || location.pathname.includes("/propiedad/")) return getFalconSection("skylines");
    return getFalconSection("store");
  }, [location.pathname]);

  const openLivingProfile = async () => {
    const live = mtLiveSnapshot() as any[];
    const identity = await resolveCurrentIdentityContext({ allLive: live }).catch(() => null);
    setSearchDVs(live);
    setProfileIdentity(identity);
    setProfileQuickOpen(true);
  };

  const openSearch = () => {
    setSearchDVs(mtLiveSnapshot() as any[]);
    setSearchOpen(true);
  };

  const goHome = () => {
    navigate("/market?tab=mercado", { state: { restoreScrollY: 0 } });
  };
  const activeSection = section.key;
  const contextLinks = [
    { key: "store", label: "Store", to: "/falcon/store" },
    { key: "daily", label: "Daily", to: "/falcon/daily" },
    { key: "skylines", label: "Skylines", to: "/falcon/skylines" },
    { key: "capital", label: "Capital", to: "/falcon/capital" },
  ];

  return (
    <div className="fum-shell">
      <header className="fum-header">
        <div className="fum-header-inner">
          <button type="button" className="fum-brand" onClick={goHome} aria-label="Volver al inicio de MS Market"><span className="fum-orbit" aria-hidden="true"/><span><b>MS MARKET</b><small>UTOPÝ</small></span></button>
          <nav className="fum-desktop-nav" aria-label="Navegación principal">
            <button type="button" onClick={goHome}>Inicio</button>
            <button type="button" onClick={() => navigate("/market?tab=categorias")}>Explorar</button>
            <button type="button" onClick={() => navigate("/market/mapa?view=publicar")}>Crear</button>
            <button type="button" onClick={() => navigate("/market?tab=mis_pedidos")}>Actividad</button>
          </nav>
          <button type="button" className="fum-search-pill" onClick={openSearch}><Search size={17}/><span>Buscar productos, tiendas o servicios</span></button>
          <div className="fum-header-actions">
            <button type="button" onClick={() => navigate("/market/mapa")} aria-label="Mapa vivo"><MapPinned /></button>
            <button type="button" onClick={() => navigate("/market?tab=mis_pedidos")} aria-label="Pedidos"><ShoppingBag /></button>
            <button type="button" onClick={openLivingProfile} aria-label="Perfil Vivo">{profileAvatar ? <img src={profileAvatar} alt=""/> : <UserRound />}</button>
          </div>
        </div>
        <div className="fum-context-row"><span>Explorando</span>{contextLinks.map((context) => <button key={context.key} type="button" className={activeSection === context.key ? "is-active" : ""} onClick={() => navigate(context.to)}>{context.label}</button>)}</div>
      </header>

      <main className="fum-main"><Outlet /></main>
      <nav className="fum-bottom-nav" aria-label="Navegación principal">
        <button type="button" onClick={goHome}><Home/><span>Inicio</span></button>
        <button type="button" onClick={() => navigate("/market?tab=categorias")}><Compass/><span>Explorar</span></button>
        <button type="button" className="fum-create" onClick={() => navigate("/market/mapa?view=publicar")}><Plus/><span>Crear</span></button>
        <button type="button" onClick={() => navigate("/market?tab=mis_pedidos")}><Activity/><span>Actividad</span></button>
        <button type="button" onClick={openLivingProfile}><UserRound/><span>Perfil</span></button>
      </nav>
      <div className="hidden" aria-hidden="true"><FalconDock /></div>

      <LivingProfileQuickView
        open={profileQuickOpen}
        allLive={liveDVs}
        activeActor={profileIdentity}
        target={profileIdentity}
        own
        onClose={() => setProfileQuickOpen(false)}
        onSay={() => { setProfileQuickOpen(false); navigate("/market/mapa?view=publicar"); }}
        onEdit={() => { setProfileQuickOpen(false); navigate("/market?tab=circular&view=red&quick=profile"); }}
        onConversations={() => { setProfileQuickOpen(false); setConversationsOpen(true); }}
        onMap={() => { setProfileQuickOpen(false); navigate(`/market?tab=circular&view=mapa&focus=${encodeURIComponent(String(profileIdentity?.actorId || profileIdentity?.nodeId || ""))}`); }}
        onFull={() => { const handle = profileHandleForIdentity(profileIdentity || {}, profileIdentity?.displayName || "mi-perfil"); setProfileQuickOpen(false); navigate(`/${handle}`, { state: { returnTo: `${location.pathname}${location.search}${location.hash}`, scrollY: window.scrollY } }); }}
      />
      {panelOpen ? <LivingNodePanel open allLive={liveDVs} activeActor={profileIdentity} onClose={() => setPanelOpen(false)} /> : null}
      {conversationsOpen ? <GlobalConversationsModal open onClose={() => setConversationsOpen(false)} from="falcon" returnTo={`${location.pathname}${location.search}${location.hash}`} onOpenProfile={openLivingProfile} /> : null}
      <LiveSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        allLive={searchDVs}
        surface={`falcon.${section.key}` as any}
        onSearchNetwork={(query) => navigate(`/market?search=${encodeURIComponent(query)}`)}
        onSelect={(dv, kind) => {
          const id = encodeURIComponent(String(dv?.id || ""));
          if (kind === "profile") navigate(`/${dv?.attrs?.handle}`);
          else if (kind === "product") navigate(productPathFor(dv, searchDVs));
          else if (kind === "property") {
            const propertyId = String(dv?.attrs?.propertyId || dv?.id || "");
            const properties = projectRentalProperties(searchDVs);
            const property = properties.find((item) => String(item.id) === propertyId || item.rooms?.some?.((room: any) => String(room.id) === String(dv?.attrs?.unitId || dv?.id)));
            if (property) navigate(`/falcon/skylines/propiedad/${encodeURIComponent(property.id)}`);
            else navigate(`/falcon/skylines?property=${encodeURIComponent(propertyId)}`);
          }
          else navigate(`/market?tab=circular&view=mapa&focus=${id}&returnTo=${encodeURIComponent(location.pathname + location.search)}`);
        }}
      />
    </div>
  );
}
