import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { MessageCircle, Plus, Search, UserRound, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { isThreadDV, resolveDvThreadId } from "../mt/mt.threadProtocol";
import { projectLiveProfiles, resolveLivingIdentity } from "../social/liveProfile";
import { resolveLivingNode } from "../utopy/livingNodeProjection";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { livingGlass, LivingModalBackdrop } from "../pages/circularModal";

type Props = {
  open: boolean;
  onClose: () => void;
  from: "market" | "mapa" | "falcon";
  returnTo?: string;
  onOpenProfile?: () => void;
};

const value = (item: unknown) => String(item || "").trim();
const unique = (items: unknown[]) => [...new Set(items.map(value).filter(Boolean))];

export default function GlobalConversationsModal({ open, onClose, from, returnTo, onOpenProfile }: Props) {
  const navigate = useNavigate();
  const [allLive, setAllLive] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  const [identity, setIdentity] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setAllLive(mtLiveSnapshot() as any[]);
    return mtLiveSubscribe((items) => setAllLive(items || []));
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let mounted = true;
    void resolveCurrentIdentityContext({ allLive }).then((next) => { if (mounted) setIdentity(next); }).catch(() => { if (mounted) setIdentity(null); });
    return () => { mounted = false; };
  }, [open, allLive]);
  useEffect(() => {
    if (!open) { setSearching(false); setQuery(""); return; }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { if (searching) setSearching(false); else onClose(); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, searching, onClose]);

  const viewerId = value(identity?.actorId);
  const viewerNodeId = value(identity?.actingAsNodeId || identity?.nodeId);
  const viewerIds = useMemo(() => unique([viewerId, viewerNodeId, identity?.cajeroId]), [viewerId, viewerNodeId, identity?.cajeroId]);
  const profiles = useMemo(() => projectLiveProfiles(allLive), [allLive]);
  const threads = useMemo(() => {
    if (!viewerIds.length) return [];
    const groups = new Map<string, any[]>();
    for (const dv of allLive) {
      const threadId = resolveDvThreadId(dv, allLive);
      if (!threadId || !isThreadDV({ ...dv, attrs: { ...(dv?.attrs || {}), threadId } })) continue;
      const attrs = dv.attrs || {};
      const parties = unique([...(Array.isArray(attrs.participants) ? attrs.participants : []), attrs.fromActorId, attrs.toActorId, attrs.buyerActorId, attrs.buyerId, attrs.sellerId, attrs.cajeroId]);
      if (!parties.some((party) => viewerIds.includes(party))) continue;
      groups.set(threadId, [...(groups.get(threadId) || []), dv]);
    }
    return [...groups.entries()].map(([threadId, items]) => {
      const sorted = [...items].sort((a, b) => Date.parse(value(a?.meta?.ts || a?.meta?.updatedAt)) - Date.parse(value(b?.meta?.ts || b?.meta?.updatedAt)));
      const last = sorted[sorted.length - 1];
      const attrs = last?.attrs || {};
      const parties = unique(sorted.flatMap((dv) => [
        ...(Array.isArray(dv?.attrs?.participants) ? dv.attrs.participants : []),
        dv?.attrs?.fromActorId, dv?.attrs?.toActorId, dv?.attrs?.buyerActorId, dv?.attrs?.buyerId, dv?.attrs?.sellerId,
      ]));
      const otherId = parties.find((party) => !viewerIds.includes(party)) || "";
      const profile = resolveLivingIdentity(otherId, allLive);
      const name = value(profile.name || "Persona");
      const unread = sorted.some((dv) => Array.isArray(dv?.attrs?.unreadBy) && dv.attrs.unreadBy.some((id: unknown) => viewerIds.includes(value(id))));
      return { threadId, otherId, name, avatar: value(profile?.avatar), unread, lastAt: Date.parse(value(last?.meta?.ts || last?.meta?.updatedAt)) || 0, parties };
    }).sort((a, b) => b.lastAt - a.lastAt).slice(0, 40);
  }, [allLive, profiles, viewerIds]);
  const contacts = useMemo(() => profiles.filter((profile) => {
    const id = value(profile.nodeId || profile.actorId || profile.id);
    if (!id || viewerIds.includes(id)) return false;
    const needle = query.trim().toLocaleLowerCase();
    return !needle || `${profile.name} ${profile.handle}`.toLocaleLowerCase().includes(needle);
  }).slice(0, 24), [profiles, viewerIds, query]);

  if (!open) return null;
  const openThread = (threadId: string, targetId = "", name = "") => {
    onClose();
    const params = new URLSearchParams({ from });
    if (returnTo) params.set("returnTo", returnTo);
    if (targetId) params.set("to", targetId);
    if (name) params.set("name", name);
    navigate(`/conversacion/${encodeURIComponent(threadId)}?${params.toString()}`);
  };
  const chooseContact = (profile: any) => {
    if (!viewerId) return;
    const targetId = value(profile.actorId || profile.nodeId || profile.id);
    const existing = threads.find((thread) => thread.parties.some((party) => {
      if (party === targetId || party === profile.actorId || party === profile.handle) return true;
      const node = resolveLivingNode(party, allLive);
      return Boolean(node && profile.nodeId && node.nodeId === profile.nodeId);
    }));
    const pair = [viewerId, targetId].sort().map(encodeURIComponent).join(":");
    openThread(existing?.threadId || `conversation:${pair}`, targetId, value(profile.name));
  };

  return <Overlay role="presentation">
    <LivingModalBackdrop $level={0} onClick={onClose} aria-hidden="true" />
    <Dialog role="dialog" aria-label="Conversaciones" aria-modal="true">
      <Head><b><MessageCircle size={18} /> Conversaciones</b><button type="button" aria-label="Cerrar" onClick={onClose}><X size={18} /></button></Head>
      {!searching ? <>
        <AvatarRail aria-label="Tus conversaciones">
          {threads.length ? threads.map((thread) => <AvatarButton type="button" key={thread.threadId} onClick={() => openThread(thread.threadId)}>
            <Photo><span>{thread.name.charAt(0).toUpperCase()}</span>{thread.avatar ? <img src={thread.avatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}{thread.unread ? <i /> : null}</Photo>
            <small>{thread.name}</small>
          </AvatarButton>) : <Empty>Todavía no hay conversaciones.</Empty>}
        </AvatarRail>
        <Primary type="button" onClick={() => setSearching(true)}><Plus size={17} /> Nueva conversación</Primary>
        {onOpenProfile ? <Secondary type="button" onClick={() => { onClose(); onOpenProfile(); }}><UserRound size={16} /> Abrir Perfil Vivo</Secondary> : null}
      </> : <>
        <SearchBox><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Con quién querés hablar?" aria-label="Buscar persona o nodo" /></SearchBox>
        <ContactList>{contacts.map((profile) => <Contact type="button" key={profile.id} onClick={() => chooseContact(profile)}><Photo><span>{profile.name.charAt(0).toUpperCase()}</span>{profile.avatar ? <img src={profile.avatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</Photo><span>{profile.name}</span></Contact>)}{!contacts.length ? <Empty>No encontramos ese perfil.</Empty> : null}</ContactList>
        <Secondary type="button" onClick={() => setSearching(false)}>Volver</Secondary>
      </>}
    </Dialog>
  </Overlay>;
}

const Overlay = styled.div`position:fixed;inset:0;z-index:2000;display:grid;place-items:start center;`;
const Dialog = styled.div`
  ${livingGlass};position:relative;z-index:1;margin-top:max(82px, calc(env(safe-area-inset-top) + 64px));width:min(430px,calc(100vw - 24px));padding:18px;display:grid;gap:17px;
  @media(max-width:600px){align-self:end;margin:0 8px calc(8px + env(safe-area-inset-bottom));width:calc(100vw - 16px);max-height:80dvh;overflow:auto;border-radius:28px 28px 20px 20px}
`;
const Head = styled.div`display:flex;align-items:center;justify-content:space-between;gap:12px;b{display:flex;align-items:center;gap:9px;font-size:18px}button{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:999px;background:rgba(255,255,255,.75);cursor:pointer}`;
const AvatarRail = styled.div`display:flex;gap:14px;min-height:108px;overflow-x:auto;overscroll-behavior-inline:contain;padding:5px 2px 12px;scrollbar-width:thin;`;
const AvatarButton = styled.button`border:0;background:transparent;color:#344467;display:grid;justify-items:center;align-content:start;gap:8px;min-width:67px;max-width:76px;cursor:pointer;small{font-size:11px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:74px}`;
const Photo = styled.span`position:relative;flex:0 0 auto;width:56px;height:56px;display:grid;place-items:center;overflow:visible;border:3px solid white;border-radius:999px;background:linear-gradient(135deg,#adb7ff,#d9c7f2);box-shadow:0 7px 19px rgba(91,101,175,.2);color:white;font-size:20px;font-weight:850;img{position:absolute;inset:0;width:100%;height:100%;border-radius:999px;object-fit:cover}i{position:absolute;right:1px;bottom:1px;width:10px;height:10px;background:#39b984;border:2px solid white;border-radius:999px;z-index:1}`;
const Primary = styled.button`border:1px solid rgba(255,255,255,.95);border-radius:18px;background:linear-gradient(135deg,#6f84ed,#9583e6);color:white;padding:13px 16px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:850;cursor:pointer;box-shadow:0 8px 22px rgba(90,102,190,.2)`;
const Secondary = styled.button`border:1px solid rgba(255,255,255,.9);border-radius:17px;background:rgba(255,255,255,.6);color:#4b5b98;padding:11px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:750;cursor:pointer`;
const SearchBox = styled.label`display:flex;align-items:center;gap:9px;border:1px solid white;border-radius:17px;background:rgba(255,255,255,.7);padding:12px;color:#5969ac;input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#263557;font:inherit}`;
const ContactList = styled.div`display:grid;gap:5px;max-height:45dvh;overflow:auto;`;
const Contact = styled.button`display:flex;align-items:center;gap:12px;border:0;border-radius:17px;padding:8px;background:transparent;text-align:left;color:#344467;font-weight:750;cursor:pointer;&:hover{background:rgba(255,255,255,.65)}${Photo}{width:42px;height:42px;font-size:16px}`;
const Empty = styled.div`color:#667391;font-size:13px;align-self:center;white-space:nowrap;`;
