import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { measureDev } from "../utils/devPerformance";
import { createTileRecoveryHandlers } from "./mapTileRecovery";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const BACKUP_TILES = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const MAX_MARKERS = 160;

const Layer = styled.div`
  position:absolute;inset:0;
  .leaflet-container{width:100%;height:100%;background:#eef4f1;font-family:inherit}
  .leaflet-control-attribution{background:rgba(255,255,255,.78)!important;color:rgba(15,23,42,.55)!important;border-radius:999px 0 0 0;padding:3px 8px;font-size:10px}
  .leaflet-control-attribution a{color:#0891b2!important}
  .leaflet-control-zoom{border:0!important;overflow:hidden;border-radius:18px!important;box-shadow:0 12px 34px rgba(0,0,0,.16)}
  .leaflet-top.leaflet-left{top:auto;left:auto;right:14px;bottom:155px}
  .leaflet-control-zoom a{background:rgba(255,255,255,.88)!important;color:#172444!important;border:0!important}
`;

function Tiles({ onUnavailable, retry }) {
  const [backup, setBackup] = useState(false);
  useEffect(() => { setBackup(false); onUnavailable(false); }, [retry, onUnavailable]);
  const handlers = useMemo(() => createTileRecoveryHandlers({
    backup,
    onReady: () => onUnavailable(false),
    onFallback: () => setBackup(true),
    onUnavailable: () => onUnavailable(true),
  }), [backup, retry, onUnavailable]);
  return <TileLayer key={`${retry}:${backup ? "backup" : "main"}`} url={backup ? BACKUP_TILES : TILES} maxZoom={19} attribution={backup ? '&copy; OpenStreetMap contributors, Humanitarian OpenStreetMap Team' : '&copy; OpenStreetMap contributors'} eventHandlers={handlers} />;
}

function FitPoints({ points, selected }) {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng)) { map.setView([selected.lat, selected.lng], Math.max(map.getZoom(), 13)); return; }
      if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 14); return; }
      if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [72, 72], maxZoom: 14 });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [map, points, selected]);
  return null;
}

function Viewport({ onChange }) {
  const timer = useRef(null);
  const map = useMapEvents({ moveend: schedule, zoomend: schedule });
  function schedule() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const bounds = map.getBounds().pad(.18);
      onChange({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest(), zoom: map.getZoom() });
    }, 140);
  }
  useEffect(() => { schedule(); return () => { if (timer.current) window.clearTimeout(timer.current); }; }, [map]);
  return null;
}

function family(kind) {
  if (/demand|need|intent/.test(kind)) return "need";
  if (/delivery/.test(kind)) return "delivery";
  if (/person|capability|work/.test(kind)) return "work";
  if (/node|offer/.test(kind)) return "offer";
  return kind;
}

function markersInView(points, viewport) {
  const visible = viewport ? points.filter((p) => p.lat <= viewport.north && p.lat >= viewport.south && p.lng <= viewport.east && p.lng >= viewport.west) : points;
  const zoom = viewport?.zoom || 13;
  const cell = zoom <= 10 ? .16 : zoom <= 12 ? .07 : zoom <= 14 ? .025 : zoom <= 15 ? .01 : 0;
  if (!cell) return [...visible].sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || Number(b.timestamp || 0) - Number(a.timestamp || 0)).slice(0, MAX_MARKERS);
  const groups = new Map();
  for (const point of visible) {
    const key = `${family(point.kind)}:${Math.floor(point.lat / cell)}:${Math.floor(point.lng / cell)}`;
    const group = groups.get(key) || [];
    group.push(point); groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([key, members]) => {
    if (members.length === 1) return members[0];
    const lead = members.find((point) => point.active) || members[0];
    return { ...lead, id: `cluster:${key}`, lat: members.reduce((sum, p) => sum + p.lat, 0) / members.length, lng: members.reduce((sum, p) => sum + p.lng, 0) / members.length, title: `${members.length} opciones cerca`, subtitle: "Acercate para verlas", clusterCount: members.length, clusterMembers: members, active: false };
  }).sort((a, b) => Number(b.clusterCount || 1) - Number(a.clusterCount || 1)).slice(0, MAX_MARKERS);
}

function symbol(kind) {
  if (/delivery/.test(kind)) return "🚚";
  if (/property/.test(kind)) return "🏠";
  if (/finance/.test(kind)) return "◈";
  if (/work|capability/.test(kind)) return "✦";
  if (/need|demand|intent/.test(kind)) return "◌";
  return "●";
}

function MapMarker({ point, onSelect }) {
  const map = useMap();
  const content = String(point.clusterCount || symbol(point.kind));
  const icon = useMemo(() => L.divIcon({ className: "utopy-geographic-marker", html: `<span>${content}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] }), [content]);
  const click = () => {
    if (point.clusterMembers?.length > 1) map.fitBounds(L.latLngBounds(point.clusterMembers.map((member) => [member.lat, member.lng])), { padding: [54, 54], maxZoom: 16 });
    else onSelect(point);
  };
  return <Marker position={[point.lat, point.lng]} icon={icon} eventHandlers={{ click }} />;
}

export default function CircularGeographicMap({ points, selected, linkedPoints, liveMatches, onSelect, overlaySuppressed, origin }) {
  const [viewport, setViewport] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const reconnect = () => setRetry(value => value + 1);
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);
  const rendered = useMemo(() => measureDev("utopy.map.markerDerivation", () => markersInView(points, viewport)), [points, viewport]);
  const center = origin && Number.isFinite(origin.lat) ? [origin.lat, origin.lng] : points.length ? [points[0].lat, points[0].lng] : [-24.0676, -54.3101];
  const selectedLocated = Number.isFinite(selected?.lat) && Number.isFinite(selected?.lng);
  return <Layer>
    <style>{`.utopy-geographic-marker{background:transparent;border:0}.utopy-geographic-marker span{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#fff;border:2px solid #ceb17d;box-shadow:0 7px 19px #18223830;color:#1b2740;font-weight:900;font-size:17px}`}</style>
    <MapContainer center={center} zoom={13} zoomControl={false} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
      <Tiles onUnavailable={setUnavailable} retry={retry} />
      {!overlaySuppressed ? <ZoomControl position="topleft" zoomInTitle="Acercar" zoomOutTitle="Alejar" /> : null}
      <FitPoints points={points} selected={selected} />
      <Viewport onChange={setViewport} />
      {rendered.map((point) => <MapMarker key={point.id} point={point} onSelect={onSelect} />)}
      {selectedLocated ? linkedPoints.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => <Polyline key={`link:${p.id}`} positions={[[selected.lat, selected.lng], [p.lat, p.lng]]} pathOptions={{ color: "#22a8a0", weight: 2, opacity: .7, dashArray: "7 8" }} />) : null}
      {selectedLocated ? liveMatches.filter((match) => Number.isFinite(match.point?.lat) && Number.isFinite(match.point?.lng)).map((match) => <Polyline key={`match:${match.id}`} positions={[[selected.lat, selected.lng], [match.point.lat, match.point.lng]]} pathOptions={{ color: "#8479d8", weight: 2, opacity: .6, dashArray: "4 8" }} />) : null}
    </MapContainer>
    {unavailable ? <div role="status" className="absolute bottom-24 left-1/2 z-[600] -translate-x-1/2 rounded-2xl bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-lg">No pudimos cargar el fondo. Los nodos siguen disponibles. <button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 px-3 underline">Reintentar</button></div> : null}
  </Layer>;
}
