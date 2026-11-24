import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { LivingResumeEditor } from "../components/LivingResume";
import { uploadConversationReferences } from "../components/ConversationReferences";
import {
  BadgeCheck,
  CalendarClock,
  CircleHelp,
  LocateFixed,
  MapPinned,
  MessageCircle,
  Radio,
  Send,
  Camera,
  UserRound,
  X,
} from "lucide-react";
import {
  approximateGeo,
  buildBookingDecisionDVs,
  buildLiveProfileDV,
  buildLiveReplyDVs,
  buildLiveSignalDV,
  capabilityFromHumanText,
} from "./liveNetwork.builders";
import {
  belongsToActor,
  buildLiveContext,
  selectContextualDVs,
  targetsActor,
} from "./liveNetwork.context";
import { humanizeLiveDV, humanVisibleText } from "./liveNetwork.human";
import {
  publishLiveNetworkDV,
  publishLiveNetworkMany,
} from "./liveNetwork.publish";
import { interpretHumanSignal, rememberConfirmedMeaning } from "./interlanguage";
import type { ApproximateGeo } from "./liveNetwork.types";
import { projectLiveProfiles } from "./liveProfile";
import { privateLivingIdentity, savePrivateLivingIdentity } from "../utopy/identityPersonal";
import { resolveCurrentIdentityContext } from "../utopy/identityContext";
import { canRelate, type TerritorialMode } from "../utopy/territorialCompatibility";
import LivingCashierPanel from "../pay/LivingCashierPanel";
import { buildFrequencyEvent, publishFrequencyEvent } from "../utopy/frequency.engine";
import { projectLivingNodes } from "../utopy/livingNodeProjection";
import { groupLivingActivity } from "../utopy/livingNodeUX";
import GuidedIntentComposer from "./GuidedIntentComposer";

const BovedaVivaPanel = lazy(() => import("../vault/BovedaVivaPanel"));

type PanelView = "feed" | "publish" | "profile" | "vault" | "cashier";
type NetworkMode = "for_me" | "nearby" | "mine" | "explore";

function humanTopics(dv: any) {
  const raw = `${dv?.kind || ""} ${dv?.attrs?.title || ""} ${dv?.attrs?.text || ""} ${dv?.attrs?.description || ""}`.toLowerCase();
  const topics: string[] = [];
  if (/work|trabaj|empleo|meser|niñer|niner|cuidado|servicio/.test(raw)) topics.push("Trabajo", "Oportunidades");
  if (/product|producto|compr|tienda|venta/.test(raw)) topics.push("Comprar");
  if (/offer|ofrezco|vendo|venta/.test(raw)) topics.push("Vender");
  if (/need|necesit|busco|ayuda|demand/.test(raw)) topics.push("Ayudar");
  if (/delivery|entreg|transport|repart/.test(raw)) topics.push("Entregas");
  if (/financ|credito|aporte/.test(raw)) topics.push("Oportunidades");
  if (/fin de semana|finde|sábado|sabado|domingo/.test(raw)) topics.push("Este finde");
  return [...new Set(topics)];
}

type Props = {
  allLive: any[];
  initialView?: PanelView;
  minimalEmbed?: boolean;
  activeActor?: any | null;
  focusedId?: string | null;
  onFocusDV?: (dv: any | null) => void;
  onOpenThread?: (threadId: string, payload?: any) => void;
  onProfileDone?: () => void;
  initialProfileSection?: "public" | "private" | "resume" | "work";
  onPrivateIdentitySaved?: () => void | Promise<void>;
  identityJurisdiction?: { country: string; region?: string; city?: string };
  initialText?: string;
  onDraftTextChange?: (text: string) => void;
  onPublishedResponses?: (dv?: any) => void;
};

function actorIdentity(activeActor: any) {
  return {
    id: String(activeActor?.actorId || activeActor?.id || ""),
    name: String(
      activeActor?.nombre ||
        activeActor?.displayName ||
        activeActor?.name ||
        activeActor?.actorName ||
        "Mi Perfil Vivo",
    ),
    nodeId: activeActor?.nodeId ? String(activeActor.nodeId) : null,
    territoryId:
      activeActor?.territorioId || activeActor?.territoryId || null,
  };
}

function profileCapabilityText(profile: any) {
  const labels = Array.isArray(profile?.attrs?.capabilityLabels)
    ? profile.attrs.capabilityLabels
    : [];
  return [...new Set(labels.map((item: any) => String(item?.label || "").trim()).filter((label: string) => label && !/^(vos|voz|resultado vivo)$/i.test(label)))].join(", ");
}

function feedKind(dv: any) {
  const kind = String(dv?.kind || "").toLowerCase();
  if (
    ["value.stamp", "value.right", "value.redemption"].includes(kind) ||
    kind.startsWith("benefit.")
  ) {
    // Mi valor es una lectura privada del Perfil Vivo, no contenido del feed.
    return false;
  }
  return (
    kind === "node.profile" ||
    kind === "resonance.intent" ||
    kind === "capability.offer" ||
    kind === "work.intent" ||
    kind === "match.proposal" ||
    kind === "booking.request" ||
    kind === "booking.status" ||
    kind === "mt:offer" ||
    kind === "mt:producto" ||
    kind === "mt.product" ||
    kind === "design.spec" ||
    kind === "composition.publish" ||
    kind.startsWith("delivery.") ||
    kind.startsWith("value.") ||
    kind.includes("demand")
  );
}

function feedRole(dv: any) {
  const kind = String(dv?.kind || "").toLowerCase();
  const mode = String(dv?.attrs?.intent?.mode || "").toLowerCase();
  if (
    mode === "need" ||
    kind.includes("demand") ||
    kind === "work.intent"
    || kind === "composition.publish"
  ) {
    return "need";
  }
  if (
    mode === "offer" ||
    kind.includes("offer") ||
    kind.includes("product") ||
    kind.includes("producto") ||
    kind === "node.profile"
  ) {
    return "offer";
  }
  return "other";
}

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: currency || "PYG",
      maximumFractionDigits: currency === "PYG" ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currency || "PYG"}`;
  }
}

export default function LiveNetworkPanel({
  allLive,
  initialView,
  minimalEmbed = false,
  activeActor,
  focusedId,
  onFocusDV,
  onOpenThread,
  onProfileDone,
  initialProfileSection,
  onPrivateIdentitySaved,
  identityJurisdiction,
  initialText,
  onDraftTextChange,
  onPublishedResponses,
}: Props) {
  const actor = useMemo(() => actorIdentity(activeActor), [activeActor]);
  const identityRequested = typeof window !== "undefined" && window.sessionStorage.getItem("utopy.identity.openPersonal") === "1";
  const [view, setView] = useState<PanelView>(initialView || (identityRequested ? "profile" : "feed"));
  const [profileSection, setProfileSection] = useState<"public" | "private" | "resume" | "work">(identityRequested || onPrivateIdentitySaved ? "private" : initialProfileSection || (new URLSearchParams(window.location.search).get("resume") === "1" ? "resume" : "public"));
  const [networkMode, setNetworkMode] = useState<NetworkMode>("for_me");
  const [topicFilter, setTopicFilter] = useState("");
  const [networkPreferences, setNetworkPreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem("utopy.network.preferences.v1") || "{}"); }
    catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem("utopy.network.preferences.v1", JSON.stringify(networkPreferences)); } catch {} }, [networkPreferences]);
  const [notice, setNotice] = useState("");
  const [geo, setGeo] = useState<ApproximateGeo | null>(null);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    if (initialView) { setView(initialView); return; }
    const quick = new URLSearchParams(window.location.search).get("quick");
    if (quick === "publish") setView("publish");
    if (quick === "profile") setView("profile");
    if (quick === "cashier") setView("cashier");
  }, [initialView]);

  const context = useMemo(
    () => buildLiveContext(allLive, actor.id, focusedId),
    [allLive, actor.id, focusedId],
  );
  const profile = context.profile;

  const [profileName, setProfileName] = useState(actor.name);
  const [profileBio, setProfileBio] = useState("");
  const [capabilityText, setCapabilityText] = useState("");
  const [availableNow, setAvailableNow] = useState(false);
  const [serviceRadiusKm, setServiceRadiusKm] = useState(15);
  const [workRangeKm, setWorkRangeKm] = useState(15);
  const [deliveryRangeKm, setDeliveryRangeKm] = useState(15);
  const [remote, setRemote] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [onSite, setOnSite] = useState(true);
  const [profileAvatar, setProfileAvatar] = useState("");
  const [identityActorId, setIdentityActorId] = useState(actor.id);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [identityDocument, setIdentityDocument] = useState("");
  const [identityCountry, setIdentityCountry] = useState("PY");
  const [birthDate, setBirthDate] = useState("");
  const [privateAddress, setPrivateAddress] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [signalText, setSignalText] = useState(initialText || "");
  const uploadedReference = useRef<{ file: File; url: string } | null>(null);
  const changeSignalText = (value: string) => { setSignalText(value); onDraftTextChange?.(value); };
  const createWithPrefilled = useRef(false);
  useEffect(() => {
    const createWith = new URLSearchParams(window.location.search).get("createWith");
    if (!createWith || createWithPrefilled.current || signalText.trim()) return;
    const node = resolveLivingNode(createWith, allLive);
    if (node) { createWithPrefilled.current = true; setSignalText(`Quiero crear algo con ${node.name}`); }
  }, [allLive, signalText]);
  const [voiceAudioRef, setVoiceAudioRef] = useState<string | null>(null);
  const [rememberCapability, setRememberCapability] = useState(false);
  const [signalPrivacy, setSignalPrivacy] = useState<string[]>(["noLocationDisclosure"]);

  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [bookingAt, setBookingAt] = useState("");

  useEffect(() => {
    if (!profile) {
      setProfileName(actor.name);
      return;
    }
    setProfileName(String(profile?.attrs?.actorName || actor.name));
    setProfileBio(String(profile?.attrs?.bio || ""));
    setCapabilityText(profileCapabilityText(profile));
    setAvailableNow(
      profile?.attrs?.availability?.availableNow === true,
    );
    setServiceRadiusKm(
      Math.max(1, Number(profile?.attrs?.capabilities?.[0]?.serviceRadiusKm || 15)),
    );
    setWorkRangeKm(Math.max(0, Number(profile?.attrs?.ranges?.workRangeKm ?? profile?.attrs?.capabilities?.[0]?.serviceRadiusKm ?? 15)));
    setDeliveryRangeKm(Math.max(0, Number(profile?.attrs?.ranges?.deliveryRangeKm ?? 15)));
    setRemote(profile?.attrs?.ranges?.remote === true); setPickup(profile?.attrs?.ranges?.pickup === true); setOnSite(profile?.attrs?.ranges?.onSite !== false);
    setProfileAvatar(String(profile?.attrs?.avatar || ""));
    setGeo(profile?.attrs?.geo || null);
  }, [profile?.id, profile?.meta?.version, actor.name]);

  useEffect(() => { void resolveCurrentIdentityContext({ allLive, activeActor }).then((context) => setIdentityActorId(context.actorId)); }, [activeActor, allLive.length]);
  useEffect(() => {
    const personal = privateLivingIdentity(allLive, identityActorId)?.attrs;
    if (!personal) return;
    setFirstName(String(personal.firstName || "")); setLastName(String(personal.lastName || "")); setIdentityDocument(String(personal.document || "")); setIdentityCountry(String(personal.country || "PY")); setBirthDate(String(personal.birthDate || "")); setPrivateAddress(String(personal.address || ""));
  }, [allLive, identityActorId]);

  const rankedItems = useMemo(
    () =>
      selectContextualDVs(allLive, context, {
        surface: "feed",
        limit: 80,
      }).filter((item) => feedKind(item.dv)),
    [allLive, context],
  );

  const contextualNeed = useMemo(() => context.focus || context.profile || { attrs: { geo: context.geo, territoryId: actor.territoryId } }, [context.focus, context.profile, context.geo, actor.territoryId]);
  const occasionalItems = useMemo(() => {
    if (networkMode === "mine" || networkPreferences.onlyNear || networkPreferences.occasional === false) return [];
    const known = new Set(rankedItems.map((item) => item.dv?.id));
    return allLive.filter((dv) => !known.has(dv?.id) && feedKind(dv) && !belongsToActor(dv, actor.id))
      .filter((dv) => /work|intent|need|demand|offer|capability/i.test(String(dv?.kind || "")))
      .filter((dv) => !/closed|resolved|cancel|expired/i.test(String(dv?.attrs?.status || "")))
      .filter((dv) => {
        const timestamp = Date.parse(String(dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.updatedAt || ""));
        if (!Number.isFinite(timestamp) || Date.now() - timestamp > 14 * 86_400_000) return false;
        const relation = canRelate({ need: contextualNeed, capability: dv, mode: "for_me" });
        return (relation.recommended || (relation.distanceKm != null && relation.distanceKm <= 20)) && (humanTopics(dv).includes("Oportunidades") || humanTopics(dv).includes("Este finde"));
      })
      .slice(0, 6).map((dv) => ({ dv, reasons: ["También podría interesarte"] }));
  }, [allLive, rankedItems, actor.id, contextualNeed, networkMode, networkPreferences.onlyNear, networkPreferences.occasional]);
  const exploreItems = useMemo(() => {
    if (networkMode !== "explore") return [];
    const known = new Set([...rankedItems, ...occasionalItems].map((item) => item.dv?.id));
    return allLive.filter((dv) => dv?.id && !known.has(dv.id) && feedKind(dv) && !/closed|resolved|cancel|expired/i.test(String(dv?.attrs?.status || "")))
      .filter((dv) => { const ts = Date.parse(String(dv?.meta?.updatedAt || dv?.meta?.ts || dv?.attrs?.updatedAt || "")); return Number.isFinite(ts) && Date.now() - ts <= 14 * 86_400_000; })
      .slice(-40).reverse().map((dv) => ({ dv, reasons: ["Explorando la red"] }));
  }, [allLive, rankedItems, occasionalItems, networkMode]);
  const availableTopics = useMemo(() => ["Trabajo", "Comprar", "Vender", "Ayudar", "Entregas", "Oportunidades", "Este finde"]
    .filter((topic) => [...rankedItems, ...occasionalItems, ...exploreItems].some((item) => humanTopics(item.dv).includes(topic))), [rankedItems, occasionalItems, exploreItems]);
  const visibleItems = useMemo(() => {
    const pool = networkMode === "explore" ? [...rankedItems, ...occasionalItems, ...exploreItems] : networkMode === "mine" ? rankedItems.filter((item) => belongsToActor(item.dv, actor.id)) : [...rankedItems, ...occasionalItems];
    const territorialMode: TerritorialMode = networkMode === "nearby" || networkPreferences.onlyNear ? "nearby" : networkMode === "explore" ? "explore" : "for_me";
    return pool.filter((item) => {
      if (networkMode === "mine" || networkMode === "explore") return true;
      const relation = canRelate({ need: contextualNeed, capability: item.dv, mode: territorialMode });
      if (networkMode === "nearby") return relation.recommended && (relation.distanceKm != null || Boolean(actor.territoryId && String(item.dv?.attrs?.territoryId || "") === String(actor.territoryId)));
      return relation.recommended || (item.reasons.some((reason) => String(reason) === "También podría interesarte") && relation.distanceKm != null && relation.distanceKm <= 20) || belongsToActor(item.dv, actor.id);
    })
      .filter((item) => !topicFilter || humanTopics(item.dv).includes(topicFilter))
      .filter((item) => !networkPreferences.weekendWork || humanTopics(item.dv).includes("Este finde"))
      .sort((left, right) => networkMode === "nearby" ? (canRelate({ need: contextualNeed, capability: left.dv }).distanceKm ?? Infinity) - (canRelate({ need: contextualNeed, capability: right.dv }).distanceKm ?? Infinity) : 0)
      .slice(0, networkMode === "explore" ? 60 : 36);
  }, [rankedItems, occasionalItems, exploreItems, networkMode, networkPreferences, contextualNeed, actor.id, actor.territoryId, topicFilter]);
  const activityGroups = useMemo(() => groupLivingActivity(visibleItems, projectLivingNodes(allLive)).slice(0, 24), [visibleItems, allLive]);
  const firstOccasionalGroupId = useMemo(() => activityGroups.find((group) => occasionalItems.some((item) => item.dv?.id === group.representative?.id))?.id || "", [activityGroups, occasionalItems]);
  const discoverableProfiles = useMemo(
    () => projectLiveProfiles(allLive).filter((candidate) => candidate.id !== actor.id).slice(0, 8),
    [allLive, actor.id],
  );

  const requestApproximateLocation = () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setNotice("Este dispositivo no ofrece ubicación.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = approximateGeo(
          position.coords.latitude,
          position.coords.longitude,
        );
        setGeo(next);
        setLocating(false);
        setNotice(
          next
            ? "Zona aproximada lista. Nunca publicamos tu punto exacto."
            : "No se pudo interpretar la ubicación.",
        );
      },
      () => {
        setLocating(false);
        setNotice("No se compartió la ubicación. Podés continuar sin mapa.");
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 120000 },
    );
  };

  const saveProfile = async () => {
    if (!actor.id) {
      setNotice("Estamos preparando tu identidad privada.");
      return;
    }
    if (onPrivateIdentitySaved && (!identityDocument.trim() || !privateAddress.trim())) {
      setNotice("Completá documento y domicilio privado para continuar con esta operación.");
      return;
    }
    const capabilityLabels = capabilityText
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (profileSection !== "private" && !profileName.trim()) {
      setNotice("Escribí el nombre visible del perfil.");
      return;
    }
    setSavingIdentity(true);
    const profileDV = buildLiveProfileDV({
      actorId: actor.id,
      actorName: profileName,
      nodeId: actor.nodeId,
      bio: profileBio,
      avatar: profileAvatar,
      territoryId: actor.territoryId,
      capabilities: capabilityLabels.map((label) =>
        capabilityFromHumanText(label, "capacidad libre"),
      ),
      availableNow,
      serviceRadiusKm,
      workRangeKm,
      deliveryRangeKm,
      remote,
      pickup,
      onSite,
      geo,
    });
    try {
      if (profileSection !== "private") {
        await publishLiveNetworkDV(profileDV, { allLive, activeActor });
      }
      let verification = null;
      if (profileSection === "private") {
        const saved = await savePrivateLivingIdentity({ personal: { firstName, lastName, document: identityDocument, country: identityCountry, birthDate, address: privateAddress }, jurisdiction: identityJurisdiction || { country: identityCountry, region: identityCountry === "PY" ? "Canindeyú" : "" }, allLive, activeActor });
        verification = saved.verification;
      }
      setNotice(verification?.adultVerified ? "Identidad guardada · mayoría de edad verificada ✓" : verification ? `Identidad guardada · todavía no cumple la edad requerida (${verification.requiredAge}).` : "Perfil Vivo actualizado.");
      if (verification?.adultVerified) {
        sessionStorage.removeItem("utopy.identity.openPersonal");
        if (onPrivateIdentitySaved) { await onPrivateIdentitySaved(); return; }
        const pending = sessionStorage.getItem("skylines.pendingReservation");
        if (pending) { const returnTo = JSON.parse(pending)?.returnTo; if (returnTo) { window.location.assign(returnTo); return; } }
      }
    } catch (error: any) { setNotice(error?.message || "No se pudo guardar tu identidad."); }
    finally { setSavingIdentity(false); }
  };

  const publishSignal = async (draftText = signalText, selections: string[] = [], imageFile?: File) => {
    if (!actor.id) {
      setNotice("Estamos preparando tu identidad privada.");
      throw new Error("Identidad todavía no disponible");
    }
    if (!draftText.trim()) {
      setNotice("Contá brevemente qué necesitás, ofrecés o vendés.");
      throw new Error("Falta contar qué querés hacer");
    }
    const publishMeaning = interpretHumanSignal(draftText);
    if (imageFile && signalPrivacy.includes("noShare")) throw new Error("La imagen usa almacenamiento público. Quitala para guardar esta intención solo para vos.");
    let image = "";
    if (imageFile) {
      if (uploadedReference.current?.file === imageFile) image = uploadedReference.current.url;
      else { const attachments = await uploadConversationReferences([imageFile]); image = attachments[0].url; uploadedReference.current = { file: imageFile, url: image }; }
    }
    const linkedContext = allLive.find(dv => dv?.id === focusedId && dv?.meta?.scopes?.includes("public") && !dv.meta.scopes.some((scope: string) => ["private", "participants", "custodians"].includes(scope)));
    const signalDV = buildLiveSignalDV({
      actorId: actor.id,
      actorName: profileName || actor.name,
      nodeId: actor.nodeId,
      mode: publishMeaning.mode,
      text: draftText,
      image,
      threadId: linkedContext?.attrs?.threadId || linkedContext?.meta?.threadId || null,
      category: publishMeaning.frame.resource || "expresión abierta",
      price: null,
      currency: "PYG",
      territoryId: actor.territoryId,
      geo: signalPrivacy.includes("noLocationDisclosure") ? null : (() => { const position = geo || profile?.attrs?.geo; return position ? approximateGeo(Number(position.lat), Number(position.lng), "publication") : null; })(),
      scopes: signalPrivacy.includes("noShare") ? ["private"] : ["public"],
      originalAudioRef: voiceAudioRef,
      semanticFrame: { ...publishMeaning.frame, conditions: [...(publishMeaning.frame.conditions || []), ...selections] },
      privacyPolicies: signalPrivacy,
      persistence: rememberCapability ? "persistent" : "temporary",
    });
    if (linkedContext) { Object.assign(signalDV.attrs, { contextRef: linkedContext.id }); Object.assign(signalDV.meta, { respondsTo: linkedContext.id }); }
    const published = await publishLiveNetworkDV(signalDV, { allLive, activeActor });
    onDraftTextChange?.("");
    if (!signalPrivacy.includes("noAITraining")) rememberConfirmedMeaning(draftText, publishMeaning.frame);
    if (!signalPrivacy.includes("noShare")) {
      const frequency = buildFrequencyEvent({ kind: "frequency.start", reference: published, actorId: actor.id });
      await publishFrequencyEvent(frequency, [...allLive, published], activeActor);
    }
    if (rememberCapability && ["offer", "can", "share"].includes(publishMeaning.frame.direction)) {
      const existing = capabilityText.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
      const nextCapabilities = Array.from(new Set([...existing, publishMeaning.frame.resource || draftText]));
      const nextProfile = buildLiveProfileDV({ actorId: actor.id, actorName: profileName || actor.name, nodeId: actor.nodeId, bio: profileBio, avatar: profileAvatar, territoryId: actor.territoryId, capabilities: nextCapabilities.map((label) => capabilityFromHumanText(label, "capacidad libre")), availableNow, serviceRadiusKm, workRangeKm, deliveryRangeKm, remote, pickup, onSite, geo: geo || profile?.attrs?.geo || null });
      await publishLiveNetworkDV(nextProfile, { allLive: [...allLive, published], activeActor });
      setCapabilityText(nextCapabilities.join(", "));
    }
    setVoiceAudioRef(null);
    setRememberCapability(false);
    setNotice("✅ Señal Viva enviada. El mapa ya está buscando personas y nodos compatibles.");
    return published;
  };
  const speakSignal = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setNotice("Podés escribirlo: este navegador todavía no permite hablar."); return; }
    let recorder: MediaRecorder | null = null; const chunks: BlobPart[] = [];
    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({ audio: true });
      if (stream && typeof MediaRecorder !== "undefined") { recorder = new MediaRecorder(stream); recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); }; recorder.onstop = () => { const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" }); const reader = new FileReader(); reader.onload = () => setVoiceAudioRef(String(reader.result || "")); reader.readAsDataURL(blob); stream.getTracks().forEach((track) => track.stop()); }; recorder.start(); }
    } catch { /* El dictado puede continuar sin grabación. */ }
    const recognition = new SpeechRecognition(); recognition.lang = "es-PY"; recognition.interimResults = false;
    recognition.onresult = (event: any) => { changeSignalText(String(event.results?.[0]?.[0]?.transcript || "")); setNotice(""); };
    recognition.onerror = () => setNotice("No pude escucharte. Probá otra vez o escribilo.");
    recognition.onend = () => { if (recorder?.state === "recording") recorder.stop(); };
    recognition.start(); setNotice("Te escucho…");
  };
  const sendReply = async () => {
    if (!replyTarget) return;
    if (!actor.id) {
      setNotice("Tu identidad todavía no está lista para responder.");
      return;
    }
    const message =
      replyText.trim() ||
      (bookingAt
        ? "Quiero solicitar este horario."
        : "Quiero conversar sobre esta señal.");
    const result = buildLiveReplyDVs({
      actorId: actor.id,
      actorName: profileName || actor.name,
      nodeId: actor.nodeId,
      targetDV: replyTarget,
      message,
      bookingAt: bookingAt
        ? new Date(bookingAt).toISOString()
        : null,
    });
    await publishLiveNetworkMany([result.responseDV, result.messageDV], {
      allLive,
      activeActor,
      targetNodeId: replyTarget?.attrs?.nodeId || null,
    });
    setReplyTarget(null);
    setReplyText("");
    setBookingAt("");
    setNotice("Respuesta enviada. La otra parte todavía debe confirmar.");
    onOpenThread?.(result.threadId, result.responseDV);
  };

  const decideBooking = async (
    bookingDV: any,
    decision: "accepted" | "declined",
  ) => {
    if (!actor.id) {
      setNotice("Tu identidad todavía no está lista para confirmar el turno.");
      return;
    }
    const result = buildBookingDecisionDVs({
      actorId: actor.id,
      actorName: profileName || actor.name,
      nodeId: actor.nodeId,
      bookingDV,
      decision,
    });
    await publishLiveNetworkMany([result.statusDV, result.messageDV], {
      allLive,
      activeActor,
      targetNodeId: bookingDV?.attrs?.nodeId || null,
    });
    setNotice(
      decision === "accepted"
        ? "Turno confirmado y registrado en el hilo."
        : "Horario rechazado. La conversación queda abierta para otra propuesta.",
    );
    onOpenThread?.(result.threadId, result.statusDV);
  };


  return (
    <Shell $largeFeed={minimalEmbed && initialView === "feed"}>
            {!minimalEmbed ? <HeroWrap>
        <HeroCard>
          <HeroActionsBar>
            <HeroActionButton
              type="button"
              title="¿Cómo funciona?"
              onClick={() =>
                setNotice(
                  "🧭 Mirá el mapa, contá lo que necesitás y elegí una coincidencia. Los códigos técnicos quedan detrás.",
                )
              }
            >
              <CircleHelp size={18} />
            </HeroActionButton>
          </HeroActionsBar>

          <HeroProfileCenter>
            <HeroAvatarWrap>
              <HeroAvatarGlow />
              <HeroAvatar>
                <UserRound size={28} />
              </HeroAvatar>
            </HeroAvatarWrap>

            <HeroProfileText>
              <small>PERFIL VIVO</small>
              <strong>{profileName || actor.name || "Mi Perfil"}</strong>
              <span>Identidad Viva · actividad, relaciones y valor.</span>
            </HeroProfileText>
          </HeroProfileCenter>

          <HeroStatusRow>
            <HeroStatusPill>
              {profile ? "🟢 Perfil activo" : "👤 Completar perfil"}
            </HeroStatusPill>
            <HeroStatusPill>
              {context.focus ? "⚡ Señal activa" : "🧭 Explorando"}
            </HeroStatusPill>
            <HeroStatusPill>
              {geo ? "📍 Zona lista" : "🔒 Zona privada"}
            </HeroStatusPill>
          </HeroStatusRow>
        </HeroCard>

        <QuickNav>
          <QuickNavButton
            type="button"
            $active={view === "feed"}
            onClick={() => setView("feed")}
          >
            <QuickNavIcon $active={view === "feed"}>
              <MessageCircle size={16} />
            </QuickNavIcon>
            <span>Mi red</span>
          </QuickNavButton>
          <QuickNavButton type="button" $active={view === "cashier"} onClick={() => setView("cashier")}><QuickNavIcon $active={view === "cashier"}>💰</QuickNavIcon><span>Cobrar</span></QuickNavButton>

          <QuickNavButton
            type="button"
            $active={view === "publish"}
            onClick={() => setView("publish")}
          >
            <QuickNavIcon $active={view === "publish"}>
              <Send size={16} />
            </QuickNavIcon>
            <span>Decir</span>
          </QuickNavButton>

          <QuickNavButton
            type="button"
            $active={view === "profile"}
            onClick={() => setView("profile")}
          >
            <QuickNavIcon $active={view === "profile"}>
              <UserRound size={16} />
            </QuickNavIcon>
            <span>Perfil</span>
          </QuickNavButton>

          <QuickNavButton
            type="button"
            $active={view === "vault"}
            onClick={() => setView("vault")}
          >
            <QuickNavIcon $active={view === "vault"}>
              <BadgeCheck size={16} />
            </QuickNavIcon>
            <span>Mi Valor</span>
          </QuickNavButton>
        </QuickNav>
      </HeroWrap> : null}
      {notice ? (
        <Notice>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </Notice>
      ) : null}

      {view === "feed" ? (
        <ViewStage>
          <ViewIntro>
            <ViewIntroIcon>💬</ViewIntroIcon>
            <div>
              <strong>Mi red</strong>
            </div>
            <MiniPulse title="Red viva" aria-label="Red viva" />
          </ViewIntro>

          {!profile ? (
            <CompactPrompt>
              <div className="icon"><UserRound size={18} /></div>
              <div>
                <strong>Completá tu perfil</strong>
                <span>Ayuda a encontrar mejores coincidencias.</span>
              </div>
              <SmallAction type="button" onClick={() => setView("profile")}>
                Crear
              </SmallAction>
            </CompactPrompt>
          ) : null}

          {context.focus ? (
            <FocusPill>
              <span>⚡ {humanVisibleText(context.focus?.labels?.[0] || context.focus?.attrs?.title, "Tu publicación")}</span>
              <button type="button" onClick={() => onFocusDV?.(null)}>×</button>
            </FocusPill>
          ) : null}

          <FilterRow>{[["for_me", "Para mí"], ["nearby", "Cerca"], ["mine", "Mis nodos"], ["explore", "Explorar"]].map(([key, label]) => <FilterButton key={key} type="button" $active={networkMode === key} onClick={() => setNetworkMode(key as NetworkMode)}>{label}</FilterButton>)}</FilterRow>
          {availableTopics.length ? <FilterRow>{availableTopics.map((topic) => <FilterButton key={topic} type="button" $active={topicFilter === topic} onClick={() => setTopicFilter((current) => current === topic ? "" : topic)}>{topic}</FilterButton>)}</FilterRow> : null}
          <NetworkPreferences><summary>Preferencias</summary><div>
            <FilterButton type="button" $active={Boolean(networkPreferences.weekendWork)} onClick={() => setNetworkPreferences((current: any) => ({ ...current, weekendWork: !current.weekendWork }))}>Trabajos de fin de semana</FilterButton>
            <FilterButton type="button" $active={Boolean(networkPreferences.onlyNear)} onClick={() => setNetworkPreferences((current: any) => ({ ...current, onlyNear: !current.onlyNear }))}>Solo cerca mío</FilterButton>
            <FilterButton type="button" $active={networkPreferences.occasional !== false} onClick={() => setNetworkPreferences((current: any) => ({ ...current, occasional: current.occasional === false }))}>También oportunidades nuevas</FilterButton>
          </div></NetworkPreferences>

          {networkMode !== "mine" && discoverableProfiles.length ? <LivingNodesSection>
            <NetworkSectionTitle>Nodos vivos</NetworkSectionTitle>
            <LivingNodesRail>{discoverableProfiles.map((candidate) => <a key={candidate.id} href={`/${candidate.handle}`}><span>{candidate.avatar ? <img src={candidate.avatar} alt="" /> : humanVisibleText(candidate.name, "N").charAt(0)}</span><div><b>{humanVisibleText(candidate.name, "Nodo Vivo")}{candidate.verified ? " ✓" : ""}</b><small>{humanVisibleText(candidate.territory, "Ver Perfil Vivo")}</small></div></a>)}</LivingNodesRail>
          </LivingNodesSection> : null}

          <Feed>
            {activityGroups.length ? (
              activityGroups.map((group) => {
                const item = visibleItems.find((candidate) => candidate.dv?.id === group.representative?.id) || { dv: group.representative, reasons: [] };
                const card = humanizeLiveDV(item.dv);
                const own = belongsToActor(item.dv, actor.id);
                const incomingBooking =
                  item.dv?.kind === "booking.request" &&
                  targetsActor(item.dv, actor.id) &&
                  item.dv?.attrs?.status === "proposed";
                return (
                  <React.Fragment key={group.id}>
                  {group.id === firstOccasionalGroupId ? <NetworkSectionTitle>También podría interesarte</NetworkSectionTitle> : null}
                  <FeedCard>
                    <CardHead>
                      <CardType>
                        <i>{group.icon}</i>
                        {humanVisibleText(group.count > 1 ? group.detail : card.type, "Actividad")}
                      </CardType>
                      <Score>{own ? "Tuyo" : "Para vos"}</Score>
                    </CardHead>

                    {card.image ? <CardImage src={card.image} alt="" loading="lazy" decoding="async" /> : null}

                    <CardTitle>{humanVisibleText(group.count > 1 ? group.title : card.title, "Publicación viva")}</CardTitle>
                    <CardAuthor>{humanVisibleText(group.count > 1 ? group.detail : card.author, "Perfil Vivo")}</CardAuthor>

                    {card.price ? (
                      <CardPrice>{formatPrice(card.price, card.currency)}</CardPrice>
                    ) : null}

                    {item.reasons.length ? (
                      <ReasonRow>
                        {item.matchLabel ? <Reason>{item.matchLabel}</Reason> : null}
                        {item.reasons.slice(0, 2).map((reason) => (
                          <Reason key={reason}>{reason}</Reason>
                        ))}
                      </ReasonRow>
                    ) : null}

                    <CardActions>
                      <GhostButton type="button" onClick={() => onFocusDV?.(item.dv)}>
                        <MapPinned size={16} />
                        Mapa
                      </GhostButton>
                      {incomingBooking ? (
                        <>
                          <GhostButton type="button" onClick={() => decideBooking(item.dv, "declined")}>
                            Otro horario
                          </GhostButton>
                          <PrimaryButton type="button" onClick={() => decideBooking(item.dv, "accepted")}>
                            <CalendarClock size={16} />
                            Confirmar
                          </PrimaryButton>
                        </>
                      ) : !own ? (
                        <PrimaryButton
                          type="button"
                          onClick={() => {
                            setReplyTarget(item.dv);
                            setReplyText("");
                            setBookingAt("");
                          }}
                        >
                          <MessageCircle size={16} />
                          {card.action}
                        </PrimaryButton>
                      ) : null}
                    </CardActions>
                  </FeedCard>
                  </React.Fragment>
                );
              })
            ) : (
              <Empty>
                <Radio />
                <strong>Tu red está tranquila.</strong>
                <span>Decí qué necesitás o qué podés ofrecer.</span>
                <PrimaryButton type="button" onClick={() => setView("publish")}>
                  ⚡ Decir algo
                </PrimaryButton>
              </Empty>
            )}
          </Feed>
        </ViewStage>
      ) : null}

      {view === "publish" ? (
        <ViewStage>
          <GuidedIntentComposer
            text={signalText}
            onTextChange={changeSignalText}
            onSpeak={speakSignal}
            onCreate={publishSignal}
            allLive={allLive}
            privacyPolicies={signalPrivacy}
            onTogglePrivacy={(policy) => setSignalPrivacy((current) => current.includes(policy) ? current.filter((item) => item !== policy) : [...current, policy])}
            rememberCapability={rememberCapability}
            onToggleRemember={() => setRememberCapability((value) => !value)}
            onLocate={requestApproximateLocation}
            locationReady={Boolean(geo)}
            onShowMap={(dv) => { if (onFocusDV) onFocusDV(dv); else window.location.assign(`/market/mapa?focus=${encodeURIComponent(String(dv?.id || ""))}`); setSignalText(""); }}
            onShowResponses={dv => { changeSignalText(""); const threadId = dv?.attrs?.threadId || dv?.meta?.threadId; if (threadId && onOpenThread) onOpenThread(threadId, dv); else if (onPublishedResponses) onPublishedResponses(dv); else setView("feed"); }}
          />
        </ViewStage>
      ) : null}

      {view === "vault" ? (
        <ViewStage>
          <ViewIntro>
            <ViewIntroIcon>✨</ViewIntroIcon>
            <div>
              <strong>Mi Valor</strong>
              <span>Lo que construiste y lo que podés activar.</span>
            </div>
          </ViewIntro>
          <VaultSurface>
            <Suspense fallback={<MiniLoading>Abriendo Mi Valor…</MiniLoading>}>
              <BovedaVivaPanel allLive={allLive} actor={actor} />
            </Suspense>
          </VaultSurface>
        </ViewStage>
      ) : null}
      {view === "cashier" ? <ViewStage><LivingCashierPanel allLive={allLive} activeActor={activeActor} mode="full" /></ViewStage> : null}

      {view === "profile" ? (
        <ViewStage className="utopy-ui utopy-profile">
          <ViewIntro>
            <ViewIntroIcon>👤</ViewIntroIcon>
            <div>
              <strong>{onPrivateIdentitySaved ? "Solo falta tu identidad privada" : "Tu perfil, a tu manera"}</strong>
              <span>{onPrivateIdentitySaved ? "Completala aquí y seguí con tu operación." : "Lo público y lo privado, cada uno en su lugar."}</span>
            </div>
          </ViewIntro>

          {!onPrivateIdentitySaved ? <nav className="utopy-tabs" aria-label="Secciones de configuración">{([["public", "Perfil público"], ["resume", "Currículum"], ["work", "Disponibilidad"], ["private", "Datos privados"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={profileSection === key} onClick={() => setProfileSection(key)}>{label}</button>)}</nav> : null}
          <MinimalFormCard>
            {profileSection === "public" ? <>
            <DetailsBox>
              <strong>Foto del Perfil Vivo</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 72, height: 72, borderRadius: 24, overflow: "hidden", display: "grid", placeItems: "center", background: "#eef2ff", fontSize: 26 }}>{profileAvatar ? <img src={profileAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : (profileName.trim()[0] || "◈")}</span><label style={{ cursor: "pointer", fontWeight: 900, fontSize: 12 }}><Camera size={16}/> Cambiar foto<input hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setProfileAvatar(String(reader.result || "")); reader.readAsDataURL(file); }}/></label>{profileAvatar ? <SmallAction type="button" onClick={() => setProfileAvatar("")}>Quitar</SmallAction> : null}</div>
            </DetailsBox>
            <Label>
              Nombre visible
              <Input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Cómo querés aparecer en tu perfil público"
              />
            </Label>

            <Label>
              Sobre vos
              <Input
                value={profileBio}
                onChange={(event) => setProfileBio(event.target.value)}
                placeholder="Ej.: Trabajo con reserva y me muevo por mi zona"
              />
            </Label>

            <Label>
              ¿Qué podés hacer?
              <Textarea
                value={capabilityText}
                onChange={(event) => setCapabilityText(event.target.value)}
                placeholder="Ej.: Programación, carpintería, diseño, entregas…"
              />
            </Label>

            <p className="utopy-muted">Estos datos son públicos al guardar. Tu documento y fecha de nacimiento nunca se incluyen aquí.</p>
            </> : null}
            {profileSection === "resume" ? <LivingResumeEditor allLive={allLive} activeActor={activeActor} /> : null}
            {profileSection === "work" ? <>
            <ProfileOptions>
              <AvailabilityButton type="button" $active={availableNow} onClick={() => setAvailableNow((value) => !value)}>
                <Radio size={17} />
                {availableNow ? "Disponible ahora" : "Con reserva"}
              </AvailabilityButton>
            </ProfileOptions>

            <DetailsBox>
              <strong>¿Hasta dónde llegás?</strong>
              <Label>Trabajo · {workRangeKm} km<input aria-label="Radio de trabajo" type="range" min="0" max="150" step="5" value={workRangeKm} onChange={(event) => { const value = Number(event.target.value); setWorkRangeKm(value); setServiceRadiusKm(Math.max(value, deliveryRangeKm)); }}/></Label>
              <Label>Entrega · {deliveryRangeKm} km<input aria-label="Radio de entrega" type="range" min="0" max="150" step="5" value={deliveryRangeKm} onChange={(event) => { const value = Number(event.target.value); setDeliveryRangeKm(value); setServiceRadiusKm(Math.max(value, workRangeKm)); }}/></Label>
              <ProfileOptions><AvailabilityButton type="button" $active={pickup} onClick={() => setPickup((value) => !value)}>🏠 Retiro en local</AvailabilityButton><AvailabilityButton type="button" $active={onSite} onClick={() => setOnSite((value) => !value)}>🛠 Voy al cliente</AvailabilityButton><AvailabilityButton type="button" $active={remote} onClick={() => setRemote((value) => !value)}>🌎 Trabajo remoto</AvailabilityButton></ProfileOptions>
            </DetailsBox>

            <CompactLocation>
              <div>
                <strong>{geo ? "📍 Zona lista" : "🔒 Zona privada"}</strong>
                <span>{geo ? "Solo se comparte de forma aproximada." : "Podés usar UTOPY sin compartirla."}</span>
              </div>
              <SmallAction type="button" onClick={requestApproximateLocation} disabled={locating}>
                <LocateFixed size={15} />
                {locating ? "…" : geo ? "Actualizar" : "Usar zona"}
              </SmallAction>
            </CompactLocation>
            </> : null}
            {profileSection === "private" ? <>
            <DetailsBox>
              <strong>Identidad privada</strong>
              <span>Solo para procesos autorizados. Nunca aparece en Decir, Feed ni Mapa.</span>
              <ProfileOptions>
                <Label>Nombre legal<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Como aparece en tu documento" /></Label>
                <Label>Apellido<Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Tu apellido" /></Label>
                <Label>Documento / CI<Input value={identityDocument} onChange={(event) => setIdentityDocument(event.target.value)} placeholder="C.I." /></Label>
                <Label>País<Select value={identityCountry} onChange={(event) => setIdentityCountry(event.target.value)}><option value="PY">Paraguay</option><option value="BR">Brasil</option><option value="AR">Argentina</option><option value="OTHER">Otro</option></Select></Label>
                <Label>Fecha de nacimiento<Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></Label>
                <Label>Domicilio privado · para contratos<Input value={privateAddress} onChange={event => setPrivateAddress(event.target.value)} placeholder="Se comparte solo al confirmar una operación" /></Label>
              </ProfileOptions>
              <PrivacyNote>🔒 Los nodos reciben solamente la verificación mínima necesaria.</PrivacyNote>
            </DetailsBox>
            </> : null}
            {profileSection !== "resume" ? <StickyActions>
              <GhostButton type="button" onClick={() => onProfileDone ? onProfileDone() : setView("feed")}>Volver</GhostButton>
              <PrimaryButton type="button" onClick={saveProfile} disabled={savingIdentity}>{savingIdentity ? "Guardando…" : profileSection === "private" ? identityRequested || onPrivateIdentitySaved ? "Guardar y continuar" : "Guardar datos privados" : "Guardar perfil público"}</PrimaryButton>
            </StickyActions> : null}
          </MinimalFormCard>
        </ViewStage>
      ) : null}

      {replyTarget ? (
        <ReplyBox>
          <ReplyHead>
            <div>
              <small>Responder a</small>
              <strong>{humanizeLiveDV(replyTarget).title}</strong>
            </div>
            <IconButton type="button" onClick={() => setReplyTarget(null)}>
              <X size={17} />
            </IconButton>
          </ReplyHead>

          <Textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Escribí una propuesta o consulta breve"
          />

          {feedRole(replyTarget) === "offer" ? (
            <Label>
              <span>
                <CalendarClock size={15} /> Horario propuesto (opcional)
              </span>
              <Input
                type="datetime-local"
                value={bookingAt}
                onChange={(event) => setBookingAt(event.target.value)}
              />
            </Label>
          ) : null}

          <PrimaryButton type="button" onClick={sendReply}>
            <Send size={16} />
            {bookingAt ? "Solicitar turno" : "Enviar respuesta"}
          </PrimaryButton>
        </ReplyBox>
      ) : null}
    </Shell>
  );
}

const Shell = styled.section<{ $largeFeed?: boolean }>`
  display: grid;
  gap: 14px;
  color: #101915;
  ${({ $largeFeed }) => $largeFeed ? `
    article{border-radius:26px;padding:16px;box-shadow:0 18px 48px rgba(52,61,96,.1)}
    article > img{max-height:430px;aspect-ratio:1/1;object-fit:cover;border-radius:20px}
  ` : ""}
`;

const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding:14px;
  border-radius:24px;
  color:#fff;
  background:radial-gradient(circle at 85% 12%,rgba(34,211,238,.2),transparent 34%),radial-gradient(circle at 12% 100%,rgba(21,255,0,.17),transparent 38%),#0c1510;
  box-shadow:0 16px 46px rgba(15,23,42,.15);
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const LogoDot = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #052e16;
  background: linear-gradient(135deg, #5cff55, #b8ffbf);
  box-shadow: 0 12px 28px rgba(21, 255, 0, 0.2);
`;

const Title = styled.div`
  font-size: 20px;
  font-weight: 1000;
  letter-spacing: -0.04em;
`;

const Subtitle = styled.div`
  color: #b7c4bc;
  font-size: 12px;
`;

const TopActions = styled.div`
  display: flex;
  gap: 7px;
`;

const IconButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.08);
  color: #fff;
  cursor: pointer;
`;

const PrimaryButton = styled.button`
  min-height: 40px;
  border: 0;
  border-radius: 14px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #ffffff;
  background: var(--utopy-lavender, #7863c4);
  font: inherit;
  font-weight: 950;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const GhostButton = styled.button`
  min-height: 40px;
  border: 1px solid #dce5df;
  border-radius: 14px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #1d2b23;
  background: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const Nav = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  padding: 5px;
  border-radius: 17px;
  background: #eef3ef;
`;

const ValueProfileEntry = styled.div`
  border: 1px solid #d9e9dc;
  border-radius: 17px;
  padding: 11px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 9px;
  color: #18321f;
  background: linear-gradient(135deg, #effff1, #f9fffa);

  > svg {
    color: #1dbb31;
  }

  > div {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 12px;
  }

  span {
    color: #6c7870;
    font-size: 10px;
  }
`;

const NavButton = styled.button<{ $active?: boolean }>`
  min-height: 38px;
  border: 0;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: ${({ $active }) => ($active ? "#fff" : "transparent")};
  color: #142019;
  font: inherit;
  font-weight: 950;
  cursor: pointer;
  box-shadow: ${({ $active }) =>
    $active ? "0 8px 22px rgba(15,23,42,.08)" : "none"};
`;

const Notice = styled.div`
  border: 1px solid #cfe9d2;
  border-radius: 16px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #effcf0;
  color: #17451f;
  font-size: 12px;
  font-weight: 800;

  button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
`;

const ProfilePrompt = styled.div`
  border-radius: 20px;
  padding: 13px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 11px;
  background: linear-gradient(135deg, #ecfff0, #eef8ff);
  border: 1px solid #d7ecdc;

  > svg {
    color: #13a92e;
  }

  div {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 14px;
  }

  span {
    color: #66706a;
    font-size: 11px;
  }
`;

const ContextCard = styled.div`
  border-radius: 18px;
  padding: 11px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  color: #fff;
  background:
    radial-gradient(circle at 90% 10%, rgba(53,245,47,.26), transparent 38%),
    #101914;

  div {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  small {
    color: #9eb4a5;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: 900;
  }

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const FilterRow = styled.div`
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 2px;
`;
const NetworkPreferences = styled.details`
  summary{cursor:pointer;color:#65729a;font-size:12px;font-weight:800;list-style:none}
  summary::-webkit-details-marker{display:none}
  >div{display:flex;gap:7px;overflow-x:auto;padding:10px 0 2px}
`;

const FilterButton = styled.button<{ $active?: boolean }>`
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid ${({ $active }) => ($active ? "#8998e8" : "#e3e8f5")};
  background: ${({ $active }) => ($active ? "#e7e9ff" : "#fff")};
  color: ${({ $active }) => ($active ? "#4553a3" : "#425173")};
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
`;

const Feed = styled.div`
  display: grid;
  gap: 10px;
`;
const NetworkSectionTitle = styled.h3`
  margin:12px 2px 2px;color:#52618e;font-size:13px;font-weight:850;
`;
const LivingNodesSection = styled.section`display:grid;gap:8px;min-width:0;`;
const LivingNodesRail = styled.div`
  display:flex;gap:11px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity;
  a{min-width:190px;max-width:220px;padding:12px;border:1px solid rgba(110,120,178,.14);border-radius:21px;background:rgba(255,255,255,.82);color:inherit;text-decoration:none;display:flex;align-items:center;gap:11px;scroll-snap-align:start;box-shadow:0 9px 24px rgba(57,67,110,.06)}
  a>span{width:48px;height:48px;flex:0 0 auto;border:3px solid white;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#d7ddff,#eadcff);color:#5362ae;font-size:18px;font-weight:900;box-shadow:0 7px 18px rgba(70,83,158,.14)}
  img{width:100%;height:100%;object-fit:cover}div{min-width:0;display:grid;gap:3px}b,small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}b{font-size:13px}small{color:#75809d;font-size:11px}
`;

const FeedCard = styled.article`
  border: 1px solid #e0e7e2;
  border-radius: 20px;
  padding: 13px;
  display: grid;
  gap: 8px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06);
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CardType = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  color: #4f5f56;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  i {
    width: 26px;
    height: 26px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    background: #edfff0;
    font-style: normal;
  }
`;

const Score = styled.span`
  border-radius: 999px;
  padding: 4px 7px;
  background: #f0f3f1;
  color: #647168;
  font-size: 10px;
  font-weight: 950;
`;

const CardImage = styled.img`
  width: 100%;
  max-height: 160px;
  border-radius: 15px;
  object-fit: cover;
  background: #f0f3f1;
`;

const CardTitle = styled.div`
  font-size: 17px;
  line-height: 1.15;
  font-weight: 1000;
  letter-spacing: -0.025em;
`;

const CardAuthor = styled.div`
  color: #66736b;
  font-size: 12px;
`;

const CardPrice = styled.div`
  color: #123b1a;
  font-size: 15px;
  font-weight: 1000;
`;

const ReasonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const Reason = styled.span`
  border-radius: 999px;
  padding: 5px 8px;
  color: #31503a;
  background: #edf8ef;
  font-size: 10px;
  font-weight: 850;
`;

const CardActions = styled.div`
  display: flex;
  gap: 7px;
  flex-wrap: wrap;

  > button {
    flex: 1 1 125px;
  }
`;

const Empty = styled.div`
  min-height: 240px;
  border: 1px dashed #cfdbd2;
  border-radius: 22px;
  padding: 22px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 9px;
  text-align: center;
  color: #66736b;
  background: #f8faf8;

  > svg {
    color: #31d63b;
  }

  strong {
    color: #18221c;
  }

  span {
    max-width: 330px;
    font-size: 12px;
    line-height: 1.45;
  }
`;

const FormCard = styled.div`
  border: 1px solid #dfe7e1;
  border-radius: 22px;
  padding: 15px;
  display: grid;
  gap: 14px;
  background: #fff;
`;

const FormTitle = styled.div`
  font-size: 21px;
  font-weight: 1000;
  letter-spacing: -0.035em;
`;

const FormHint = styled.div`
  margin-top: -8px;
  color: #66736b;
  font-size: 12px;
  line-height: 1.45;
`;

const ModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
`;

const ModeButton = styled.button<{ $active?: boolean }>`
  min-height: 48px;
  border-radius: 15px;
  border: 1px solid ${({ $active }) => ($active ? "#36e442" : "#dce5df")};
  background: ${({ $active }) => ($active ? "#eaffed" : "#fff")};
  color: #17221b;
  font: inherit;
  font-size: 12px;
  font-weight: 950;
  cursor: pointer;
`;

const Label = styled.label`
  display: grid;
  gap: 7px;
  color: #2a3830;
  font-size: 12px;
  font-weight: 900;

  > span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;

const Input = styled.input`
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid #d9e2dc;
  border-radius: 14px;
  padding: 0 12px;
  background: #fbfcfb;
  color: #111914;
  font: inherit;
  outline: none;

  &:focus {
    border-color: #45d84d;
    box-shadow: 0 0 0 3px rgba(53, 245, 47, 0.12);
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 88px;
  box-sizing: border-box;
  resize: vertical;
  border: 1px solid #d9e2dc;
  border-radius: 15px;
  padding: 11px 12px;
  background: #fbfcfb;
  color: #111914;
  font: inherit;
  line-height: 1.4;
  outline: none;

  &:focus {
    border-color: #45d84d;
    box-shadow: 0 0 0 3px rgba(53, 245, 47, 0.12);
  }
`;

const Select = styled.select`
  width: 100%;
  min-height: 44px;
  border: 1px solid #d9e2dc;
  border-radius: 14px;
  padding: 0 10px;
  background: #fbfcfb;
  color: #111914;
  font: inherit;
`;

const CategoryGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const CategoryButton = styled.button<{ $active?: boolean }>`
  min-height: 34px;
  border-radius: 999px;
  border: 1px solid ${({ $active }) => ($active ? "#3adf43" : "#dbe4de")};
  padding: 0 10px;
  background: ${({ $active }) => ($active ? "#edffef" : "#fff")};
  color: #25332a;
  font: inherit;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
`;

const TwoColumns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 9px;

  @media (max-width: 540px) {
    grid-template-columns: 1fr;
  }
`;

const AvailabilityButton = styled.button<{ $active?: boolean }>`
  align-self: end;
  min-height: 44px;
  border-radius: 14px;
  border: 1px solid ${({ $active }) => ($active ? "#35db3e" : "#d9e2dc")};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: ${({ $active }) => ($active ? "#edffef" : "#fbfcfb")};
  color: #17231b;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
`;

const LocationRow = styled.div`
  border: 1px solid #e0e7e2;
  border-radius: 16px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  background: #f8faf8;

  > div {
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 12px;
  }

  span {
    color: #6c7870;
    font-size: 10px;
  }
`;

const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;


const SignalHero = styled.div`
  display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:center;padding:13px;border-radius:18px;color:#fff;background:linear-gradient(140deg,#103c20,#111827);
  >span{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:#4cff58;color:#0a2d13;font-size:24px}
  small{font-size:8px;font-weight:950;letter-spacing:.08em;color:#86efac}
`;
const MeaningCard = styled.div`border:1px solid #bde9c4;border-radius:15px;padding:11px 12px;background:#effcf1;display:grid;gap:3px;strong{font-size:12px;color:#174e22}span{font-size:9px;color:#637168}`;
const SimpleChoices = styled.div`display:grid;grid-template-columns:repeat(2,1fr);gap:7px;`;
const DetailsToggle = styled.button`border:1px solid #e0e6e1;background:#fff;border-radius:13px;padding:10px 12px;text-align:left;font-size:10px;font-weight:900;color:#5b675f;cursor:pointer;`;
const DetailsBox = styled.div`display:grid;gap:10px;padding:11px;border-radius:15px;background:#f7f9f7;border:1px solid #e3e8e4;`;
const PrivacyNote = styled.div`font-size:9px;color:#68746b;line-height:1.4;padding:0 2px;`;
const ReplyBox = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 5;
  border: 1px solid #d8e5da;
  border-radius: 22px;
  padding: 13px;
  display: grid;
  gap: 10px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 -20px 60px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(16px);
`;

const ReplyHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  > div {
    display: grid;
    gap: 1px;
  }

  small {
    color: #718078;
    font-size: 10px;
    text-transform: uppercase;
  }

  strong {
    font-size: 13px;
  }
`;
const HeroWrap = styled.div`
  display: grid;
  gap: 10px;
`;

const HeroCard = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  padding: 14px 14px 12px;
  color: #fff;
  background:
    radial-gradient(circle at 20% 0%, rgba(76, 255, 88, 0.14), transparent 30%),
    radial-gradient(circle at 85% 12%, rgba(34, 211, 238, 0.18), transparent 34%),
    radial-gradient(circle at 50% 100%, rgba(76, 255, 88, 0.08), transparent 36%),
    linear-gradient(160deg, #09110d 0%, #10231a 55%, #0d1712 100%);
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.06);
`;

const HeroActionsBar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const HeroActionButton = styled.button`
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  cursor: pointer;
  backdrop-filter: blur(8px);
`;

const HeroProfileCenter = styled.div`
  margin-top: 2px;
  display: grid;
  justify-items: center;
  gap: 10px;
  text-align: center;
`;

const HeroAvatarWrap = styled.div`
  position: relative;
  width: 94px;
  height: 94px;
  display: grid;
  place-items: center;
`;

const HeroAvatarGlow = styled.div`
  position: absolute;
  inset: 8px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(76, 255, 88, 0.22), transparent 70%);
  filter: blur(12px);
`;

const HeroAvatar = styled.div`
  position: relative;
  z-index: 1;
  width: 78px;
  height: 78px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #07220f;
  background: linear-gradient(135deg, #5cff55 0%, #c4ffcf 100%);
  box-shadow:
    0 18px 30px rgba(39, 255, 79, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
`;

const HeroProfileText = styled.div`
  display: grid;
  gap: 4px;

  small {
    color: #95dba0;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.12em;
  }

  strong {
    font-size: 24px;
    line-height: 1;
    font-weight: 1000;
    letter-spacing: -0.04em;
  }

  span {
    color: #c0d0c7;
    font-size: 12px;
    line-height: 1.4;
  }
`;

const HeroStatusRow = styled.div`
  margin-top: 12px;
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 2px;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const HeroStatusPill = styled.div`
  flex: 0 0 auto;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  color: #eef7f0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 850;
  backdrop-filter: blur(8px);
`;

const QuickNav = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 6px;
  border-radius: 20px;
  background: #eef3ef;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);

  @media (max-width: 420px) {
    gap: 6px;
    padding: 5px;
  }
`;

const QuickNavButton = styled.button<{ $active?: boolean }>`
  min-height: 66px;
  border: 0;
  border-radius: 16px;
  padding: 8px 6px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 6px;
  background: ${({ $active }) =>
    $active
      ? "linear-gradient(180deg, #ffffff 0%, #f8fbf8 100%)"
      : "transparent"};
  color: ${({ $active }) => ($active ? "#101914" : "#506158")};
  font: inherit;
  font-size: 11px;
  font-weight: 950;
  cursor: pointer;
  box-shadow: ${({ $active }) =>
    $active ? "0 10px 24px rgba(15, 23, 42, 0.08)" : "none"};
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;

  &:hover {
    transform: translateY(-1px);
  }

  span {
    line-height: 1.1;
  }
`;

const QuickNavIcon = styled.div<{ $active?: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: ${({ $active }) =>
    $active
      ? "linear-gradient(135deg, #5cff55, #c4ffcf)"
      : "#dfe8e2"};
  color: ${({ $active }) => ($active ? "#06220d" : "#425249")};
  box-shadow: ${({ $active }) =>
    $active ? "0 10px 22px rgba(53, 245, 47, 0.18)" : "none"};
`;

/* ─────────────────────────────────────────────
   UTOPY · vistas inferiores minimalistas
   Solo presentación. No cambia lógica/protocolos.
───────────────────────────────────────────── */
const ViewStage = styled.div`
  display: grid;
  gap: 10px;
  min-width: 0;
`;

const ViewIntro = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 2px 2px 4px;
  min-width: 0;

  > div:nth-child(2) {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  strong {
    font-size: 18px;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: #122018;
  }

  span {
    color: #6b786f;
    font-size: 11px;
    line-height: 1.35;
  }
`;

const ViewIntroIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #eaffed, #f6fff7);
  border: 1px solid #d6ebda;
  font-size: 18px;
`;

const MiniPulse = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #35f52f;
  box-shadow: 0 0 0 6px rgba(53, 245, 47, 0.11);
`;

const CompactPrompt = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 9px;
  align-items: center;
  border: 1px solid #dce8df;
  border-radius: 18px;
  padding: 10px;
  background: linear-gradient(135deg, #f5fff6, #fbfffc);

  .icon {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: #0b3515;
    background: #baffc0;
  }

  > div:nth-child(2) { display: grid; gap: 2px; min-width: 0; }
  strong { font-size: 12px; }
  span { font-size: 10px; color: #6d7971; }
`;

const SmallAction = styled.button`
  min-height: 34px;
  border: 1px solid #d9e4dc;
  border-radius: 12px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #15241a;
  background: #fff;
  font: inherit;
  font-size: 10px;
  font-weight: 950;
  cursor: pointer;
`;

const FocusPill = styled.div`
  min-width: 0;
  border: 1px solid #d9e7dc;
  border-radius: 999px;
  padding: 7px 8px 7px 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #23402a;
  background: #f4fff5;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 900;
  }

  button {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 999px;
    background: #e7f3e9;
    color: #36513d;
    cursor: pointer;
  }
`;

const SignalHeroCompact = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 23px;
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 11px;
  color: #fff;
  background:
    radial-gradient(circle at 85% 15%, rgba(76,255,88,.18), transparent 34%),
    linear-gradient(145deg, #0b2515, #111a16);

  .signal-icon {
    width: 48px;
    height: 48px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    color: #06230d;
    background: linear-gradient(135deg, #5cff55, #c8ffd0);
    font-size: 23px;
  }

  > div:last-child { display: grid; gap: 2px; min-width: 0; }
  small { color: #8fe69b; font-size: 8px; font-weight: 950; letter-spacing: .1em; }
  strong { font-size: 19px; line-height: 1.05; letter-spacing: -.035em; }
  span { color: #bed0c3; font-size: 10px; }
`;

const MinimalFormCard = styled.div`
  border: 1px solid #dfe8e2;
  border-radius: 22px;
  padding: 13px;
  display: grid;
  gap: 12px;
  background: #fff;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.045);
`;

const MeaningStrip = styled.div`
  border: 1px solid #ccebd1;
  border-radius: 14px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #194723;
  background: #f0fff2;

  strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }
`;

const StickyActions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
  gap: 8px;

  > button { width: 100%; }
`;

const ProfileOptions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(130px, .72fr);
  gap: 8px;

  @media (max-width: 420px) {
    grid-template-columns: 1fr;
  }
`;

const ProfileOption = styled.label`
  display: grid;
  gap: 6px;
  color: #34423a;
  font-size: 10px;
  font-weight: 900;
`;

const CompactLocation = styled.div`
  border: 1px solid #e0e7e2;
  border-radius: 17px;
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  background: #f8faf8;

  > div { display: grid; gap: 2px; min-width: 0; }
  strong { font-size: 11px; }
  span { color: #728078; font-size: 9px; line-height: 1.35; }
`;

const VaultSurface = styled.div`
  min-width: 0;
  overflow: hidden;
  border-radius: 22px;

  /* Evita desbordes de contenido interno sin alterar su lógica. */
  & *, & *::before, & *::after {
    min-width: 0;
    box-sizing: border-box;
  }

  img, svg, canvas { max-width: 100%; }
`;

const MiniLoading = styled.div`
  min-height: 130px;
  border: 1px dashed #d4dfd7;
  border-radius: 20px;
  display: grid;
  place-items: center;
  color: #69776e;
  background: #f8faf8;
  font-size: 11px;
  font-weight: 900;
`;
