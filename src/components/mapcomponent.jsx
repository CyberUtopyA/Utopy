import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import styled from "styled-components";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import PropertyCard from "./card";
import RentalCard from "./alquiler";

// assets desde /public
const BIENES_ICON = "/bienes.png";
const ALQUILER_ICON = "/alquiler.png";

const houseIcon = new L.Icon({
  iconUrl: BIENES_ICON,
  iconSize: [50, 50],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const hostalIcon = new L.Icon({
  iconUrl: ALQUILER_ICON,
  iconSize: [50, 50],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});
const PopupContent = styled.div`
  display: grid;
  gap: 10px;
  min-width: 240px;
`;

const PopupActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const MapBtn = styled.button`
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
  background: white;
  color: #0f172a;
  font-weight: 900;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background: #f8fafc;
  }
`;
const StyledMapContainer = styled.div`
  height: 78vh;
  min-height: 620px;
  width: 100%;
  position: relative;
  z-index: 1001;
`;

const DEFAULT_CENTER = [-24.0676, -54.3101];

function asMoneyNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\./g, "");
    const normalized = cleaned.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function getRoomPrice(room, property) {
  return (
    asMoneyNumber(room?.price) ??
    asMoneyNumber(room?.monthly_price) ??
    asMoneyNumber(room?.precio) ??
    asMoneyNumber(property?.price) ??
    asMoneyNumber(property?.precio) ??
    null
  );
}

function getRoomCurrency(room, property) {
  return (
    room?.currency ||
    room?.moneda ||
    property?.currency ||
    property?.moneda ||
    "PYG"
  );
}

function getRoomImage(room, property) {
  return (
    room?.image ||
    room?.cover ||
    room?.photos?.[0] ||
    property?.image ||
    property?.photos?.[0] ||
    ""
  );
}
function getLatLng(location) {
  if (Array.isArray(location) && location.length >= 2) {
    const lat = Number(location[0]);
    const lng = Number(location[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  if (location && typeof location === "object") {
    const lat = Number(location.lat);
    const lng = Number(location.lng ?? location.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function openGoogleMaps(location, label = "Ubicación") {
  const coords = getLatLng(location);
  if (!coords) return;

  const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function openWaze(location) {
  const coords = getLatLng(location);
  if (!coords) return;

  const url = `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
  window.open(url, "_blank", "noopener,noreferrer");
}
function normalizeRooms(property) {
  const baseRooms = Array.isArray(property?.rooms) ? property.rooms : [];

  return baseRooms.map((room, index) => {
    const roomPrice = getRoomPrice(room, property);
    const roomCurrency = getRoomCurrency(room, property);
    const roomImage = getRoomImage(room, property);

    return {
      ...room,
      id:
        room?.id ||
        `${property?.id || "property"}-room-${room?.number ?? index + 1}`,
      number: room?.number ?? index + 1,
      available: Boolean(room?.available),
      price: roomPrice,
      currency: roomCurrency,
      image: roomImage,
      photos:
        Array.isArray(room?.photos) && room.photos.length > 0
          ? room.photos
          : roomImage
          ? [roomImage]
          : property?.image
          ? [property.image]
          : [],
    };
  });
}

function normalizeVentaProperty(property) {
  return {
    ...property,
    tipo: "venta",
    operation: "Venta",
  };
}

function normalizeRentalProperty(property) {
  const normalizedRooms = normalizeRooms(property);

  const minAvailablePrice = normalizedRooms
    .filter((room) => room.available && typeof room.price === "number")
    .map((room) => room.price)
    .sort((a, b) => a - b)[0];

  return {
    ...property,
    tipo: "alquiler",
    operation: "Alquiler",
    rooms: normalizedRooms,
    roomCount: normalizedRooms.length,
    availableRooms: normalizedRooms.filter((room) => room.available).length,
    displayPrice:
      typeof minAvailablePrice === "number"
        ? minAvailablePrice
        : asMoneyNumber(property?.price),
    image:
      property?.image ||
      normalizedRooms.find((room) => room.image)?.image ||
      normalizedRooms.find((room) => room.photos?.[0])?.photos?.[0] ||
      "",
  };
}

export default function MapComponent({ filters = {}, onCloseMap = () => {} }) {
  const [zoomLevel, setZoomLevel] = useState(13);
  const [allProperties, setAllProperties] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ventaRes, alquilerRes] = await Promise.all([
          fetch(
            "https://raw.githubusercontent.com/CyberUtopyA/skylines/main/properties.json"
          ),
          fetch(
            "https://raw.githubusercontent.com/CyberUtopyA/skylines/main/alquileres.json"
          ),
        ]);

        const ventaData = await ventaRes.json();
        const alquilerData = await alquilerRes.json();

        const ventaConTipo = Array.isArray(ventaData)
          ? ventaData.map(normalizeVentaProperty)
          : [];

        const alquilerConTipo = Array.isArray(alquilerData)
          ? alquilerData.map(normalizeRentalProperty)
          : [];

        setAllProperties([...ventaConTipo, ...alquilerConTipo]);
      } catch (err) {
        console.error("Error al obtener datos:", err);
      }
    };

    fetchData();
  }, []);

  function ZoomHandler() {
    const map = useMap();

    useEffect(() => {
      const handleZoom = () => setZoomLevel(map.getZoom());
      map.on("zoomend", handleZoom);
      return () => map.off("zoomend", handleZoom);
    }, [map]);

    return null;
  }

  const filteredProperties = useMemo(() => {
    return allProperties.filter((property) => {
      if (
        filters.type &&
        property.tipo !== filters.type &&
        property.operation !== filters.type
      ) {
        return false;
      }

      if (
        filters.tipo &&
        property.tipo !== filters.tipo &&
        property.operation !== filters.tipo
      ) {
        return false;
      }

      if (filters.rooms) {
        if (property.tipo === "alquiler") {
          const availableRooms = Array.isArray(property.rooms)
            ? property.rooms.filter((room) => room.available)
            : [];

          if (filters.rooms === "2+") {
            if (!(availableRooms.length >= 2)) return false;
          } else {
            if (availableRooms.length !== Number(filters.rooms)) return false;
          }
        } else {
          if (filters.rooms === "2+") {
            if (!(property.rooms >= 2)) return false;
          } else {
            if (property.rooms !== Number(filters.rooms)) return false;
          }
        }
      }

      if (
        filters.transaction_fee &&
        property.transaction_fee !== filters.transaction_fee
      ) {
        return false;
      }

      const comparablePrice =
        property.tipo === "alquiler"
          ? asMoneyNumber(property.displayPrice ?? property.price) ?? 0
          : asMoneyNumber(property.price) ?? 0;

      if (filters.priceMin && comparablePrice < Number(filters.priceMin)) {
        return false;
      }

      if (filters.priceMax && comparablePrice > Number(filters.priceMax)) {
        return false;
      }

      if (filters.operation && property.operation !== filters.operation) {
        return false;
      }

      return true;
    });
  }, [allProperties, filters]);

  return (
    <StyledMapContainer>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ZoomHandler />

        {zoomLevel < 10 ? (
          <Marker position={DEFAULT_CENTER} icon={houseIcon}>
            <Popup>Total de propiedades: {filteredProperties.length}</Popup>
          </Marker>
        ) : (
          filteredProperties.map((property, index) => (
            <Marker
              key={property.id || index}
              position={property.location || DEFAULT_CENTER}
              icon={property.tipo === "alquiler" ? hostalIcon : houseIcon}
            >
             <Popup>
  <PopupContent>
    {property.tipo === "alquiler" ? (
      <RentalCard
        image={property.image}
        price={property.displayPrice ?? property.price}
        currency={property.currency || "PYG"}
        name={property.name}
        description={property.description}
        location={property.location}
        rooms={property.rooms}
        propertyId={property.id}
        owner={property.owner_id}
        status={property.status}
        availableRooms={property.availableRooms}
        roomCount={property.roomCount}
      />
    ) : (
      <PropertyCard
        image={property.image}
        price={property.price}
        name={property.name}
        description={property.description}
        location={property.location}
        rooms={property.rooms}
        area={property.area}
        operation={property.operation}
        propertyId={property.id}
      />
    )}

    <PopupActions>
      <MapBtn onClick={() => openGoogleMaps(property.location, property.name)}>
        📍 Abrir mapa
      </MapBtn>

      <MapBtn onClick={() => openWaze(property.location)}>
        🚗 Waze
      </MapBtn>
    </PopupActions>
  </PopupContent>
</Popup>
            </Marker>
          ))
        )}
      </MapContainer>
    </StyledMapContainer>
  );
}