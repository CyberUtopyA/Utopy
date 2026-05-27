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
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/sidebar";
import SearchBar from "../components/search";

const PROFILE_KEY = "authUser";

const RENTALS_RAW_URL =
  "https://raw.githubusercontent.com/CyberUtopyA/skylines/main/alquileres.json";

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
    alert("Esta propiedad todavía no tiene coordenadas exactas cargadas.");
    return;
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

const openWaze = ({ location }) => {
  const coords = getLatLng(location);

  if (!coords) {
    alert("Esta propiedad todavía no tiene coordenadas exactas cargadas.");
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

const asMoneyNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\./g, "");
    const normalized = cleaned.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  return null;
};

const formatMoney = (amount, currency = "PYG") => {
  const numeric = asMoneyNumber(amount);
  if (numeric == null) return "Consultar precio";

  if (currency === "PYG") {
    return `${numeric.toLocaleString("es-PY")} Gs`;
  }

  return `${numeric.toLocaleString("es-PY")} ${currency}`;
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
    room,
    name: property?.name || property?.title || "Propiedad",
    price: room?.price ?? property?.price,
    image: room?.image || room?.photos?.[0] || property?.image || "",
    description: room?.description || property?.description || "",
    propertyId: property?.id,
    owner: property?.owner_id || property?.ownerId || property?.owner,
    currency: room?.currency || property?.currency || "PYG",
    address: property?.address || "",
    city: property?.city || "Salto del Guairá, Canindeyú, Paraguay",
    propertyLocation: property?.location || null,
    ownerRaw: property?.ownerRaw || null,
  };
};

function RoomDetailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  const urlPropertyId = params.propertyId;
  const urlRoomNumber = params.roomNumber || params.roomId || params.pieza;

  const [rawRoomState, setRawRoomState] = useState(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [rawError, setRawError] = useState("");

  const pageState = location.state || rawRoomState || {};

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

  const [tenantName, setTenantName] = useState("");
  const [tenantCI, setTenantCI] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.name) setTenantName(p.name);
        if (p?.ci) setTenantCI(p.ci);
        if (p?.address) setTenantAddress(p.address);
        if (p?.email) setTenantEmail(p.email);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (location.state?.room) return;
    if (!urlPropertyId || !urlRoomNumber) return;

    let alive = true;

    const loadRoomFromRaw = async () => {
      try {
        setRawError("");
        setLoadingRoom(true);

        const res = await fetch(RENTALS_RAW_URL, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`No se pudo cargar el raw: ${res.status}`);
        }

        const data = await res.json();
        const rentals = getRentalList(data);

        const property = rentals.find(
          (item) => normalizeText(item?.id) === normalizeText(urlPropertyId)
        );

        if (!property) {
          if (alive) setRawError("No se encontró la propiedad en el raw.");
          return;
        }

        const wantedRoom = normalizeText(urlRoomNumber);

        const foundRoom = (property?.rooms || []).find((r) => {
          const roomNumber = normalizeText(r?.number);
          const roomLabel = normalizeText(`Pieza ${r?.number}`);
          return roomNumber === wantedRoom || roomLabel === wantedRoom;
        });

        if (!foundRoom) {
          if (alive) setRawError("No se encontró esta pieza en la propiedad.");
          return;
        }

        if (alive) {
          setRawRoomState(buildRoomStateFromProperty(property, foundRoom));
        }
      } catch (err) {
        console.error("Error cargando habitación desde raw:", err);
        if (alive) {
          setRawError("No se pudo cargar la habitación desde el raw.");
        }
      } finally {
        if (alive) setLoadingRoom(false);
      }
    };

    loadRoomFromRaw();

    return () => {
      alive = false;
    };
  }, [location.state, urlPropertyId, urlRoomNumber]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [room?.number, propertyId]);

  const saveTenantLocal = (profile) => {
    let prev = {};
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      prev = raw ? JSON.parse(raw) : {};
    } catch {}
    const next = { ...prev, ...profile };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  };

  const effectivePrice = useMemo(() => {
    return (
      asMoneyNumber(room?.price) ??
      asMoneyNumber(room?.monthly_price) ??
      asMoneyNumber(room?.precio) ??
      asMoneyNumber(price)
    );
  }, [room, price]);

  const effectiveCurrency = useMemo(() => {
    return room?.currency || room?.moneda || currency || "PYG";
  }, [room, currency]);

  const roomPhotos = useMemo(() => {
    return uniquePhotos(room?.image, room?.photos || [], image);
  }, [room, image]);

  const roomMainImage = useMemo(() => {
    return roomPhotos[activePhotoIndex] || roomPhotos[0] || image || "";
  }, [roomPhotos, activePhotoIndex, image]);

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
      const text = `${roomLabel} en ${name || "Skylines"} · ${formatMoney(
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

  const handleConfirmRent = () => {
    if (!startDate || !endDate) {
      alert("Selecciona fecha de inicio y fin.");
      return;
    }

    if (!tenantName.trim()) {
      alert("Ingresa el Nombre del inquilino.");
      return;
    }

    if (!tenantCI.trim()) {
      alert("Ingresa la Cédula de Identidad.");
      return;
    }

    if (!tenantAddress.trim()) {
      alert("Ingresa el Domicilio.");
      return;
    }

    if (room?.number == null || room?.number === "") {
      alert("La pieza no está disponible.");
      return;
    }

    if (room?.available === false) {
      alert("Esta pieza ya no está disponible.");
      return;
    }

    if (endDate < startDate) {
      alert("La fecha de salida no puede ser anterior a la de inicio.");
      return;
    }

    const meses = diffMonths(startDate, endDate);
    if (meses < 6) {
      alert("El contrato debe ser mínimo de 6 meses.");
      return;
    }

    saveTenantLocal({
      name: tenantName.trim(),
      ci: tenantCI.trim(),
      address: tenantAddress.trim(),
      email: tenantEmail.trim(),
    });

    if (typeof effectivePrice !== "number" || !Number.isFinite(effectivePrice)) {
      alert(
        "El precio de la pieza debe ser numérico. Agrega room.price o price en el origen."
      );
      return;
    }

    navigate("/payment", {
      state: {
        propertyId,
        owner,
        amount: effectivePrice,
        currency: effectiveCurrency,
        roomId: room.number,
        roomLabel,
        startDate,
        endDate,

        userName: tenantName.trim(),
        userCI: tenantCI.trim(),
        userAddress: tenantAddress.trim(),
        userEmail: (tenantEmail || "").trim() || undefined,

        ownerRawUrl:
          "https://raw.githubusercontent.com/CyberUtopyA/skylines/main/owners.json",

        meta: {
          ownerId: owner,
          roomNumber: room.number,
        },

        ownerRaw: pageState?.ownerRaw || null,

        address: address || "",
        city: city || "Salto del Guairá, Canindeyú, Paraguay",
        description,
        image: roomMainImage,
        propertyName: name,
      },
    });
  };

  if (!room) {
    return (
      <Contenido>
        <SearchBar />
        <Sidebar />
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
      <SearchBar />
      <Sidebar />

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

          <Price>{formatMoney(effectivePrice, effectiveCurrency)}</Price>

          <Title>
            {name} · {roomLabel}
          </Title>

          <Description>{description}</Description>

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
          <CircleButton
            onClick={() => {
              if (!room?.available) {
                alert("Esta pieza no está disponible actualmente.");
                return;
              }
              setShowModal(true);
            }}
          >
            <Check size={19} color="white" />
            Reservar entrada
          </CircleButton>
        </ButtonWrapper>

        {showModal && (
          <ModalOverlay onClick={() => setShowModal(false)}>
            <ModalContent onClick={(e) => e.stopPropagation()}>
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
                  <strong>{formatMoney(effectivePrice, effectiveCurrency)}</strong>
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
  z-index: 80;
  padding: 18px;
  backdrop-filter: blur(16px);
`;

const ModalContent = styled.div`
  position: relative;
  width: min(94vw, 680px);
  max-height: 92vh;
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