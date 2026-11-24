import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { ArrowLeft, Send } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import TradeInboxPanel from "../mt/tradeinboxPanel";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { buildThreadActionDV, isThreadDV, resolveDvThreadId } from "../mt/mt.threadProtocol";
import { resolveLivingIdentity } from "../social/liveProfile";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { acquireLiveSymbiosis } from "../utopy/liveSymbiosis.singleton";
import ConversationReferences, { uploadConversationReferences } from "../components/ConversationReferences";

const value = (item: unknown) => String(item || "").trim();

export default function ConversationView() {
  const { threadId: routeThreadId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [allLive, setAllLive] = useState<any[]>(() => mtLiveSnapshot() as any[]);
  const [identity, setIdentity] = useState<any>(null);
  const [draft, setDraft] = useState("");
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const threadId = value(routeThreadId);
  const from = value(params.get("from"));
  const returnTo = value(params.get("returnTo"));

  useEffect(() => acquireLiveSymbiosis(), []);
  useEffect(() => mtLiveSubscribe((items) => setAllLive(items || [])), []);
  useEffect(() => {
    let mounted = true;
    void resolveCurrentIdentityContext({ allLive }).then((next) => { if (mounted) setIdentity(next); }).catch(() => { if (mounted) setIdentity(null); });
    return () => { mounted = false; };
  }, [allLive]);

  const threadItems = useMemo(() => allLive.filter((dv) => {
    const resolved = resolveDvThreadId(dv, allLive);
    return resolved === threadId && isThreadDV({ ...dv, attrs: { ...(dv?.attrs || {}), threadId: resolved } });
  }), [allLive, threadId]);
  const viewerId = value(identity?.actorId);
  const discoveredTargetId = useMemo(() => {
    const parties = [...new Set(threadItems.flatMap((dv) => [
      ...(Array.isArray(dv?.attrs?.participants) ? dv.attrs.participants : []),
      dv?.attrs?.fromActorId, dv?.attrs?.toActorId, dv?.attrs?.sellerId,
    ]).map(value).filter(Boolean))];
    return parties.find((id) => id !== viewerId && id !== value(identity?.actingAsNodeId)) || "";
  }, [threadItems, viewerId, identity?.actingAsNodeId]);
  const targetId = value(params.get("to")) || discoveredTargetId;
  const profile = useMemo(() => resolveLivingIdentity(targetId, allLive), [allLive, targetId]);
  const lastThreadItem = threadItems[threadItems.length - 1];
  const name = value(profile.name || "Persona");
  const avatar = value(profile?.avatar);
  const back = () => navigate(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : from === "mapa" ? "/market/mapa" : from === "falcon" ? "/falcon/store" : "/market");

  const sendFirstMessage = async () => {
    const text = draft.trim() || (referenceFiles.length ? "Te comparto estas referencias para el diseño." : "");
    if (!text || !viewerId || !targetId || sending) return;
    setSending(true);
    setError("");
    try {
      const attachments = await uploadConversationReferences(referenceFiles);
      const dv = buildThreadActionDV({
        kind: "trade.message", threadId, chainId: threadId, text,
        fromActorId: viewerId, fromActorName: value(identity?.displayName || "Persona"),
        toActorId: targetId, toActorName: name, participants: [viewerId, targetId],
        attrs: { attachments },
        traits: ["mt:chat", "mt:notify.cajero"],
        meta: { source: "ms:web:trade:inbox" },
      });
      if (!dv.id || !dv.kind) throw Error("No pudimos preparar el mensaje.");
      await publishAuthorizedDV({ dv: { ...dv, id: dv.id, kind: dv.kind }, allLive, action: dv.kind, targetNodeId: targetId.startsWith("utopy.node.") ? targetId : null });
      setDraft("");
      setReferenceFiles([]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No pudimos enviar el mensaje. Probá otra vez.");
    } finally { setSending(false); }
  };

  return <Screen>
    <ChatShell>
      <ChatHead><button type="button" onClick={back} aria-label="Volver"><ArrowLeft /></button><Photo><span>{name.charAt(0).toUpperCase()}</span>{avatar ? <img src={avatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</Photo><strong>{name}</strong></ChatHead>
      <ChatBody>{threadItems.length ? <TradeInboxPanel key={threadId} initialThreadId={threadId} focusThreadOnly mode="all" simple fullScreen /> : <NewThread>
        <Empty>Escribí para empezar la conversación.</Empty>
        <ConversationReferences files={referenceFiles} onChange={setReferenceFiles} disabled={sending}/>
        <FirstComposer><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribir mensaje" aria-label="Mensaje" /><button type="button" onClick={sendFirstMessage} disabled={(!draft.trim() && !referenceFiles.length) || !viewerId || !targetId || sending} aria-label="Enviar mensaje"><Send /></button></FirstComposer>
        {error ? <small role="alert">{error}</small> : null}
      </NewThread>}</ChatBody>
    </ChatShell>
  </Screen>;
}

const Screen = styled.div`position:fixed;inset:0;z-index:1500;background:linear-gradient(135deg,#f9fbff,#eeeaff 72%,#edf7ff);display:grid;place-items:center;padding:18px;@media(max-width:650px){padding:0}`;
const ChatShell = styled.div`width:min(720px,100%);height:min(880px,100%);min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid white;border-radius:30px;background:rgba(255,255,255,.82);box-shadow:0 20px 65px rgba(72,82,153,.17);backdrop-filter:blur(22px);@media(max-width:650px){width:100%;height:100%;border:0;border-radius:0}`;
const ChatHead = styled.header`display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(99,111,184,.12);background:rgba(255,255,255,.7);color:#253554;button{width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:999px;background:rgba(232,236,255,.8);color:#4c5ba2;cursor:pointer}button svg{width:19px}strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;
const Photo = styled.span`position:relative;width:43px;height:43px;display:grid;place-items:center;overflow:hidden;flex:0 0 auto;border-radius:999px;background:linear-gradient(135deg,#a7b2f8,#dec8f3);color:white;font-weight:850;img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}`;
const ChatBody = styled.div`min-height:0;overflow:auto;padding:8px;@media(max-width:650px){padding-bottom:calc(8px + env(safe-area-inset-bottom))}`;
const NewThread = styled.div`height:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:12px;padding:14px;small{color:#a43f5a}`;
const Empty = styled.p`margin:auto;color:#70809a;text-align:center;font-size:14px`;
const FirstComposer = styled.div`display:flex;align-items:flex-end;gap:9px;padding:10px;border:1px solid white;border-radius:23px;background:rgba(255,255,255,.88);box-shadow:0 7px 21px rgba(69,82,149,.08);textarea{flex:1;min-width:0;min-height:44px;max-height:140px;resize:vertical;border:0;outline:0;background:transparent;font:inherit;padding:9px;color:#243453}button{width:44px;height:44px;display:grid;place-items:center;flex:0 0 auto;border:0;border-radius:16px;background:#7787e7;color:white;cursor:pointer}button:disabled{opacity:.5;cursor:default}button svg{width:19px}`;
