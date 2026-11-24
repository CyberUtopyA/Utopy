import styled from "styled-components";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Share2, MessageCircle } from "lucide-react";
import { formatRentalMoney, normalizeRentalRooms, rentalDisplayPrice } from "../utils/rentalProperty";

const Card = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  width: 300px;
  position: relative;
`;

const Image = styled.img`
  width: 100%;
  height: 180px;
  object-fit: cover;
  background: #f3f4f6;
`;

const EmptyImage = styled.div`
  width: 100%;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
  color: #6b7280;
  font-weight: 700;
`;

const Content = styled.div`
  padding: 16px;
`;

const Title = styled.h2`
  font-size: 18px;
  margin: 0 0 8px;
  color: #111827;
`;

const Price = styled.p`
  color: #111827;
  font-weight: 800;
  margin: 0 0 10px;
  font-size: 1rem;
`;

const Meta = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const Chip = styled.span`
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
`;

const Description = styled.p`
  font-size: 14px;
  color: #555;
  margin-top: 5px;
  line-height: 1.35;
`;

const SmallLabel = styled.div`
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
  font-weight: 600;
`;

const Legend = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
  margin-bottom: 8px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
`;

const Dot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(props) => props.color || "#ccc"};
`;

const RoomList = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0 12px;
`;

const RoomCircle = styled.button`
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background-color: ${(props) => (props.$available ? "#ffffff" : "#111111")};
  border: 2px solid ${(props) => (props.$available ? "#10b981" : "#d1d5db")};
  color: ${(props) => (props.$available ? "#111111" : "#ffffff")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  cursor: ${(props) => (props.$available ? "pointer" : "not-allowed")};
  opacity: ${(props) => (props.$available ? 1 : 0.82)};
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;

  &:hover {
    transform: ${(props) => (props.$available ? "translateY(-1px)" : "none")};
    box-shadow: ${(props) =>
      props.$available ? "0 6px 14px rgba(16,185,129,0.18)" : "none"};
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
`;

const ActionButton = styled.button`
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: transform 0.15s ease, opacity 0.15s ease;
  min-height: 42px;

  &:hover {
    transform: translateY(-1px);
    opacity: 0.95;
  }
`;

const WhatsappButton = styled(ActionButton)`
  background: #25d366;
  color: white;
  flex: 1;
`;

const NativeShareButton = styled(ActionButton)`
  background: #111827;
  color: white;
  flex: 1;
`;

function buildPropertyUrl(propertyId, roomNumber) {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const roomPart =
    roomNumber !== undefined && roomNumber !== null
      ? `/propiedad/${propertyId}/pieza/${encodeURIComponent(String(roomNumber))}`
      : `/propiedad/${propertyId}`;
  return `${origin}${roomPart}`;
}

const RentalCard = ({
  image,
  name,
  price,
  currency = "PYG",
  rooms = [],
  location,
  propertyId,
  description,
  owner,
  availableRooms,
  roomCount,
}) => {
  const navigate = useNavigate();

  const normalizedRooms = useMemo(() => {
    return normalizeRentalRooms({ id: propertyId, rooms, price, currency, image });
  }, [rooms, price, currency, image, propertyId]);

  const availableCount = useMemo(() => {
    if (typeof availableRooms === "number") return availableRooms;
    return normalizedRooms.filter((room) => room.available).length;
  }, [availableRooms, normalizedRooms]);

  const totalCount = useMemo(() => {
    if (typeof roomCount === "number") return roomCount;
    return normalizedRooms.length;
  }, [roomCount, normalizedRooms]);

  const firstAvailable = useMemo(
    () => normalizedRooms.find((room) => room.available && typeof room.price === "number"),
    [normalizedRooms]
  );

  const displayPrice = useMemo(
    () => rentalDisplayPrice(normalizedRooms, price, currency),
    [normalizedRooms, price, currency]
  );

  const mainImage = useMemo(() => {
    return (
      image ||
      normalizedRooms.find((room) => room.image)?.image ||
      normalizedRooms.find((room) => room.photos?.[0])?.photos?.[0] ||
      ""
    );
  }, [image, normalizedRooms]);

  const handleRoomClick = (room) => {
    if (!room.available) return;

    navigate(`/propiedad/${propertyId}/pieza/${room.number}`, {
      state: {
        propertyId,
        room,
        name,
        price: room.price ?? price,
        currency: room.currency || currency || "PYG",
        image: room.image || mainImage,
        location,
        description,
        owner,
      },
    });
  };

  const shareText = useMemo(() => {
    const roomText = firstAvailable
      ? `Disponible desde ${formatRentalMoney(
          firstAvailable.price,
          firstAvailable.currency
        )}`
      : `Precio: ${formatRentalMoney(price, currency)}`;

    const locationText = Array.isArray(location)
      ? `Ubicación: ${location[0]}, ${location[1]}`
      : location
      ? `Ubicación: ${String(location)}`
      : "";

    const propertyUrl = buildPropertyUrl(
      propertyId,
      firstAvailable?.number ?? null
    );

    return [
      `🏠 ${name}`,
      roomText,
      description ? `${description}` : "",
      locationText,
      propertyUrl,
    ]
      .filter(Boolean)
      .join("\n");
  }, [name, firstAvailable, price, currency, description, location, propertyId]);

  const handleWhatsappShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    try {
      const propertyUrl = buildPropertyUrl(
        propertyId,
        firstAvailable?.number ?? null
      );

      if (navigator.share) {
        await navigator.share({
          title: name,
          text: shareText,
          url: propertyUrl || undefined,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        alert("Información copiada para compartir.");
        return;
      }

      alert(shareText);
    } catch (error) {
      console.error("Error al compartir:", error);
    }
  };

  return (
    <Card>
      {mainImage ? (
        <Image src={mainImage} alt={name} />
      ) : (
        <EmptyImage>Sin imagen</EmptyImage>
      )}

      <Content>
        <Title>{name}</Title>
        <Price>{displayPrice}</Price>

        <Meta>
          <Chip>{availableCount} disponibles</Chip>
          <Chip>{totalCount} espacios</Chip>
        </Meta>

        <Description>{description}</Description>

        <SmallLabel>Elegí una habitación:</SmallLabel>

        <Legend>
          <LegendItem>
            <Dot color="#10b981" />
            Disponible
          </LegendItem>
          <LegendItem>
            <Dot color="#111111" />
            Ocupada
          </LegendItem>
        </Legend>

        <RoomList>
          {normalizedRooms.map((room, index) => (
            <RoomCircle
              key={room.id || index}
              type="button"
              $available={room.available}
              onClick={() => handleRoomClick(room)}
              title={
                room.available
                  ? `${String(room.number)} · ${formatRentalMoney(
                      room.price,
                      room.currency
                    )}`
                  : `${String(room.number)} · Ocupada`
              }
            >
              {String(room.number)}
            </RoomCircle>
          ))}
        </RoomList>

        <Actions>
          <WhatsappButton type="button" onClick={handleWhatsappShare}>
            <MessageCircle size={18} />
            WhatsApp
          </WhatsappButton>

          <NativeShareButton type="button" onClick={handleNativeShare}>
            <Share2 size={18} />
            Compartir
          </NativeShareButton>
        </Actions>
      </Content>
    </Card>
  );
};

export default RentalCard;
