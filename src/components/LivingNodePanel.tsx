import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { BriefcaseBusiness, ChevronLeft, MessageCircle, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { projectLivingNodes, resolveLivingNode } from "../utopy/livingNodeProjection";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { publishAuthorizedDV } from "../utopy/authorizedPublish";
import { activeEntitlementDVs, humanEntitlementLabel } from "../utopy/studioEntitlements";
const LivingAutomationPanel = lazy(() => import("./LivingAutomationPanel"));
const LivingResumeEditor = lazy(() => import("./LivingResume").then(module => ({ default: module.LivingResumeEditor })));

type Props = { open: boolean; allLive: any[]; activeActor?: any; initialSection?: "overview" | "automations"; onClose: () => void };
type ModuleCard = { key: string; label: string; icon: string; count?: number };

const value = (input: unknown) => String(input || "").trim();
const list = (input: unknown): any[] => Array.isArray(input) ? input : input == null ? [] : [input];
const normalize = (input: unknown) => value(input).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".");
const unique = (items: unknown[]) => [...new Set(items.flat(3).map(value).filter(Boolean))];

const MODULES: { test: RegExp; key: string; label: string; icon: string }[] = [
  { test: /order|pedido/, key: "orders", label: "Pedidos", icon: "📦" },
  { test: /sale|venta/, key: "sales", label: "Ventas", icon: "🛍️" },
  { test: /inventory|stock|inventario/, key: "inventory", label: "Inventario", icon: "🧺" },
  { test: /client|customer|cliente/, key: "customers", label: "Clientes", icon: "👥" },
  { test: /cash|caja|payment|cobro|settlement|liquid/, key: "cash", label: "Caja Viva", icon: "💧" },
  { test: /publication|publish|publicacion/, key: "publishing", label: "Publicaciones", icon: "✨" },
  { test: /invoice|fiscal|factura|sifen/, key: "billing", label: "Facturación", icon: "🧾" },
  { test: /today|daily|hoy/, key: "today", label: "Hoy", icon: "☀️" },
  { test: /work|job|trabajo/, key: "work", label: "Trabajos", icon: "🧰" },
  { test: /agenda|schedule|calendar/, key: "agenda", label: "Agenda", icon: "🗓️" },
  { test: /delivery|entrega/, key: "delivery", label: "Entregas", icon: "🚚" },
  { test: /conversation|message|chat/, key: "conversations", label: "Conversaciones", icon: "💬" },
  { test: /property|propiedad/, key: "properties", label: "Propiedades", icon: "🏠" },
  { test: /unit|unidad/, key: "units", label: "Unidades", icon: "🚪" },
  { test: /contract|contrato/, key: "contracts", label: "Contratos", icon: "📄" },
  { test: /renew|renovacion/, key: "renewals", label: "Renovaciones", icon: "🔄" },
  { test: /availability|disponibilidad/, key: "availability", label: "Disponibilidad", icon: "🟢" },
  { test: /capital/, key: "capital", label: "Capital", icon: "🌱" },
  { test: /commitment|compromiso/, key: "commitments", label: "Compromisos", icon: "🤝" },
  { test: /finance|credit|financia/, key: "finance", label: "Financiaciones", icon: "🌊" },
  { test: /result|outcome|resultado/, key: "results", label: "Resultados", icon: "✓" },
  { test: /automation|frequency/, key: "automations", label: "Automatizaciones", icon: "⚡" },
  { test: /route|ruta/, key: "routes", label: "Rutas", icon: "🗺️" },
  { test: /expense|gasto|cost/, key: "expenses", label: "Gastos", icon: "⛽" },
  { test: /proof|evidence|comprobante/, key: "deliveryProofs", label: "Pruebas de entrega", icon: "📸" },
  { test: /recurrence|recurrent|frecuenc/, key: "recurrences", label: "Recurrencias", icon: "🔁" },
  { test: /fleet|vehicle|flota|vehiculo/, key: "fleet", label: "Flota", icon: "🚐" },
  { test: /dispatch|driver|assignment|conductor/, key: "dispatch", label: "Equipo y asignación", icon: "🧭" },
];

const AUTOMATIONS = [
  ["payment.reminder", "Recordar cobros"], ["inventory.low", "Stock bajo"],
  ["order.followup", "Seguimiento pedidos"], ["availability.sync", "Disponibilidad"],
  ["contract.renewal", "Renovaciones"], ["work.recurrence", "Trabajos recurrentes"],
  ["cash.reconciliation", "Caja y conciliación"], ["frequency", "Frequency"],
] as const;

function refsFromEntitlement(dv: any) {
  const attrs = dv?.attrs || dv?.data?.entitlement || {};
  return unique([attrs.entitlementKey, attrs.productKey, attrs.planKey, attrs.passId, attrs.modules, attrs.capabilities, attrs.features, attrs.entitlements]);
}

function modulesFor(entitlements: any[], node: any): ModuleCard[] {
  const projected = entitlements.flatMap((dv) => list(dv?.attrs?.panel?.modules)).filter((module) => MODULES.some((known) => known.key === module?.key));
  if (projected.length) return [...new Map(projected.map((module) => {
    const known = MODULES.find((item) => item.key === module.key)!;
    return [module.key, { key: module.key, label: humanEntitlementLabel(module.label, known.label), icon: known.icon }];
  })).values()] as ModuleCard[];
  const refs = unique([...entitlements.flatMap(refsFromEntitlement), ...(node?.capabilities || []).flatMap((capability: any) => [capability.id, capability.label, capability.verbs])]);
  const keys = new Set<string>();
  refs.forEach((ref) => MODULES.forEach((module) => { if (module.test.test(normalize(ref))) keys.add(module.key); }));
  return MODULES.filter((module) => keys.has(module.key)).map(({ key, label, icon }) => ({ key, label, icon }));
}

function belongsToNode(dv: any, nodeId: string) {
  const attrs = dv?.attrs || {};
  return [attrs.nodeId, attrs.targetNodeId, attrs.sellerNodeId, attrs.sourceNodeId, dv?.meta?.originNode, dv?.meta?.authority].map(value).includes(nodeId);
}

function moduleCount(key: string, allLive: any[], nodeId: string) {
  const candidates = allLive.filter((dv) => belongsToNode(dv, nodeId));
  const tests: Record<string, RegExp> = {
    orders: /market\.order/, sales: /market\.order/, inventory: /product|producto|inventory/,
    customers: /relationship|identity\.link/, work: /work\.|job/, delivery: /delivery/,
    routes: /route|delivery/, expenses: /expense|cost/, deliveryProofs: /delivery\.(?:proof|outcome)|evidence/,
    recurrences: /frequency|recurrence/, fleet: /vehicle|fleet/, dispatch: /dispatch|assignment/,
    conversations: /message|conversation/, properties: /rental\.property/, units: /rental\.unit/,
    contracts: /rental\.contract|agreement/, cash: /payment|settlement|charge/,
    renewals: /renew/, finance: /credit|finance/, results: /outcome|result/,
  };
  return tests[key] ? candidates.filter((dv) => tests[key].test(value(dv.kind))).length : 0;
}

export function hasLivingPanelAccess(allLive: any[], activeActor?: any) {
  const actorId = value(activeActor?.actorId || activeActor?.id);
  const authorizedNodes = (activeActor?.authorizations || []).filter((item: any) => item.verified && item.status === "active").map((item: any) => item.nodeId);
  return activeEntitlementDVs(allLive, actorId, authorizedNodes).length > 0 || allLive.some((dv) => dv?.kind === "node.authorization" && dv?.meta?.runtimeVerified === true && dv?.attrs?.status === "active" && value(dv?.attrs?.actorId) === actorId);
}

export default function LivingNodePanel({ open, allLive, activeActor, initialSection = "overview", onClose }: Props) {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [automationState, setAutomationState] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");
  const [automationOpen, setAutomationOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void resolveCurrentIdentityContext({ allLive, activeActor }).then((result) => { if (current) setIdentity(result); });
    return () => { current = false; };
  }, [open, allLive, activeActor]);
  const entitlements = useMemo(() => activeEntitlementDVs(allLive, value(identity?.actorId), (identity?.authorizations || []).filter((item: any) => item.verified && item.status === "active").map((item: any) => item.nodeId)), [allLive, identity]);
  const nodes = useMemo(() => {
    if (!identity) return [];
    const allowed = unique([
      identity.nodeId, identity.actingAsNodeId,
      ...(identity.authorizations || []).filter((authorization: any) => authorization.status === "active" && authorization.verified).map((authorization: any) => authorization.nodeId),
    ]);
    const projected = projectLivingNodes(allLive);
    const resolved = allowed.map((ref) => resolveLivingNode(ref, allLive)).filter(Boolean);
    projected.filter((node) => node.actorId && node.actorId === identity.actorId).forEach((node) => resolved.push(node));
    return [...new Map(resolved.map((node: any) => [node.nodeId || node.id, node])).values()];
  }, [allLive, identity, entitlements]);
  useEffect(() => { if (!selectedNodeId && nodes[0]) setSelectedNodeId(nodes[0].nodeId || nodes[0].id); }, [nodes, selectedNodeId]);
  const node = nodes.find((candidate: any) => (candidate.nodeId || candidate.id) === selectedNodeId) || nodes[0] || null;
  useEffect(() => { if (open && node && initialSection === "automations") setAutomationOpen(true); }, [open, node?.nodeId, initialSection]);
  const goToOperation = (path: string) => { onClose(); navigate(path); };
  const openModule = (key: string) => {
    if (key === "automations") { setAutomationOpen(true); return; }
    const routes: Record<string, string> = { orders: "pedidos", sales: "pedidos", work: "trabajos", inventory: "publicar", publications: "publicar", cash: "caja", delivery: "pedidos" };
    if (key === "conversations") return goToOperation("/market?conversaciones=1");
    if (routes[key]) return goToOperation(`/market?tab=producir&section=${routes[key]}`);
    if (["properties", "units", "contracts", "renewals", "availability"].includes(key)) return goToOperation("/falcon/skylines");
    if (["capital", "commitments", "finance", "results"].includes(key)) return goToOperation("/falcon/capital");
    goToOperation("/market?tab=producir&section=trabajos");
  };
  const nodeEntitlements = entitlements.filter((dv) => !value(dv?.attrs?.nodeId || dv?.attrs?.targetNodeId || dv?.attrs?.subjectNodeId) || belongsToNode(dv, value(node?.nodeId)));
  const modules = modulesFor(nodeEntitlements, node).map((module) => ({ ...module, count: moduleCount(module.key, allLive, value(node?.nodeId)) }));
  const automationRefs = unique(nodeEntitlements.flatMap(refsFromEntitlement));
  const explicitPassLabels = nodeEntitlements.map((dv) => {
    const attrs = dv?.attrs || dv?.data?.entitlement || {};
    const product = normalize(attrs.productKey || attrs.entitlementKey || attrs.product);
    const plan = normalize(attrs.planKey || attrs.plan);
    return product.includes("daily") ? (plan.includes("business") ? "Daily Business" : "Daily Pass") : "";
  }).filter(Boolean);
  const passLabels = unique([...explicitPassLabels, ...automationRefs.filter((ref) => /pass|business|pro|plus/i.test(ref)).map((ref) => {
    const normalized = normalize(ref);
    if (normalized.includes("skylines")) return "Skylines Pass";
    if (normalized.includes("daily")) return normalized.includes("business") ? "Daily Business" : "Daily Pass";
    if (normalized.includes("capital")) return "Capital Pass";
    if (normalized.includes("store")) return "Store Pass";
    if (normalized.includes("business")) return /plus/.test(normalized) ? "Business Plus" : "Business Pro";
    return "Pass activo";
  })]);
  const projectedAutomations = nodeEntitlements.flatMap((dv) => list(dv?.attrs?.panel?.automations));
  const enabledAutomations: Array<readonly [string, string]> = projectedAutomations.length
    ? [...new Map(projectedAutomations.map((item) => [value(item.key), [value(item.key), humanEntitlementLabel(item.label, "Automatización")]] as const)).values()] as Array<readonly [string, string]>
    : AUTOMATIONS.filter(([key]) => automationRefs.some((ref) => normalize(ref).includes(normalize(key))));
  const experienceLinks = useMemo(() => {
    const sources = [node?.source?.attrs?.links, ...nodeEntitlements.map((dv) => dv?.attrs?.links)].filter(Boolean);
    const advertised = unique([...automationRefs, ...(node?.capabilities || []).flatMap((capability: any) => [capability.id, capability.label])]);
    const link = (names: string[]) => {
      for (const source of sources) for (const name of names) if (value(source?.[name])) return value(source[name]);
      return "";
    };
    return [
      advertised.some((ref) => /(?:^|\.)mo(?:\.|$)|model|design|materializ/i.test(ref)) ? { key: "mo", title: "MO", copy: "Diseños y materializaciones", url: link(["mo", "modeler", "materialization"]) } : null,
      advertised.some((ref) => /(?:^|\.)ge(?:\.|$)|energy|physical\.operation/i.test(ref)) ? { key: "ge", title: "GE", copy: "Operación física y energía", url: link(["ge", "energy", "operations"]) } : null,
    ].filter(Boolean) as { key: string; title: string; copy: string; url: string }[];
  }, [node, nodeEntitlements, automationRefs]);
  useEffect(() => {
    if (!node) return;
    const next: Record<string, boolean> = {};
    nodeEntitlements.forEach((dv) => Object.entries(dv?.attrs?.automations || {}).forEach(([key, enabled]) => { next[key] = enabled === true; }));
    allLive.filter((dv) => /node\.automation\.(?:preference|policy)/i.test(value(dv?.kind)) && belongsToNode(dv, value(node.nodeId))).forEach((dv) => {
      const key = value(dv?.attrs?.automation || dv?.attrs?.key);
      if (key) next[key] = dv?.attrs?.enabled === true || normalize(dv?.attrs?.state) === "active";
    });
    setAutomationState(next);
  }, [allLive, node]);

  const toggleAutomation = async (key: string) => {
    if (!identity || !node) return;
    const studioGrant = nodeEntitlements.find((dv) => list(dv?.attrs?.panel?.automations).some((item) => item.key === key));
    if (studioGrant) {
      const link = value(studioGrant?.attrs?.links?.managePass);
      if (/^https:\/\//i.test(link)) { const target = new URL(link); target.searchParams.set("nodeId", node.nodeId); target.searchParams.set("returnTo", window.location.href); window.open(target.href, "_blank", "noopener,noreferrer"); }
      else setNotice("La configuración de este Pass se administra en Studio.");
      return;
    }
    const next = !automationState[key];
    setAutomationState((current) => ({ ...current, [key]: next }));
    setNotice("");
    try {
      await publishAuthorizedDV({
        dv: { id: `node.automation.preference:${value(node.nodeId)}:${key}`, kind: "node.automation.preference", attrs: { nodeId: node.nodeId, automation: key, enabled: next, actorId: identity.actorId, participants: [identity.actorId, node.nodeId] }, traits: ["node:automation", "preference:human"], meta: { ns: "utopy:node", scopes: ["participants"] } },
        allLive, activeActor, actingAsNodeId: node.nodeId, targetNodeId: node.nodeId,
        action: "node.automation.configure", sensitivity: "relationship",
      });
    } catch (error: any) {
      setAutomationState((current) => ({ ...current, [key]: !next }));
      setNotice(error?.message || "No pudimos guardar este cambio.");
    }
  };

  if (!open) return null;
  return <Overlay onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <Panel className="utopy-ui" role="dialog" aria-modal="true" aria-label="Panel Vivo">
      <Header><button type="button" onClick={onClose} aria-label="Volver"><ChevronLeft /></button><div><small>Mi Identidad Viva</small><h2>Panel Vivo</h2></div><button type="button" onClick={onClose} aria-label="Cerrar"><X /></button></Header>
      <section className="m-4 min-w-0 rounded-3xl border border-slate-100 bg-white p-4">
        <h3 className="text-xl font-black">Mi espacio personal</h3><p className="mt-1 text-sm text-slate-500">Tu recorrido y tus capacidades. No necesitás un comercio ni un Pass.</p>
        <details className="mt-3"><summary className="cursor-pointer py-3 font-bold">Crear o editar mi currículum</summary><Suspense fallback={<p>Cargando tu currículum…</p>}><LivingResumeEditor allLive={allLive} activeActor={activeActor} /></Suspense></details>
      </section>
      {nodes.length > 1 ? <NodeRail aria-label="Elegir Nodo">{nodes.map((candidate: any) => <button type="button" key={candidate.nodeId || candidate.id} data-active={(candidate.nodeId || candidate.id) === (node?.nodeId || node?.id)} onClick={() => setSelectedNodeId(candidate.nodeId || candidate.id)}>{candidate.avatarRef ? <img src={candidate.avatarRef} alt="" /> : <span>{value(candidate.name).charAt(0) || "N"}</span>}<b>{candidate.name || "Nodo Vivo"}</b></button>)}</NodeRail> : null}
      {!node ? <Empty><BriefcaseBusiness /><b>Prepará tu espacio de trabajo</b><span>Completá tu Perfil Vivo. Si administrás un comercio o equipo, necesitás vincular su Nodo con una autorización vigente.</span><div className="mt-3 flex flex-wrap justify-center gap-2"><button type="button" className="min-h-11 rounded-full bg-slate-950 px-5 font-bold text-white" onClick={() => goToOperation("/market?tab=circular&view=red&quick=profile")}>Completar Perfil Vivo</button><button type="button" className="min-h-11 rounded-full border bg-white px-5 font-bold" onClick={() => goToOperation("/market?tab=producir&section=publicar")}>Crear una publicación</button></div></Empty> : <>
        <NodeTitle><div>{node.avatarRef ? <img src={node.avatarRef} alt="" /> : <span>{value(node.name).charAt(0) || "N"}</span>}</div><section><small>Ahora</small><h3>{node.name || "Nodo Vivo"}</h3><p>{modules.filter((module) => module.count).slice(0, 2).map((module) => `${module.count} ${module.label.toLowerCase()}`).join(" · ") || "Todo en calma"}</p>{passLabels.length ? <Passes>{passLabels.map((label) => <i key={label}>{label}</i>)}</Passes> : null}</section></NodeTitle>
        <SectionTitle>Necesita atención</SectionTitle>
        <Grid>{modules.length ? modules.filter((module) => module.key !== "automations").map((module) => <Module type="button" key={module.key} onClick={() => openModule(module.key)}><span>{module.icon}</span><b>{module.label}</b>{module.count ? <i>{module.count}</i> : <small>Al día</small>}</Module>) : <EmptyCard>Este Nodo todavía no anunció módulos operativos.</EmptyCard>}</Grid>
        <SectionTitle>Automatizaciones</SectionTitle>
        <AutomationActions><button type="button" onClick={() => setAutomationOpen(true)}><Sparkles size={17} /> Automatizar</button><button type="button" onClick={() => setAutomationOpen(true)}>Crear una forma de hacerlo</button></AutomationActions>
        {enabledAutomations.length ? <AutomationList>{enabledAutomations.map(([key, label]) => <button type="button" key={key} onClick={() => toggleAutomation(key)}><span><Sparkles size={17} /><b>{label}</b></span><i data-on={automationState[key] === true}>{automationState[key] ? "ON" : "OFF"}</i></button>)}</AutomationList> : null}
        {experienceLinks.length ? <><SectionTitle>Experiencias conectadas</SectionTitle><ExperienceGrid>{experienceLinks.map((experience) => <button type="button" key={experience.key} disabled={!experience.url} onClick={() => experience.url && window.open(experience.url, "_blank", "noopener,noreferrer")}><b>{experience.title}</b><span>{experience.copy}</span></button>)}</ExperienceGrid></> : null}
        <SectionTitle>Actividad reciente</SectionTitle>
        <Activity>{(node.activity || []).slice(0, 4).map((dv: any) => <div key={dv.id}><span>⌁</span><b>{value(dv?.attrs?.title || dv?.attrs?.name || dv?.labels?.[0]) || "Actividad del Nodo"}</b></div>)}{!node.activity?.length ? <p>Sin novedades por ahora.</p> : null}</Activity>
        <Actions><button type="button" onClick={() => goToOperation("/market?tab=producir&section=trabajos")}>Mis trabajos</button><button type="button" onClick={() => goToOperation("/market?tab=mis_pedidos")}>Mis pedidos</button><button type="button" onClick={() => goToOperation("/market?conversaciones=1")}><MessageCircle size={16} /> Conversaciones</button><button type="button" onClick={() => goToOperation("/market/mapa?view=valor")}>Mi valor</button></Actions>
        {notice ? <Notice>{notice}</Notice> : null}
      </>}
    </Panel>
    {automationOpen && node && <Suspense fallback={null}><LivingAutomationPanel node={node} actorId={value(identity?.actorId)} suggestions={enabledAutomations.map(([, label]) => label)} allLive={allLive} onClose={() => setAutomationOpen(false)} /></Suspense>}
  </Overlay>;
}

const Overlay = styled.div`position:fixed;inset:0;z-index:14000;display:grid;place-items:center;padding:18px;background:rgba(36,42,65,.18);backdrop-filter:blur(14px);`;
const Panel = styled.section`width:min(880px,100%);max-height:92dvh;overflow:auto;border:1px solid rgba(255,255,255,.9);border-radius:32px;padding:22px;background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(244,242,255,.9));box-shadow:0 30px 90px rgba(45,52,85,.22);color:#172036;@media(max-width:640px){align-self:end;width:calc(100% + 20px);max-height:94dvh;margin:-10px;border-radius:30px 30px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));}`;
const Header = styled.header`display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:12px;button{width:40px;height:40px;border:1px solid #e7e9f2;border-radius:50%;background:white;display:grid;place-items:center}div{text-align:center}small{font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.13em;color:#7380a7}h2{margin:2px 0 0;font-size:25px}`;
const NodeRail = styled.div`display:flex;gap:10px;overflow:auto;margin:18px 0 4px;padding:3px;button{min-width:108px;border:1px solid #e4e6f0;border-radius:18px;background:#fff9;padding:10px;display:grid;justify-items:center;gap:6px;color:#56617d}button[data-active=true]{border-color:#8294ed;box-shadow:0 0 0 3px #8999eb22;color:#24335d}img,span{width:38px;height:38px;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:#e9e7fa}b{font-size:12px;max-width:96px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
const NodeTitle = styled.div`display:flex;align-items:center;gap:14px;margin-top:18px;padding:16px;border-radius:24px;background:#fff;border:1px solid #ececf3;>div{width:58px;height:58px;border-radius:20px;overflow:hidden;background:linear-gradient(135deg,#c9d4ff,#e4d5f7);display:grid;place-items:center;font-size:23px}img{width:100%;height:100%;object-fit:cover}small{font-weight:850;color:#7180ac;text-transform:uppercase;letter-spacing:.12em}h3{margin:2px 0;font-size:21px}p{margin:0;color:#66708a;font-size:13px}`;
const Passes = styled.span`display:flex;flex-wrap:wrap;gap:5px;margin-top:7px;i{font-style:normal;font-size:10px;font-weight:850;padding:4px 7px;border-radius:999px;background:#eeebff;color:#5e55a4}`;
const SectionTitle = styled.h4`margin:22px 2px 10px;font-size:14px;`;
const Grid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;`;
const Module = styled.button`position:relative;min-height:116px;border:1px solid #e6e8f1;border-radius:22px;background:#fff;padding:17px;text-align:left;display:grid;align-content:space-between;cursor:pointer;>span{font-size:24px}b{font-size:15px}small{color:#7b849b}i{position:absolute;right:14px;top:14px;min-width:27px;padding:4px 7px;border-radius:999px;background:#e8f8ef;color:#257350;font-style:normal;font-weight:900;text-align:center}`;
const AutomationList = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;button{border:1px solid #e6e7f0;border-radius:18px;background:#fff;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}span{display:flex;align-items:center;gap:8px;text-align:left}i{font-style:normal;font-size:11px;font-weight:900;color:#8b93a8}i[data-on=true]{color:#23835c}`;
const AutomationActions = styled.div`display:flex;flex-wrap:wrap;gap:9px;margin-bottom:10px;button{min-height:45px;border:1px solid #dadcf1;border-radius:15px;background:#f7f5ff;color:#464b9d;padding:10px 14px;display:flex;align-items:center;gap:8px;font-weight:800}`;
const ExperienceGrid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;button{border:1px solid #dedff0;border-radius:22px;background:linear-gradient(135deg,#22283b,#4d4470);color:white;padding:18px;text-align:left;display:grid;gap:5px}button:disabled{opacity:.72}b{font-size:20px}span{font-size:13px;color:#e2def6}`;
const Activity = styled.div`display:grid;gap:8px;div{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:17px;background:#ffffffa8}span{color:#7e8ee2}b{font-size:13px}p{margin:0;color:#7b8398}`;
const Actions = styled.div`display:flex;gap:8px;overflow:auto;margin-top:20px;padding-bottom:2px;button{min-height:44px;white-space:nowrap;border:1px solid #e0e3ed;border-radius:999px;background:white;padding:0 16px;display:flex;align-items:center;gap:7px;font-weight:800}`;
const Empty = styled.div`min-height:280px;display:grid;place-items:center;align-content:center;text-align:center;gap:9px;color:#68728c;svg{width:42px;height:42px}b{font-size:18px;color:#28324b}span{max-width:360px}`;
const EmptyCard = styled.div`grid-column:1/-1;border:1px dashed #d9dce8;border-radius:20px;padding:24px;text-align:center;color:#778097`;
const Notice = styled.p`margin:12px 0 0;padding:11px 13px;border-radius:14px;background:#fff4dc;color:#79551f;font-size:13px;font-weight:750`;
