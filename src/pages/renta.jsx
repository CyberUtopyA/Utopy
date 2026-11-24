import "@google/model-viewer";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  Image as ImageIcon,
  Mail,
  Maximize,
  Share2,
  UserRound,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { verifiedRentalIdentityFields } from "../mt/rentalIdentity";
import Sidebar from "../components/sidebar";
import { asRentalMoneyNumber, buildRentalContractDraft, formatRentalMoney, rentalMonthlyPrice } from "../utils/rentalProperty";
import { mtLiveSnapshot, mtLiveSubscribe } from "../mt/mt.liveStore";
import { createPendingIdentityReservation, createRentalHold, projectRentalProperties, requireVerifiedAdult, resolveRentalActorRole, setRentalUnitAvailability } from "../mt/rental.domain";
import { ensureSkylinesRentalIdentityReady } from "../mt/skylines.rentals";
import { verifyAdultForJurisdiction } from "../utopy/identityPersonal";
const PrivateIdentityEditor = lazy(() => import("../social/LiveNetworkPanel"));

const PROFILE_KEY = "authUser";

const toDate = (v) => new Date(v + "T00:00:00");

const addMonths = (dateStr, months) => {
  const d = toDate(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};
const getLatLng = (locationValue) => {
  if (Array.isArray(locationValue) && locationValue.length >= 2) {
    const lat = Number(locationValue[0]);
    const lng = Number(locationValue[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  if (locationValue && typeof locationValue === "object") {
    const lat = Number(locationValue.lat);
    const lng = Number(locationValue.lng ?? locationValue.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
};
const buildMapQuery = ({ address, city, name }) => {
  return [address, city, name]
    .filter(Boolean)
    .join(", ")
    .trim();
};

const openGoogleMaps = ({ location, address, city, name }) => {
  const coords = getLatLng(location);

  if (!coords) {
    return;
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

const openWaze = ({ location }) => {
  const coords = getLatLng(location);

  if (!coords) {
    return;
  }

  const url = `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
  window.open(url, "_blank", "noopener,noreferrer");
};
const diffMonths = (start, end) => {
  const s = toDate(start);
  const e = toDate(end);
  return (
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  );
};

const normalizeText = (value) => {
  return decodeURIComponent(String(value ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const getRentalList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rentals)) return data.rentals;
  if (Array.isArray(data?.properties)) return data.properties;
  return [];
};

const uniquePhotos = (...items) => {
  const flat = items
    .flat(Infinity)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  return Array.from(new Set(flat));
};

  const buildRoomStateFromProperty = (property, room) => {
  return {
    room: {
      ...room,
      photos: uniquePhotos(room?.photos || [], property?.photos || [], property?.image || ""),
    },
    name: property?.name || property?.title || "Propiedad",
    price: room?.price ?? property?.price,
    image: room?.image || room?.photos?.[0] || property?.image || "",
    description: room?.description || property?.description || "",
    propertyId: property?.id,
    owner: property?.owner_id || property?.ownerId || property?.owner,
    currency: room?.currency || property?.currency || "PYG",
    address: property?.address || "",
    city: property?.city || "",
    propertyLocation: property?.location || null,
    ownerRaw: property?.ownerRaw || null,
  };
};

function RoomDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const insideFalcon = location.pathname.startsWith("/falcon/");

  const urlPropertyId = params.propertyId;
  const urlRoomNumber = params.roomNumber || params.roomId || params.pieza;

  const [rawRoomState, setRawRoomState] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [rawError, setRawError] = useState("");

  const pageState = rawRoomState ? {...location.state,...rawRoomState,ownerRaw:rawRoomState.ownerRaw||location.state?.ownerRaw} : location.state || {};

 const {
  room,
  name,
  price,
  image,
  description,
  propertyId,
  owner,
  currency,
  address,
  city,
  propertyLocation,
} = pageState;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAR, setShowAR] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [shareStatus, setShareStatus] = useState("");
  const [flowError, setFlowError] = useState("");
  const [identityGate, setIdentityGate] = useState(null);
  const [inlineIdentity, setInlineIdentity] = useState(false);
  const [reservationActor, setReservationActor] = useState(null);
  const directReservationStarted = useRef(false);
  const [canManageRental,setCanManageRental]=useState(false);
  const [availabilityBusy,setAvailabilityBusy]=useState(false);
  useEffect(()=>{
    let active=true,revision=0;
    const refresh=async()=>{const request=++revision;setCanManageRental(false);try{const access=await resolveRentalActorRole(mtLiveSnapshot(),String(owner||''));if(active&&request===revision)setCanManageRental(['landlord','authorized_admin'].includes(access.role));}catch{}};
    void refresh();const unsubscribe=mtLiveSubscribe(()=>void refresh());
    window.addEventListener('utopy.wallet.changed',refresh);
    return()=>{active=false;revision++;unsubscribe();window.removeEventListener('utopy.wallet.changed',refresh);};
  },[owner]);
  const changeAvailability=async()=>{
    if(availabilityBusy)return;
    if(!window.confirm(room?.available?'¿Pausar la disponibilidad de esta unidad?':'¿Publicar esta unidad como disponible?'))return;
    setAvailabilityBusy(true);setFlowError('');
    try{await setRentalUnitAvailability({propertyId:String(propertyId),unitId:String(room?.id||room?.roomId||room?.number||''),ownerId:String(owner||''),expectedRevision:Number(room?.revision??0),available:!room?.available});}
    catch(error){setFlowError(error?.message||'No se pudo cambiar la disponibilidad.');}
    finally{setAvailabilityBusy(false);}
  };

  const [tenantName, setTenantName] = useState("");
  const [tenantCI, setTenantCI] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");

  const prefillPrivateIdentity = async () => {
    const allLive = mtLiveSnapshot();
    const role = await resolveRentalActorRole(allLive, String(owner || ""));
    const fields = await verifiedRentalIdentityFields(allLive, role.identity.actorId);
    if (fields) { setTenantName(fields.name); setTenantCI(fields.document); setTenantAddress(fields.address); }
  };

  useEffect(() => {
    const pending = sessionStorage.getItem("skylines.pendingReservation");
    if (!pending) return;
    try {
      const value = JSON.parse(pending);
      const currentUnitId = String(room?.id || room?.roomId || room?.number || "");
      if (value?.propertyId !== String(propertyId) || value?.unitId !== currentUnitId) return;
      void (async () => {
        const allLive = mtLiveSnapshot();
        const role = await resolveRentalActorRole(allLive, String(owner || ""));
        const adult = await verifyAdultForJurisdiction(allLive, role.identity.actorId, { country: "PY", region: "Canindeyú", city: "Salto del Guairá" });
        if (adult.verified) { await prefillPrivateIdentity(); sessionStorage.removeItem("skylines.pendingReservation"); setIdentityGate(null); setShowModal(true); }
      })();
    } catch {}
  }, [owner, propertyId, room?.id, room?.number, room?.roomId]);

  useEffect(() => {
    const livePropertyId = urlPropertyId || location.state?.propertyId;
    const liveRoomNumber = urlRoomNumber || location.state?.room?.number;
    if (!livePropertyId || liveRoomNumber == null) return;

    const loadRoomFromLive = (allLive) => {
        setRawError("");
        setLoadingRoom(true);
        const property = projectRentalProperties(allLive).find(
          (item) => normalizeText(item?.id) === normalizeText(livePropertyId)
        );

        if (!property) {
          setRawError("No se encontró la propiedad viva.");
          setLoadingRoom(false);
          return;
        }

        const wantedRoom = normalizeText(liveRoomNumber);

        const foundRoom = (property?.rooms || []).find((r) => {
          const roomNumber = normalizeText(r?.number);
          const roomLabel = normalizeText(`Pieza ${r?.number}`);
          return roomNumber === wantedRoom || roomLabel === wantedRoom;
        });

        if (!foundRoom) {
          setRawError("No se encontró esta unidad viva.");
          setLoadingRoom(false);
          return;
        }
        setRawRoomState(buildRoomStateFromProperty(property, foundRoom));
        setLoadingRoom(false);
    };
    loadRoomFromLive(mtLiveSnapshot());
    return mtLiveSubscribe(loadRoomFromLive);
  }, [location.state, urlPropertyId, urlRoomNumber]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [room?.number, propertyId]);


  const effectivePrice = useMemo(() => {
    return (
      asRentalMoneyNumber(room?.price) ??
      asRentalMoneyNumber(room?.monthly_price) ??
      asRentalMoneyNumber(room?.precio) ??
      asRentalMoneyNumber(price)
    );
  }, [room, price]);

  const effectiveCurrency = useMemo(() => {
    return room?.currency || room?.moneda || currency || "PYG";
  }, [room, currency]);

  const selectedMonths = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    return diffMonths(startDate, endDate);
  }, [startDate, endDate]);

  const reservationPrice = useMemo(
    () => rentalMonthlyPrice(room, selectedMonths) ?? effectivePrice,
    [room, selectedMonths, effectivePrice],
  );

  const roomPhotos = useMemo(() => {
    return uniquePhotos(room?.image, room?.photos || [], image);
  }, [room, image]);

  const roomMainImage = useMemo(() => {
    return roomPhotos[activePhotoIndex] || roomPhotos[0] || image || "";
  }, [roomPhotos, activePhotoIndex, image]);
  const roomVideo = useMemo(() => {
    const value = String(room?.video || "").trim();
    if (/^\/media\/[a-zA-Z0-9/_.-]+\.mp4$/.test(value) && !value.includes("..")) return value;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
  }, [room?.video]);

  const roomLabel = useMemo(() => {
    if (room?.number === "Salón") return "Salón";
    return `Pieza ${room?.number ?? ""}`.trim();
  }, [room]);
const mapPayload = useMemo(
  () => ({
    location:
      propertyLocation ||
      pageState?.location ||
      pageState?.property?.location ||
      room?.location ||
      null,
    address,
    city,
    name,
  }),
  [propertyLocation, pageState, room, address, city, name]
);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";

    const finalPropertyId = propertyId || urlPropertyId || "";
    const finalRoomNumber = room?.number || urlRoomNumber || "";

    if (!finalPropertyId || !finalRoomNumber) {
      return window.location.href;
    }

    return `${window.location.origin}/propiedad/${encodeURIComponent(
      finalPropertyId
    )}/pieza/${encodeURIComponent(String(finalRoomNumber))}`;
  }, [propertyId, urlPropertyId, room, urlRoomNumber]);

  const goPhoto = (direction) => {
    if (!roomPhotos.length) return;
    setActivePhotoIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return roomPhotos.length - 1;
      if (next >= roomPhotos.length) return 0;
      return next;
    });
  };

  const handleShareRoom = async () => {
    try {
      const title = `${name || "Skylines"} · ${roomLabel}`;
      const text = `${roomLabel} en ${name || "Skylines"} · ${formatRentalMoney(
        effectivePrice,
        effectiveCurrency
      )}`;

      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setShareStatus("Enlace copiado");

      window.setTimeout(() => {
        setShareStatus("");
      }, 1800);
    } catch (err) {
      console.error("No se pudo compartir:", err);
    }
  };

  const handleCreateContract = async () => {
    if (!room?.available) {
      setIdentityGate({ title: "Unidad no disponible", message: "Esta unidad ya no está disponible para un contrato nuevo.", action: null });
      return;
    }
    try {
      setFlowError("");
      await ensureSkylinesRentalIdentityReady();
      const allLive = mtLiveSnapshot();
      const actorRole = await resolveRentalActorRole(allLive, String(owner || ""));
      if (!["landlord", "authorized_admin"].includes(actorRole.role)) {
        setIdentityGate({ title: "Acción administrativa", message: "Crear un contrato para otra persona requiere permiso del propietario o de un administrador autorizado. Para vos, usá “Reservar entrada”.", action: null });
        return;
      }
      const unitId = String(room?.id || room?.roomId || room?.number || "");
      let privateRegistry = {};
      try { privateRegistry = JSON.parse(localStorage.getItem("skylines.owner.registry") || "{}"); } catch {}
      const liveOwner = allLive.find((item) => item?.kind === "skylines.owner.profile" && String(item?.id) === String(owner));
      const ownerData = pageState?.ownerRaw || liveOwner?.attrs || privateRegistry?.[owner] || {};
      if (!ownerData?.nombreCompleto || !ownerData?.documento) throw new Error("No se pudo verificar la relación privada entre esta propiedad y su propietario.");
      const draft = buildRentalContractDraft({
        property: {
          id: propertyId,
          name,
          address,
          city,
          description,
          location: pageState?.location || propertyLocation || null,
        },
        room: { ...room, price: room?.contractPrice ?? room?.longTermPrice ?? effectivePrice, currency: effectiveCurrency },
        owner: ownerData,
      });
      draft.rental = { contractId: `rental.contract:${crypto.randomUUID()}`, propertyId, unitId, ownerId: owner, landlordActorId: liveOwner?.attrs?.actorId || liveOwner?.attrs?.issuerActorId || owner, expectedRevision: Number(room?.revision || 1) };
      localStorage.setItem("contratoDraft", JSON.stringify(draft));
      navigate("/contrato");
    } catch (error) {
      console.error("No se pudo preparar el contrato de alquiler:", error);
      setIdentityGate({ title: "No pudimos preparar el contrato", message: error?.message || "La identidad privada no está lista.", action: "retry-owner" });
    }
  };

  const beginSelfReservation = async () => {
    if (!room?.available) { setIdentityGate({ title: "Unidad no disponible", message: "Esta unidad ya está ocupada o reservada por otra operación.", action: null }); return; }
    const allLive = mtLiveSnapshot();
    const actorRole = await resolveRentalActorRole(allLive, String(owner || ""));
    setReservationActor(actorRole.identity);
    const adult = await verifyAdultForJurisdiction(allLive, actorRole.identity.actorId, { country: "PY", region: "Canindeyú", city: "Salto del Guairá" });
    if (adult.verified) { await prefillPrivateIdentity(); setFlowError(""); setShowModal(true); return; }
    const unitId = String(room?.id || room?.roomId || room?.number || "");
    await createPendingIdentityReservation({ propertyId: String(propertyId), unitId, allLive });
    sessionStorage.setItem("skylines.pendingReservation", JSON.stringify({ propertyId: String(propertyId), unitId, returnTo: location.pathname + location.search }));
    setIdentityGate({ title: "Identidad necesaria", message: "Para reservar esta unidad necesitás una Identidad Viva con mayoría de edad verificada. No compartiremos tu fecha de nacimiento con la propiedad.", action: "verify" });
  };

  useEffect(() => {
    if (!location.state?.reserveDirect || !room || directReservationStarted.current) return;
    directReservationStarted.current = true;
    void beginSelfReservation().catch((error) => setIdentityGate({ title: "No pudimos iniciar la reserva", message: error?.message || "Intentá de nuevo.", action: null }));
  }, [location.state?.reserveDirect, room]);

  const handleConfirmRent = async () => {
    if (!startDate || !endDate) {
      setFlowError("Seleccioná fecha de inicio y fin.");
      return;
    }

    if (!tenantName.trim()) {
      setFlowError("Ingresá el nombre del inquilino.");
      return;
    }

    if (!tenantCI.trim()) {
      setFlowError("Ingresá la Cédula de Identidad.");
      return;
    }

    if (!tenantAddress.trim()) {
      setFlowError("Ingresá el domicilio.");
      return;
    }

    if (room?.number == null || room?.number === "") {
      setFlowError("La unidad no está disponible.");
      return;
    }

    if (room?.available === false) {
      setFlowError("Esta unidad dejó de estar disponible.");
      return;
    }

    if (endDate < startDate) {
      setFlowError("La fecha final no puede ser anterior al inicio.");
      return;
    }

    const meses = diffMonths(startDate, endDate);
    if (meses < 6) {
      setFlowError("El contrato debe ser de al menos 6 meses.");
      return;
    }


    if (typeof reservationPrice !== "number" || !Number.isFinite(reservationPrice)) {
      setFlowError("La unidad no publicó un precio válido.");
      return;
    }

    try {
      const allLive = mtLiveSnapshot();
      await requireVerifiedAdult(allLive);
      const unitId = String(room?.id || room?.roomId || room?.number || "");
      const held = await createRentalHold({ propertyId: String(propertyId), unitId, expectedRevision: Number(room?.revision || 1), allLive });
      const ownerIdentity = allLive.find((item) => item?.kind === "skylines.owner.profile" && String(item?.id) === String(owner));
      navigate("/payment", {
      state: {
        propertyId,
        owner,
        amount: reservationPrice,
        currency: effectiveCurrency,
        roomId: room.number,
        roomLabel,
        startDate,
        endDate,

        userName: tenantName.trim(),
        userCI: tenantCI.trim(),
        userAddress: tenantAddress.trim(),
        userEmail: (tenantEmail || "").trim() || undefined,

        meta: {
          ownerId: owner,
          landlordActorId: ownerIdentity?.attrs?.actorId || ownerIdentity?.attrs?.issuerActorId || owner,
          roomNumber: room.number,
          holdId: held.dv?.attrs?.holdId || held.dv?.id,
          unitId,
          expectedRevision: Number(held.dv?.attrs?.revision || 2),
        },

        ownerRaw: pageState?.ownerRaw || null,
        contractDefaults: room?.contractDefaults || {},

        address: address || "",
        city: city || "",
        description,
        image: roomMainImage,
        propertyName: name,
      },
    });
    } catch (error) {
      setFlowError(error?.message || "No se pudo reservar la unidad.");
    }
  };

  if (!room) {
    return (
      <Contenido>
        {!insideFalcon ? <Sidebar /> : null}
        <GlassContainer>
          <ContentCard>
            <LoadingOrb />
            <p>
              {loadingRoom
                ? "Cargando habitación desde Skylines..."
                : rawError || "No se encontró esta habitación. Revisa el raw o la URL."}
            </p>
          </ContentCard>
        </GlassContainer>
      </Contenido>
    );
  }

  return (
    <Contenido>
      {!insideFalcon ? <Sidebar /> : null}

      <GlassContainer>
        <ImageContainer>
          <StyledImage src={roomMainImage} alt={roomLabel} />

          <ImageShade />

          <ImageCounter>
            <ImageIcon size={15} />
            {roomPhotos.length > 0
              ? `${activePhotoIndex + 1} / ${roomPhotos.length}`
              : "Sin fotos"}
          </ImageCounter>

          {roomPhotos.length > 1 && (
            <>
              <GalleryArrow
                type="button"
                $left
                onClick={(e) => {
                  e.stopPropagation();
                  goPhoto(-1);
                }}
                aria-label="Foto anterior"
              >
                <ChevronLeft size={22} />
              </GalleryArrow>

              <GalleryArrow
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPhoto(1);
                }}
                aria-label="Foto siguiente"
              >
                <ChevronRight size={22} />
              </GalleryArrow>

              <ThumbStrip>
                {roomPhotos.map((photo, index) => (
                  <ThumbButton
                    type="button"
                    key={`${photo}-${index}`}
                    $active={index === activePhotoIndex}
                    onClick={() => setActivePhotoIndex(index)}
                    aria-label={`Ver foto ${index + 1}`}
                  >
                    <img src={photo} alt={`${roomLabel} foto ${index + 1}`} />
                  </ThumbButton>
                ))}
              </ThumbStrip>
            </>
          )}

          <ARButton onClick={() => setShowAR(true)} aria-label="Ampliar imagen">
            <Maximize size={22} color="white" />
          </ARButton>

          <ShareButton
            type="button"
            onClick={handleShareRoom}
            aria-label="Compartir habitación"
          >
            <Share2 size={18} />
            <span>Compartir</span>
          </ShareButton>

          {shareStatus && <ShareToast>{shareStatus}</ShareToast>}
        </ImageContainer>
        {roomVideo ? <section className="my-5 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Video de la habitación">
          <h2 className="mb-3 text-lg font-bold">Recorré la habitación</h2>
          <video key={roomVideo} controls playsInline preload="none" className="mx-auto max-h-[65dvh] w-full rounded-2xl bg-slate-950" aria-label="Recorrido de la habitación">
            <source src={roomVideo} type="video/mp4"/>
            Tu navegador no puede reproducir este video. <a href={roomVideo}>Abrir video</a>
          </video>
          <p className="mt-2 text-xs text-slate-500">El video se carga al reproducirlo.</p>
        </section> : null}

        {showAR &&
          (room.model3D ? (
            <ARModal onClick={() => setShowAR(false)}>
              <ARViewer
                src={room.model3D}
                ar
                ar-modes="webxr scene-viewer quick-look"
                auto-rotate
                camera-controls
              />
            </ARModal>
          ) : (
            <ImageZoomModal onClick={() => setShowAR(false)}>
              <ZoomContent onClick={(e) => e.stopPropagation()}>
                <CloseZoomButton type="button" onClick={() => setShowAR(false)}>
                  <X size={20} />
                </CloseZoomButton>

                {roomPhotos.length > 1 && (
                  <>
                    <ZoomArrow
                      type="button"
                      $left
                      onClick={() => goPhoto(-1)}
                      aria-label="Foto anterior"
                    >
                      <ChevronLeft size={28} />
                    </ZoomArrow>

                    <ZoomArrow
                      type="button"
                      onClick={() => goPhoto(1)}
                      aria-label="Foto siguiente"
                    >
                      <ChevronRight size={28} />
                    </ZoomArrow>
                  </>
                )}

                <ZoomedImage src={roomMainImage} alt="Vista ampliada" />

                {roomPhotos.length > 1 && (
                  <ZoomCounter>
                    {activePhotoIndex + 1} de {roomPhotos.length}
                  </ZoomCounter>
                )}
              </ZoomContent>
            </ImageZoomModal>
          ))}

        <GlassCard>
          <TopLine>
            <StatusBadge $available={!!room?.available}>
              {room?.available ? "Disponible" : "Ocupada"}
            </StatusBadge>

            <MiniLocation>{city || "Salto del Guairá"}</MiniLocation>
          </TopLine>

          <Price>{formatRentalMoney(effectivePrice, effectiveCurrency)}</Price>

          {asRentalMoneyNumber(room?.longTermPrice ?? room?.contractPrice) != null && Number(room?.minimumMonthsForLongTermPrice || 0) > 0 ? (
            <Description>
              <strong>{formatRentalMoney(room?.longTermPrice ?? room?.contractPrice, effectiveCurrency)} al mes</strong>{" "}
              con contrato de {room.minimumMonthsForLongTermPrice} meses o más.
            </Description>
          ) : null}

          <Title>
            {name} · {roomLabel}
          </Title>

          {room?.floor ? <MiniLocation>{room.floor}</MiniLocation> : null}

          <Description>{description}</Description>

          {Array.isArray(room?.servicesIncluded) && room.servicesIncluded.length ? (
            <Description><strong>Incluye:</strong> {room.servicesIncluded.join(" · ")}</Description>
          ) : null}

          {roomPhotos.length > 1 && (
  <PhotoHint>
    Deslizá la galería o tocá una miniatura para ver todas las fotos.
  </PhotoHint>
)}

<MapActionsRow>
  <MapActionButton
    type="button"
    onClick={() => openGoogleMaps(mapPayload)}
  >
    📍 Abrir mapa
  </MapActionButton>

  <MapActionButton
    type="button"
    onClick={() => openWaze(mapPayload)}
  >
    🚗 Waze
  </MapActionButton>
</MapActionsRow>
        </GlassCard>

        <ButtonWrapper>
          {canManageRental?<ContractButton type="button" onClick={handleCreateContract} disabled={!room?.available}>
            Crear contrato
          </ContractButton>:null}
          {canManageRental?<ContractButton type="button" onClick={()=>void changeAvailability()} disabled={availabilityBusy||['HELD','OCCUPIED'].includes(room?.state)}>{availabilityBusy?'Guardando…':room?.available?'Pausar disponibilidad':'Marcar disponible'}</ContractButton>:null}
          <CircleButton
            onClick={() => void beginSelfReservation()}
          >
            <Check size={19} color="white" />
            Reservar entrada
          </CircleButton>
        </ButtonWrapper>
        {!showModal&&flowError?<p role="alert">{flowError}</p>:null}

        {showModal && (
          <ModalOverlay onClick={() => setShowModal(false)}>
            <ModalContent role="dialog" aria-modal="true" aria-label="Reservar entrada" onClick={(e) => e.stopPropagation()}>
              <CloseModalButton type="button" onClick={() => setShowModal(false)}>
                <X size={18} />
              </CloseModalButton>

              <ModalHeader>
                <ModalEyebrow>Skylines · UTOPY rent</ModalEyebrow>
                <ModalTitle>Datos de entrada</ModalTitle>
                <ModalSubtitle>
                  Completá tus datos para iniciar el alquiler de forma clara,
                  simple y segura.
                </ModalSubtitle>
              </ModalHeader>

              <ResumeBox>
                <ResumeItem>
                  <span>{roomLabel}</span>
                  <strong>{formatRentalMoney(reservationPrice, effectiveCurrency)}</strong>
                </ResumeItem>
                <ResumeItem>
                  <span>Estado</span>
                  <strong>{room?.available ? "Disponible" : "Ocupada"}</strong>
                </ResumeItem>
              </ResumeBox>

              <FieldGrid>
                <Field>
                  <label>
                    <UserRound size={15} />
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre y apellido"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                  />
                </Field>

                <Field>
                  <label>
                    <CreditCard size={15} />
                    Cédula de identidad
                  </label>
                  <input
                    type="text"
                    placeholder="N° de CI"
                    value={tenantCI}
                    onChange={(e) => setTenantCI(e.target.value)}
                  />
                </Field>

                <Field $full>
                  <label>
                    <Home size={15} />
                    Domicilio
                  </label>
                  <input
                    type="text"
                    placeholder="Calle, número, barrio, ciudad, Pais"
                    value={tenantAddress}
                    onChange={(e) => setTenantAddress(e.target.value)}
                  />
                </Field>

                <Field $full>
                  <label>
                    <Mail size={15} />
                    Email opcional
                  </label>
                  <input
                    type="email"
                    placeholder="nombre@correo.com"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                  />
                </Field>
              </FieldGrid>

              <DatePanel>
                <DatePanelTitle>
                  <CalendarDays size={16} />
                  Fechas de alquiler
                </DatePanelTitle>

                <FieldGrid>
                  <Field>
                    <label>Inicio</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStartDate(v);

                        if (!endDate || diffMonths(v, endDate) < 6) {
                          setEndDate(addMonths(v, 6));
                        }
                      }}
                    />
                  </Field>

                  <Field>
                    <label>Fin mínimo 6 meses</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate ? addMonths(startDate, 6) : undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={!startDate}
                    />
                  </Field>
                </FieldGrid>
              </DatePanel>

              <Actions>
                {flowError ? <p style={{ gridColumn: "1 / -1", margin: 0, color: "#be123c", fontWeight: 800 }}>{flowError}</p> : null}
                <button type="button" onClick={handleConfirmRent}>
                  Confirmar alquiler
                </button>
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </Actions>
            </ModalContent>
          </ModalOverlay>
        )}
        {identityGate && (
          <ModalOverlay onClick={() => setIdentityGate(null)}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
              <CloseModalButton type="button" onClick={() => setIdentityGate(null)}><X size={18}/></CloseModalButton>
              <ModalHeader><ModalEyebrow>Identidad Viva · UTOPY</ModalEyebrow><ModalTitle>{identityGate.title}</ModalTitle><ModalSubtitle>{identityGate.message}</ModalSubtitle></ModalHeader>
              <Actions>
                {identityGate.action === "verify" && !inlineIdentity ? <button type="button" onClick={() => setInlineIdentity(true)}>Completar identidad privada y continuar</button> : null}
                {identityGate.action === "retry-owner" ? <button type="button" onClick={() => { setIdentityGate(null); void handleCreateContract(); }}>Reintentar</button> : null}
                <button type="button" onClick={() => setIdentityGate(null)}>Cancelar</button>
              </Actions>
              {identityGate.action === "verify" && inlineIdentity ? <Suspense fallback={<p>Abriendo tu identidad privada…</p>}><PrivateIdentityEditor allLive={mtLiveSnapshot()} activeActor={reservationActor} initialView="profile" initialProfileSection="private" identityJurisdiction={{ country: "PY", region: "Canindeyú", city: "Salto del Guairá" }} minimalEmbed onProfileDone={() => setInlineIdentity(false)} onPrivateIdentitySaved={async () => { const allLive = mtLiveSnapshot(); const role = await resolveRentalActorRole(allLive, String(owner || "")); const adult = await verifyAdultForJurisdiction(allLive, role.identity.actorId, { country: "PY", region: "Canindeyú" }); if (!adult.verified) throw Error("Todavía no pudimos verificar la identidad requerida."); await prefillPrivateIdentity(); sessionStorage.removeItem("skylines.pendingReservation"); setInlineIdentity(false); setIdentityGate(null); setShowModal(true); }}/></Suspense> : null}
            </ModalContent>
          </ModalOverlay>
        )}
      </GlassContainer>
    </Contenido>
  );
}

export default RoomDetailPage;

const Contenido = styled.div`
  min-height: 100vh;
  background:
    radial-gradient(circle at 16% 0%, rgba(45, 212, 191, 0.22), transparent 34%),
    radial-gradient(circle at 88% 12%, rgba(99, 102, 241, 0.2), transparent 34%),
    linear-gradient(135deg, #f8fafc 0%, #eef2ff 46%, #f9fafb 100%);
`;

const GlassContainer = styled.div`
  position: relative;
  width: 100vw;
  min-height: 100vh;
  padding: 92px 0 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ImageContainer = styled.div`
  width: min(92vw, 1080px);
  height: clamp(360px, 58vh, 680px);
  overflow: hidden;
  border-radius: 34px;
  margin: 0 auto;
  position: relative;
  background: rgba(15, 23, 42, 0.9);
  box-shadow:
    0 28px 80px rgba(15, 23, 42, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.65);

  @media (max-width: 768px) {
    width: 92vw;
    height: 52vh;
    border-radius: 26px;
  }
`;

const StyledImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const ImageShade = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(to bottom, rgba(2, 6, 23, 0.15), transparent 35%),
    linear-gradient(to top, rgba(2, 6, 23, 0.55), transparent 42%);
`;

const ImageCounter = styled.div`
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 13px;
  border-radius: 999px;
  color: white;
  font-size: 0.86rem;
  font-weight: 800;
  background: rgba(2, 6, 23, 0.48);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const GalleryArrow = styled.button`
  position: absolute;
  top: 50%;
  ${({ $left }) => ($left ? "left: 18px;" : "right: 18px;")}
  transform: translateY(-50%);
  z-index: 5;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  background: rgba(2, 6, 23, 0.42);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  backdrop-filter: blur(14px);
  transition: 0.2s ease;

  &:hover {
    transform: translateY(-50%) scale(1.05);
    background: rgba(2, 6, 23, 0.68);
  }

  @media (max-width: 768px) {
    width: 38px;
    height: 38px;
    ${({ $left }) => ($left ? "left: 10px;" : "right: 10px;")}
  }
`;

const ThumbStrip = styled.div`
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 5;
  width: min(calc(100% - 34px), 760px);
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 10px;
  border-radius: 22px;
  background: rgba(2, 6, 23, 0.38);
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(16px);

  &::-webkit-scrollbar {
    height: 0;
  }

  @media (max-width: 768px) {
    bottom: 12px;
    gap: 8px;
    padding: 8px;
  }
`;

const ThumbButton = styled.button`
  flex: 0 0 auto;
  width: 74px;
  height: 56px;
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  border: 2px solid
    ${({ $active }) =>
      $active ? "rgba(45, 212, 191, 0.95)" : "rgba(255, 255, 255, 0.18)"};
  background: rgba(255, 255, 255, 0.08);
  cursor: pointer;
  opacity: ${({ $active }) => ($active ? 1 : 0.72)};
  transform: ${({ $active }) => ($active ? "translateY(-2px)" : "none")};
  transition: 0.2s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  &:hover {
    opacity: 1;
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    width: 62px;
    height: 48px;
    border-radius: 13px;
  }
`;

const ButtonWrapper = styled.div`
  position: relative;
  z-index: 7;
  margin-top: 22px;
  margin-bottom: 40px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
`;
const ContractButton = styled.button`
  min-width: 190px;
  height: 54px;
  border-radius: 999px;
  padding: 0 22px;
  border: 1px solid rgba(15, 118, 110, 0.2);
  color: #0f766e;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16px 38px rgba(15, 23, 42, 0.1);
  font-weight: 900;
  cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const GlassCard = styled.div`
  position: relative;
  z-index: 6;
  width: min(86vw, 760px);

  /* antes era -72px; ahora baja el card */
  margin-top: 24px;

  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.68));
  backdrop-filter: blur(22px);
  border-radius: 28px;
  padding: 1.25rem 1.35rem 1.4rem;
  box-shadow: 0 22px 70px rgba(15, 23, 42, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.72);

  @media (max-width: 768px) {
    width: 88vw;

    /* en móvil queda más respirado debajo de la imagen */
    margin-top: 18px;

    border-radius: 24px;
    padding: 1rem;
  }
`;
const TopLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0.6rem;
`;

const MiniLocation = styled.span`
  font-size: 0.78rem;
  font-weight: 800;
  color: #64748b;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
`;

const Title = styled.h2`
  font-size: clamp(1.35rem, 2vw, 2rem);
  font-weight: 950;
  color: #0f172a;
  margin: 0 0 0.55rem;
  letter-spacing: -0.04em;
`;

const Description = styled.p`
  font-size: 0.98rem;
  color: #475569;
  margin: 0;
  line-height: 1.55;

  @media (max-width: 768px) {
    font-size: 0.92rem;
  }
`;

const Price = styled.p`
  font-size: clamp(1.35rem, 3vw, 2.15rem);
  font-weight: 950;
  color: #0f766e;
  margin: 0 0 0.2rem;
  letter-spacing: -0.05em;
`;

const PhotoHint = styled.div`
  margin-top: 0.85rem;
  padding: 10px 12px;
  border-radius: 16px;
  color: #0f766e;
  font-size: 0.84rem;
  font-weight: 800;
  background: rgba(20, 184, 166, 0.09);
  border: 1px solid rgba(20, 184, 166, 0.16);
`;

const StatusBadge = styled.div`
  width: fit-content;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 900;
  color: ${({ $available }) => ($available ? "#065f46" : "#991b1b")};
  background: ${({ $available }) =>
    $available ? "rgba(16,185,129,.14)" : "rgba(239,68,68,.14)"};
  border: 1px solid
    ${({ $available }) =>
      $available ? "rgba(16,185,129,.25)" : "rgba(239,68,68,.25)"};
`;

const CircleButton = styled.button`
  min-width: 190px;
  height: 54px;
  border-radius: 999px;
  padding: 0 22px;
  background:
    radial-gradient(circle at 18% 0%, rgba(45, 212, 191, 0.9), transparent 34%),
    linear-gradient(135deg, #020617, #0f172a 50%, #111827);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.16);
  display: inline-flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 900;
  letter-spacing: -0.02em;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.28);
  transition: 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 24px 54px rgba(15, 23, 42, 0.34);
  }
`;

const ARButton = styled.button`
  position: absolute;
  top: 18px;
  right: 18px;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 5;
  backdrop-filter: blur(14px);
  transition: 0.2s ease;

  &:hover {
    background: rgba(2, 6, 23, 0.75);
    transform: scale(1.05);
  }
`;

const ShareButton = styled.button`
  position: absolute;
  top: 76px;
  right: 18px;
  z-index: 6;
  height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(2, 6, 23, 0.48);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 900;
  font-size: 0.82rem;
  backdrop-filter: blur(14px);
  transition: 0.2s ease;

  &:hover {
    background: rgba(2, 6, 23, 0.76);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    top: 70px;
    right: 12px;
    height: 38px;
    padding: 0 12px;

    span {
      display: none;
    }
  }
`;

const ShareToast = styled.div`
  position: absolute;
  top: 126px;
  right: 18px;
  z-index: 7;
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.76);
  color: white;
  font-size: 0.78rem;
  font-weight: 900;
  border: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(14px);

  @media (max-width: 768px) {
    top: 114px;
    right: 12px;
  }
`;

const ARModal = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.86);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(14px);
`;

const ImageZoomModal = styled(ARModal)``;

const ZoomContent = styled.div`
  position: relative;
  width: min(94vw, 1120px);
  height: min(88vh, 760px);
  display: grid;
  place-items: center;
`;

const ZoomedImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 24px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.45);
`;

const CloseZoomButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 5;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.72);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
`;

const ZoomArrow = styled.button`
  position: absolute;
  top: 50%;
  ${({ $left }) => ($left ? "left: 10px;" : "right: 10px;")}
  transform: translateY(-50%);
  z-index: 5;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.58);
  color: white;
  display: grid;
  place-items: center;
  cursor: pointer;
  backdrop-filter: blur(12px);

  &:hover {
    background: rgba(15, 23, 42, 0.82);
  }
`;

const ZoomCounter = styled.div`
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-weight: 900;
  font-size: 0.9rem;
  padding: 9px 13px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.18);
`;
const MapActionsRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 0.9rem;
`;

const MapActionButton = styled.button`
  min-height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.04);
  color: #0f172a;
  font-weight: 900;
  cursor: pointer;
  transition: 0.18s ease;

  &:hover {
    background: rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }
`;
const ARViewer = styled("model-viewer")`
  width: 90%;
  max-width: 720px;
  height: 520px;
  border-radius: 24px;
  background: #fff;
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 50% 12%, rgba(45, 212, 191, 0.16), transparent 34%),
    rgba(2, 6, 23, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 15000;
  padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  box-sizing:border-box;
  backdrop-filter: blur(16px);
`;

const ModalContent = styled.div`
  position: relative;
  width: min(94vw, 680px);
  max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  box-sizing:border-box;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  overflow-y: auto;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.88));
  padding: 1.35rem;
  border-radius: 30px;
  color: #0f172a;
  box-shadow: 0 35px 120px rgba(0, 0, 0, 0.38);
  border: 1px solid rgba(255, 255, 255, 0.72);

  &::-webkit-scrollbar {
    width: 0;
  }

  @media (max-width: 640px) {
    padding: 1rem;
    border-radius: 26px;
  }
`;

const CloseModalButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.05);
  color: #0f172a;
  cursor: pointer;

  &:hover {
    background: rgba(15, 23, 42, 0.1);
  }
`;

const ModalHeader = styled.div`
  padding: 0.3rem 3rem 0.9rem 0.15rem;
`;

const ModalEyebrow = styled.div`
  width: fit-content;
  margin-bottom: 0.6rem;
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.1);
  border: 1px solid rgba(20, 184, 166, 0.18);
  color: #0f766e;
  font-size: 0.76rem;
  font-weight: 950;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const ModalTitle = styled.h3`
  font-size: clamp(1.8rem, 4vw, 2.7rem);
  margin: 0;
  font-weight: 950;
  letter-spacing: -0.06em;
`;

const ModalSubtitle = styled.p`
  margin: 0.55rem 0 0;
  color: #64748b;
  line-height: 1.5;
  font-size: 0.95rem;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  grid-column: ${({ $full }) => ($full ? "1 / -1" : "auto")};
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;

  label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.82rem;
    font-weight: 900;
    color: #334155;
  }

  input {
    width: 100%;
    padding: 13px 14px;
    border-radius: 18px;
    border: 1px solid rgba(15, 23, 42, 0.08);
    outline: none;
    color: #0f172a;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
    font-weight: 700;
    transition: 0.2s ease;

    &::placeholder {
      color: #94a3b8;
      font-weight: 600;
    }

    &:focus {
      border-color: rgba(20, 184, 166, 0.5);
      box-shadow:
        0 0 0 4px rgba(20, 184, 166, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.75);
      background: white;
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }
`;

const ResumeBox = styled.div`
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 10px;
  margin: 0.15rem 0 1rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const ResumeItem = styled.div`
  padding: 13px 14px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.06), rgba(20, 184, 166, 0.06));
  border: 1px solid rgba(15, 23, 42, 0.07);

  span {
    display: block;
    color: #64748b;
    font-size: 0.78rem;
    font-weight: 850;
    margin-bottom: 5px;
  }

  strong {
    display: block;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 950;
  }
`;

const DatePanel = styled.div`
  margin-top: 12px;
  padding: 13px;
  border-radius: 24px;
  background: rgba(15, 23, 42, 0.035);
  border: 1px solid rgba(15, 23, 42, 0.06);
`;

const DatePanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #0f172a;
  font-weight: 950;
  margin-bottom: 11px;
`;

const Actions = styled.div`
  position:sticky;
  bottom:0;
  z-index:2;
  padding:12px 0 max(8px, env(safe-area-inset-bottom));
  background:rgba(248,250,252,.94);
  backdrop-filter:blur(12px);
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;

  button {
    flex: 1;
    min-width: 150px;
    padding: 13px 16px;
    border-radius: 18px;
    border: none;
    cursor: pointer;
    font-weight: 950;
    transition: 0.2s ease;
  }

  button:first-child {
    color: white;
    background:
      radial-gradient(circle at 20% 0%, rgba(45, 212, 191, 0.9), transparent 38%),
      linear-gradient(135deg, #020617, #0f172a);
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.22);
  }

  button:last-child {
    color: #334155;
    background: rgba(15, 23, 42, 0.06);
  }

  button:hover {
    transform: translateY(-1px);
  }
`;

const ContentCard = styled.div`
  background: rgba(255, 255, 255, 0.72);
  border-radius: 26px;
  padding: 26px;
  color: #0f172a;
  font-size: 16px;
  font-weight: 800;
  backdrop-filter: blur(14px);
  box-shadow: 0 16px 50px rgba(15, 23, 42, 0.18);
  width: min(86vw, 360px);
  margin: 120px auto 0;
  text-align: center;
  display: grid;
  place-items: center;
  gap: 14px;

  p {
    margin: 0;
    line-height: 1.45;
  }
`;

const LoadingOrb = styled.div`
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, #ffffff, transparent 28%),
    radial-gradient(circle at 70% 70%, rgba(45, 212, 191, 0.9), transparent 32%),
    linear-gradient(135deg, #0f172a, #14b8a6);
  box-shadow:
    0 0 0 8px rgba(20, 184, 166, 0.08),
    0 18px 40px rgba(20, 184, 166, 0.32);
`;
