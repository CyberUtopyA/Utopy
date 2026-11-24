import React, { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import styled from "styled-components";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import PropertyCard from "./card";
import RentalCard from "./alquiler";
import {
  asRentalMoneyNumber,
  normalizeRentalProperty,
  rentalMatchesPrice,
} from "../utils/rentalProperty";

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

function hasMapLocation(property) {
  return Boolean(getLatLng(property?.location));
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
function normalizeVentaProperty(property) {
  return {
    ...property,
    tipo: "venta",
    operation: "Venta",
  };
}

export default function MapComponent({ filters = {}, onCloseMap = () => {}, properties = null }) {
  const [zoomLevel, setZoomLevel] = useState(13);
  const [allProperties, setAllProperties] = useState([]);

  useEffect(() => {
    if (Array.isArray(properties)) {
      setAllProperties(
        properties.map((property) =>
          property?.tipo === "alquiler" || property?.operation === "Alquiler"
            ? normalizeRentalProperty(property)
            : normalizeVentaProperty(property),
        ),
      );
      return;
    }
    setAllProperties([]);
  }, [properties]);

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

      if (property.tipo === "alquiler") {
        if (!rentalMatchesPrice(property, filters)) return false;
      } else {
        const comparablePrice = asRentalMoneyNumber(property.price) ?? 0;
        if (filters.priceMin && comparablePrice < Number(filters.priceMin)) return false;
        if (filters.priceMax && comparablePrice > Number(filters.priceMax)) return false;
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
          filteredProperties.filter(hasMapLocation).map((property, index) => (
            <Marker
              key={property.id || index}
              position={property.location}
              icon={property.tipo === "alquiler" ? hostalIcon : houseIcon}
            >
             <Popup>
  <PopupContent>
    {property.tipo === "alquiler" ? (
      <RentalCard
        image={property.image}
        price={property.price}
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
