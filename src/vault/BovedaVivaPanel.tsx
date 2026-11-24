import React, { lazy, Suspense, useMemo, useState } from "react";
const LivingEconomyPanel=lazy(()=>import('../economy/LivingEconomyPanel'));
import styled from "styled-components";
import {
  BadgeCheck,
  Check,
  CircleHelp,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlink,
} from "lucide-react";
import { buildValueRedemptionRequestDV } from "./vault.builders";
import { canRedeemRight } from "./vault.engine";
import { publishVaultDV } from "./vault.publish";
import { useLoyaltyPassports } from "../loyalty/useLoyaltyPassports";
import { projectLiquidityNetworkCached } from "../value/liquidityNetwork.cache";
import {
  buildIdentityLinkRequestDV,
  buildIdentityLinkRevokeRequestDV,
  publishIdentityLinkActorDV,
} from "../utopy/identityLink";
import {
  manifestCapabilities,
  manifestNodeId,
  useVerifiedNodeManifests,
} from "../utopy/useVerifiedNodeManifests";
import { useVerifiedAuthorizedDVs } from "../utopy/useVerifiedAuthorizedDVs";

const VAULT_AUTHORITY_KINDS = [
  "benefit.program",
  "benefit.acceptance",
  "value.stamp",
  "value.right",
  "value.redemption",
  "value.redemption.request",
  "value.redemption.outcome",
  "identity.link.request",
  "identity.link.challenge",
  "identity.link.proof",
  "identity.link.accepted",
  "identity.link.active",
  "identity.link.revoke.request",
  "identity.link.revoked",
] as const;

type Props = {
  allLive: any[];
  actor: { id: string; name?: string | null; nodeId?: string | null };
};

function eventLabel(dv: any) {
  const kind = String(dv?.kind || "");
  if (kind === "pay.receipt") return "Pago comprobado";
  if (kind === "liq.trust" || kind === "liq.trust.signal") return "Confianza registrada";
  if (kind === "value.stamp") return "Sello verificado";
  if (kind === "value.right") return "Beneficio creado";
  if (kind === "value.redemption.request") return "Uso solicitado";
  if (kind === "value.redemption.outcome") return "Uso confirmado por el nodo";
  if (kind === "value.redemption") return "Uso histórico";
  if (kind === "refund.right") return "Protección de reintegro";
  if (kind.includes("lock") || kind.includes("escrow")) return "Valor protegido";
  return "Actividad confirmada";
}

function eventTime(dv: any) {
  const raw = dv?.meta?.ts || dv?.attrs?.closedAt || dv?.attrs?.issuedAt || dv?.attrs?.settledAt;
  if (!raw) return "";
  try {
    return new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "short" }).format(new Date(raw));
  } catch {
    return "";
  }
}

export default function BovedaVivaPanel({ allLive, actor }: Props) {
  const [notice, setNotice] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [space, setSpace] = useState<"economy" | "overview" | "relations" | "rights" | "activity">("economy");
  const verifiedVaultIds = useVerifiedAuthorizedDVs(allLive, VAULT_AUTHORITY_KINDS);
  const network = useMemo(
    () => projectLiquidityNetworkCached(allLive, actor.id, verifiedVaultIds),
    [allLive, actor.id, verifiedVaultIds],
  );
  const vault = network.vault;
  const { verifiedManifests } = useVerifiedNodeManifests(allLive);
  const loyalty = useLoyaltyPassports();
  const liquidityWays = [
    network.creditOperations.length > 0,
    network.settlementPlans.length > 0,
    network.identityLinks.some((link) => link.status === "active" && link.finance),
    network.activeOperations.some((dv) => /^(pay\.|payment\.|market\.order\.)/.test(String(dv?.kind || ""))),
  ].filter(Boolean).length;
  const hasBuiltSummary = Boolean(
    network.summary.outcomes || network.summary.contributions || network.summary.connections,
  );
  const hasAnyValue = Boolean(
    hasBuiltSummary || network.summary.rights || liquidityWays || network.summary.operations,
  );

  const connectableNodes = useMemo(
    () => verifiedManifests.filter((manifest) =>
      manifestCapabilities(manifest).some((capability) =>
        /identity\.link|identity\.customer\.link|customer\.relationship/.test(capability),
      ),
    ),
    [verifiedManifests],
  );

  const requestIdentityLink = async (manifest: any) => {
    const nodeId = manifestNodeId(manifest);
    const nodeName = String(manifest?.attrs?.nodeName || manifest?.attrs?.node?.name || nodeId);
    try {
      const request = buildIdentityLinkRequestDV({
        actorId: actor.id,
        actorName: actor.name,
        nodeId,
        nodeName,
      });
      await publishIdentityLinkActorDV({
        dv: request,
        allLive,
        activeActor: { id: actor.id, actorId: actor.id, name: actor.name },
        targetNodeId: nodeId,
      });
      setNotice(`Solicitud privada enviada a ${nodeName}. El nodo debe desafiarla y aceptarla.`);
    } catch (error: any) {
      setNotice(error?.message || "No se pudo solicitar la vinculación.");
    }
  };

  const requestUnlink = async (link: any) => {
    const activeEvent = [...(link.events || [])].reverse().find(
      (event: any) => event?.kind === "identity.link.active",
    );
    if (!activeEvent) return;
    try {
      await publishIdentityLinkActorDV({
        dv: buildIdentityLinkRevokeRequestDV({ link: activeEvent, actorId: actor.id }),
        allLive,
        activeActor: { id: actor.id, actorId: actor.id, name: actor.name },
        targetNodeId: link.nodeId,
      });
      setNotice("Solicitud de desvinculación enviada. El nodo conserva su historial propio, pero pierde el vínculo activo.");
    } catch (error: any) {
      setNotice(error?.message || "No se pudo solicitar la desvinculación.");
    }
  };

  const redeem = async (rightView: any) => {
    const acceptance = rightView.acceptedBy?.[0];
    if (!acceptance || !canRedeemRight(allLive, rightView.dv, acceptance, actor.id, verifiedVaultIds)) {
      setNotice("Este beneficio todavía no tiene un comercio compatible para usarlo.");
      return;
    }
    try {
      await publishVaultDV(
        buildValueRedemptionRequestDV({
          right: rightView.dv,
          acceptance,
          actorId: actor.id,
          actorName: actor.name || actor.id,
        }),
        {
          allLive,
          activeActor: { id: actor.id, actorId: actor.id, name: actor.name },
          targetNodeId: acceptance?.attrs?.nodeId || null,
        },
      );
      setNotice("Solicitud enviada. El beneficio se marcará usado solamente cuando el nodo lo confirme.");
    } catch (error: any) {
      setNotice(error?.message || "No se pudo solicitar el uso del beneficio.");
    }
  };

  return (
    <Shell>
      {space!=='economy' && <Hero>
        <div><strong>Tu actividad de valor</strong><p>Comprobantes, beneficios y vínculos.</p></div>
        <Help type="button" title="UTOPY no inventa sellos: consulta la tarjeta en el nodo que la emitió.">
          <CircleHelp size={18} />
        </Help>
      </Hero>}

      <ValueNav aria-label="Espacios de Mi Valor">
        <ValueNavButton type="button" $active={space === "economy"} onClick={() => setSpace("economy")}>Mi economía</ValueNavButton>
        <ValueNavButton type="button" $active={space === "overview"} onClick={() => setSpace("overview")}>✨ Resumen</ValueNavButton>
        <ValueNavButton type="button" $active={space === "relations"} onClick={() => setSpace("relations")}>🤝 Relaciones</ValueNavButton>
        <ValueNavButton type="button" $active={space === "rights"} onClick={() => setSpace("rights")}>🎟 Mis tarjetas y beneficios</ValueNavButton>
        <ValueNavButton type="button" $active={space === "activity"} onClick={() => setSpace("activity")}>◷ Actividad</ValueNavButton>
      </ValueNav>

      {notice ? <Notice>{notice}</Notice> : null}
      {space==='economy'?<Suspense fallback={<p role="status">Abriendo tu economía…</p>}><LivingEconomyPanel key={actor.id} allLive={allLive} actorId={actor.id} onMethods={()=>setSpace('rights')}/></Suspense>:null}

      {space === "rights" ? <CardGrid>
        {loyalty.cards.map(({ source, memberId, passport, loading, error }) => {
          const entered = codes[source.id] ?? memberId;
          const progress = passport ? Math.min(100, (passport.stamps / passport.required) * 100) : 0;
          return (
            <LoyaltyCard key={source.id} style={{ ["--node-accent" as any]: source.accent || "#1f7a3d" }}>
              <CardTop>
                <NodeEmoji>{source.emoji}</NodeEmoji>
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.description}</span>
                </div>
                {passport ? <LivePill>● EN VIVO</LivePill> : <LinkPill>Vincular</LinkPill>}
              </CardTop>

              {passport ? (
                <>
                  <ProgressBox>
                    <div>
                      <b>{passport.stamps} / {passport.required} sellos</b>
                      <span>
                        {passport.rewardsAvailable > 0
                          ? `🎉 ${passport.rewardsAvailable} beneficio disponible`
                          : `Faltan ${Math.max(0, passport.required - passport.stamps)} para el próximo beneficio`}
                      </span>
                    </div>
                    <Progress><i style={{ width: `${progress}%` }} /></Progress>
                    <StampRow>
                      {Array.from({ length: passport.required }, (_, index) => (
                        <Stamp key={index} $on={index < passport.stamps}>{index < passport.stamps ? source.emoji : index + 1}</Stamp>
                      ))}
                    </StampRow>
                  </ProgressBox>
                  <MemberLine>
                    <span>🔗 {passport.memberId}</span>
                    <div>
                      <MiniButton type="button" onClick={() => loyalty.refresh(source.id)} disabled={loading}>
                        <RefreshCw size={14} /> {loading ? "Leyendo…" : "Actualizar"}
                      </MiniButton>
                      <MiniButton type="button" onClick={() => loyalty.unlink(source.id)}>
                        <Unlink size={14} /> Quitar
                      </MiniButton>
                    </div>
                  </MemberLine>
                  {passport.history.length ? (
                    <LastMove>Último sello: {passport.history[0]?.label || passport.history[0]?.id}</LastMove>
                  ) : null}
                </>
              ) : (
                <LinkArea>
                  <label>
                    <span>🔑 Código de tu tarjeta</span>
                    <input
                      value={entered}
                      onChange={(event) => setCodes((current) => ({ ...current, [source.id]: event.target.value }))}
                      placeholder={source.memberPlaceholder}
                      autoCapitalize="characters"
                    />
                  </label>
                  <Primary
                    type="button"
                    disabled={loading || !entered.trim()}
                    onClick={() => loyalty.link(source.id, entered.trim())}
                  >
                    <Link2 size={16} /> {loading ? "Conectando…" : "Conectar tarjeta"}
                  </Primary>
                  {error ? <ErrorText>⚠️ {error}</ErrorText> : null}
                  <SmallText>El código queda en este dispositivo. No se publica en el Mapa Vivo.</SmallText>
                </LinkArea>
              )}
            </LoyaltyCard>
          );
        })}
      </CardGrid> : null}

      {space === "relations" ? <Section>
        <SectionHead>
          <div>
            <strong>Identidad vinculada por nodo</strong>
            <span>Cada vínculo es privado y revocable. Tu identidad no se duplica.</span>
          </div>
          <Link2 size={18} />
        </SectionHead>
        <CardList>
          {network.identityLinks.map((link) => (
            <RightCard key={link.relationshipId}>
              <div>
                <small>{link.status === "active" ? "Vínculo activo y comprobable" : "Consentimiento en curso"}</small>
                <strong>{link.nodeName}</strong>
                <span>
                  {link.status === "active"
                    ? [link.loyalty && "fidelidad", link.finance && "financiación", link.benefit && "beneficios"].filter(Boolean).join(" · ") || "Continuidad habilitada"
                    : `Estado: ${link.status}`}
                </span>
              </div>
              {link.status === "active" ? (
                <MiniButton type="button" onClick={() => void requestUnlink(link)}>
                  <Unlink size={14} /> Desvincular
                </MiniButton>
              ) : <LinkPill>{link.status}</LinkPill>}
            </RightCard>
          ))}
          {connectableNodes
            .filter((manifest) => !network.identityLinks.some((link) => link.nodeId === manifestNodeId(manifest) && link.status !== "revoked"))
            .map((manifest) => {
              const nodeId = manifestNodeId(manifest);
              const nodeName = String(manifest?.attrs?.nodeName || manifest?.attrs?.node?.name || nodeId);
              return (
                <RightCard key={nodeId}>
                  <div>
                    <small>Podés vincularte</small>
                    <strong>{nodeName}</strong>
                    <span>Puede ofrecer continuidad sin copiar tus datos privados a la red.</span>
                  </div>
                  <Primary type="button" onClick={() => void requestIdentityLink(manifest)}>
                    <Link2 size={14} /> Vincular
                  </Primary>
                </RightCard>
              );
            })}
          {!network.identityLinks.length && !connectableNodes.length ? (
            <Empty>Cuando un nodo verificado anuncie esta capacidad, aparecerá acá.</Empty>
          ) : null}
        </CardList>
      </Section> : null}

      {space === "overview" ? (
        <>
          {hasBuiltSummary ? (
            <Stats>
              {network.summary.outcomes ? <Stat><BadgeCheck /><span>Resultados</span><strong>{network.summary.outcomes}</strong></Stat> : null}
              {network.summary.contributions ? <Stat><Sparkles /><span>Aportes</span><strong>{network.summary.contributions}</strong></Stat> : null}
              {network.summary.connections ? <Stat><Link2 /><span>Relaciones</span><strong>{network.summary.connections}</strong></Stat> : null}
            </Stats>
          ) : !hasAnyValue ? <ValueEmpty><span>💧</span><strong>Tu red empieza acá</strong><p>Cuando construyas relaciones o una operación necesite apoyo, las posibilidades aparecerán en Mi Valor.</p></ValueEmpty> : null}
          <OverviewGrid>
            {network.summary.rights ? <OverviewCard type="button" onClick={() => setSpace("rights")}><span>🎟️</span><div><small>Derechos</small><strong>{network.summary.rights} disponible(s)</strong></div><b>Ver</b></OverviewCard> : null}
            {liquidityWays ? <OverviewCard type="button" onClick={() => setSpace("relations")}><span>💧</span><div><small>Red de Liquidez</small><strong>{liquidityWays} forma(s) de hacer posibles operaciones</strong></div><b>Abrir</b></OverviewCard> : null}
            {network.summary.operations ? <OverviewCard type="button" onClick={() => setSpace("activity")}><span>◷</span><div><small>Actividad</small><strong>{network.summary.operations} operación(es) en curso</strong></div><b>Ver</b></OverviewCard> : null}
          </OverviewGrid>
        </>
      ) : null}

      {space === "relations" ? <Section>
        <SectionHead>
          <div><strong>Red de Liquidez</strong><span>Tu red para hacer posibles operaciones. Cada nodo confirma su parte.</span></div>
        </SectionHead>
        <CardList>
          {network.creditOperations.slice(0, 4).map((dv) => (
            <RightCard key={dv.id}>
              <div><small>Financiación</small><strong>{dv?.attrs?.financeNodeName || dv?.attrs?.financeNodeId || "Solicitud en red"}</strong><span>{dv?.attrs?.state || dv?.attrs?.status || "En revisión"}</span></div>
            </RightCard>
          ))}
          {network.settlementPlans.slice(0, 4).map((plan) => (
            <RightCard key={plan.batchId}>
              <div><small>Liquidación acordada</small><strong>{plan.obligations.length} compromiso(s)</strong><span>{plan.confirmed} confirmado(s) por sus resultados reales</span></div>
            </RightCard>
          ))}
          {!network.creditOperations.length && !network.settlementPlans.length ? (
            <Empty>Tus acuerdos de crédito y obligaciones aparecerán cuando exista una operación real.</Empty>
          ) : null}
        </CardList>
      </Section> : null}

      {space === "activity" ? <Section>
        <SectionHead>
          <div><strong>Operaciones y aportes</strong><span>No es un puntaje: son hechos verificables y trabajos todavía abiertos.</span></div>
        </SectionHead>
        <CardList>
          {network.activeOperations.slice(0, 5).map((dv) => (
            <RightCard key={dv.id}>
              <div><small>Operación activa</small><strong>{eventLabel(dv)}</strong><span>{eventTime(dv) || "Esperando la siguiente parte"}</span></div>
            </RightCard>
          ))}
          {network.verifiedContributions.slice(0, 5).map((dv) => (
            <RightCard key={dv.id}>
              <div><small>Aporte verificado</small><strong>{dv?.attrs?.title || dv?.attrs?.capabilityLabel || "Contribución cumplida"}</strong><span>{eventTime(dv)}</span></div>
            </RightCard>
          ))}
          {!network.activeOperations.length && !network.verifiedContributions.length ? (
            <Empty>Acá aparecerán pedidos, trabajos y contribuciones cuando tengan evidencia real.</Empty>
          ) : null}
        </CardList>
      </Section> : null}

      {space === "rights" ? <Section>
        <SectionHead>
          <div><strong>✨ Beneficios UTOPY</strong><span>Aparecen solamente cuando un nodo publicó que los acepta.</span></div>
        </SectionHead>
        {vault.activeRights.length ? (
          <CardList>
            {vault.activeRights.map((right) => (
              <RightCard key={right.dv.id}>
                <div>
                  <small>{right.dv?.attrs?.issuerName}</small>
                  <strong>{right.dv?.attrs?.title}</strong>
                  <span>{right.acceptedBy.length ? `Aceptado por ${right.acceptedBy.map((item: any) => item?.attrs?.nodeName).join(", ")}` : "Esperando un nodo compatible"}</span>
                </div>
                <Primary
                  type="button"
                  disabled={!right.acceptedBy.length || right.state !== "active"}
                  onClick={() => void redeem(right)}
                >
                  {right.state === "requested" ? "Esperando nodo" : "Solicitar uso"}
                </Primary>
              </RightCard>
            ))}
          </CardList>
        ) : <Empty>Cuando completes una tarjeta o recibas un beneficio compatible aparecerá acá.</Empty>}
      </Section> : null}

      {space === "activity" ? <Section>
        <SectionHead>
          <div><strong>🔐 Bóveda Viva</strong><span>Se reconstruye desde pruebas; no es una cuenta central de dinero.</span></div>
          <LockKeyhole size={18} />
        </SectionHead>
        <History>
          {vault.history.slice(0, 12).map((dv) => (
            <HistoryRow key={dv.id}>
              <HistoryIcon $closed={dv.kind === "value.redemption"}>{dv.kind === "value.redemption" ? <Check size={15} /> : <Sparkles size={14} />}</HistoryIcon>
              <div><strong>{eventLabel(dv)}</strong><span>{eventTime(dv)}</span></div>
            </HistoryRow>
          ))}
          {!vault.history.length ? <Empty>Tu primera operación real confirmada aparecerá acá.</Empty> : null}
        </History>
      </Section> : null}

      {space === "overview" ? <Principle><ShieldCheck size={18} /><span>Una sola Identidad Viva; cada nodo conserva su relación y su verdad privada.</span></Principle> : null}
    </Shell>
  );
}

const Shell = styled.section`display:grid;min-width:0;max-width:100%;gap:16px;color:var(--utopy-carbon,#22232a);font-size:14px;*{min-width:0;overflow-wrap:anywhere}button:focus-visible{outline:3px solid #b8a2f3;outline-offset:3px}`;
const Hero = styled.div`
  border-radius:23px;padding:15px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:11px;color:#fff;
  background:radial-gradient(circle at 88% 10%,rgba(83,255,93,.28),transparent 42%),#101914;
  small{color:#a8b9ae;font-size:9px;font-weight:900;letter-spacing:.08em}h3{margin:1px 0 2px;font-size:23px}p{margin:0;color:#c7d3cb;font-size:11px}
`;
const HeroIcon = styled.div`width:44px;height:44px;border-radius:16px;display:grid;place-items:center;color:var(--utopy-carbon,#22232a);background:var(--utopy-lime,#c5ef83);`;
const Help = styled.button`border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:inherit;border-radius:12px;width:36px;height:36px;display:grid;place-items:center;cursor:pointer;`;
const ValueNav = styled.nav`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;padding:2px;@container (min-width:540px){grid-template-columns:repeat(4,minmax(0,1fr))}`;
const ValueNavButton = styled.button<{ $active?: boolean }>`border:1px solid var(--utopy-border,#e6e3ed);background:${({$active})=>$active?"var(--utopy-carbon,#22232a)":"#fff"};color:${({$active})=>$active?"#fff":"var(--utopy-muted,#706b7e)"};border-radius:16px;padding:10px 14px;min-height:44px;white-space:nowrap;font-size:12px;font-weight:650;cursor:pointer;`;
const Notice = styled.div`border:1px solid #c8eacd;border-radius:14px;padding:10px 12px;color:#1c5625;background:#effcf0;font-size:12px;font-weight:800;`;
const CardGrid = styled.div`display:grid;gap:10px;`;
const LoyaltyCard = styled.article`border:1px solid #dce5de;border-radius:20px;padding:13px;background:#fff;display:grid;gap:11px;box-shadow:0 8px 25px rgba(22,56,32,.04);`;
const CardTop = styled.div`display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;strong{display:block;font-size:14px}span{display:block;font-size:10px;color:#647067;margin-top:2px;line-height:1.35}`;
const NodeEmoji = styled.div`width:40px;height:40px;border-radius:14px;background:#f0faf2;display:grid;place-items:center;font-size:21px;`;
const LivePill = styled.b`font-size:8px;color:#16732f;background:#eaffed;border-radius:999px;padding:5px 7px;white-space:nowrap;`;
const LinkPill = styled(LivePill)`color:#62502a;background:#fff8df;`;
const ProgressBox = styled.div`padding:11px;border-radius:16px;background:#f3fbf5;display:grid;gap:8px;b{font-size:13px}span{display:block;font-size:10px;color:#536159;margin-top:2px}`;
const Progress = styled.div`height:7px;border-radius:999px;background:#d8e4db;overflow:hidden;i{display:block;height:100%;border-radius:inherit;background:var(--node-accent,#25c842);transition:width .3s ease}`;
const StampRow = styled.div`display:flex;gap:5px;flex-wrap:wrap;`;
const Stamp = styled.span<{ $on: boolean }>`width:28px;height:28px;border-radius:10px;display:grid!important;place-items:center;background:${({$on})=>$on?"#fff":"rgba(0,0,0,.04)"};border:1px solid ${({$on})=>$on?"rgba(31,122,61,.25)":"rgba(0,0,0,.06)"};font-size:${({$on})=>$on?"15px":"10px"}!important;color:#728078!important;margin:0!important;`;
const MemberLine = styled.div`display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap>span{font-size:10px;font-weight:800;color:#667269}div{display:flex;gap:6px}`;
const MiniButton = styled.button`border:1px solid #dde5df;background:#fff;border-radius:10px;padding:7px 8px;display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;cursor:pointer;`;
const LastMove = styled.div`font-size:9px;color:#7c887f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
const LinkArea = styled.div`display:grid;gap:8px;label{display:grid;gap:5px}label span{font-size:10px;font-weight:900;color:#526057}input{width:100%;box-sizing:border-box;border:1px solid #d8e0da;border-radius:13px;padding:11px 12px;font:inherit;text-transform:uppercase;outline:none}input:focus{border-color:#48c85c;box-shadow:0 0 0 3px rgba(72,200,92,.12)}`;
const Primary = styled.button`border:0;border-radius:12px;padding:10px 12px;background:#28dd3d;color:#08250d;font-weight:950;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;&:disabled{opacity:.45;cursor:not-allowed}`;
const ErrorText = styled.div`font-size:10px;color:#9a342b;font-weight:800;`;
const SmallText = styled.div`font-size:9px;color:#778179;`;
const Stats = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px;`;
const Stat = styled.div`border:1px solid #dfe7e1;border-radius:16px;padding:10px;background:#fff;display:grid;gap:3px;svg{width:15px;color:#21b838}span{font-size:9px;color:#69766d;font-weight:800}strong{font-size:17px}`;
const OverviewGrid = styled.div`display:grid;gap:9px;`;
const OverviewCard = styled.button`width:100%;border:1px solid #dfe7e1;border-radius:19px;padding:13px;background:#fff;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:11px;text-align:left;cursor:pointer;box-shadow:0 9px 26px rgba(22,56,32,.04);>span{width:42px;height:42px;border-radius:15px;background:#effaf2;display:grid;place-items:center;font-size:21px}div{min-width:0;display:grid;gap:2px}small{font-size:9px;color:#6b776f;font-weight:850}strong{font-size:12px;line-height:1.35}>b{font-size:10px;color:#087d25}`;
const ValueEmpty = styled.div`border:1px solid #dfe7e1;border-radius:22px;padding:22px 16px;background:linear-gradient(145deg,#fff,#f4fbf6);text-align:center;display:grid;place-items:center;gap:5px;>span{font-size:27px}strong{font-size:15px}p{max-width:330px;margin:0;color:#6b776f;font-size:10px;line-height:1.45}`;
const Section = styled.section`border:1px solid #dce5de;border-radius:19px;padding:13px;background:#fff;display:grid;gap:10px;`;
const SectionHead = styled.div`display:flex;align-items:center;justify-content:space-between;gap:10px;strong{font-size:13px}span{display:block;color:#727e75;font-size:9px;margin-top:2px}`;
const CardList = styled.div`display:grid;gap:8px;`;
const RightCard = styled.div`border:1px solid #dfe7e1;border-radius:14px;padding:10px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:9px;small,span{display:block;color:#6e7a71;font-size:9px}strong{display:block;font-size:12px;margin:2px 0}`;
const Empty = styled.div`border:1px dashed #d6ded8;border-radius:14px;padding:14px;color:#748077;font-size:10px;text-align:center;`;
const History = styled.div`display:grid;gap:7px;`;
const HistoryRow = styled.div`display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;strong{display:block;font-size:11px}span{display:block;color:#7a867d;font-size:9px}`;
const HistoryIcon = styled.div<{ $closed?: boolean }>`width:28px;height:28px;border-radius:10px;display:grid;place-items:center;background:${({$closed})=>$closed?"#e8f8eb":"#f2f5f3"};color:#199632;`;
const Principle = styled.div`border-radius:16px;padding:11px 12px;background:#132218;color:#dce7df;display:flex;gap:8px;align-items:flex-start;font-size:10px;line-height:1.4;`;
