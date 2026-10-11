import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { MARKER_GEOMETRY, markerHtml } from './markers';

// CARTO "Voyager" basemap: open data, styled close to Google Maps.
const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function MapMarker({ m }) {
  const geo = MARKER_GEOMETRY[m.kind] || MARKER_GEOMETRY.destination;
  const heading = Number.isFinite(m.heading) ? Math.round(m.heading / 5) * 5 : null;
  const icon = useMemo(() => L.divIcon({
    html: markerHtml(m.kind, { label: m.label, heading, status: m.status, title: m.title }),
    className: 'anv-leaflet-icon',
    iconSize: geo.size,
    iconAnchor: geo.anchor,
  }), [m.kind, m.label, heading, m.status, m.title, geo]);
  const handlers = useMemo(() => ({
    dragend: (e) => { const p = e.target.getLatLng(); m.onDragEnd?.({ lat: p.lat, lng: p.lng }); },
    click: () => m.onClick?.(),
  }), [m]);
  return (
    <Marker position={[m.position.lat, m.position.lng]} icon={icon} draggable={!!m.draggable}
      eventHandlers={handlers} zIndexOffset={m.zIndex || 0} keyboard={!!(m.onClick || m.draggable)} title={m.title || ''} />
  );
}

function Controller({ fitPoints, fitKey, panTo, onMapClick, onReady }) {
  const map = useMap();
  const first = useRef(true);
  useMapEvents({ click: (e) => onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });

  useEffect(() => { onReady?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pts = (fitPoints || []).filter(Boolean);
    if (pts.length === 0) return;
    const animate = !first.current;
    first.current = false;
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], Math.max(map.getZoom(), 15), { animate });
    else map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])), { padding: [56, 56], maxZoom: 16, animate });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (panTo) map.panTo([panTo.lat, panTo.lng], { animate: true });
  }, [panTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function LeafletMapCanvas({ center, zoom = 13, markers = [], paths = [], onMapClick, fitPoints, fitKey, panTo, interactive = true, onReady }) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      className="absolute inset-0 size-full"
    >
      <TileLayer url={TILES} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={20} detectRetina />
      {paths.map((p) => (
        <Polyline key={p.id} positions={p.points.map((q) => [q.lat, q.lng])}
          pathOptions={{ color: p.color, weight: p.width || 5, opacity: p.opacity ?? 0.9, dashArray: p.dashed ? '2 10' : undefined, lineCap: 'round' }} />
      ))}
      {markers.filter((m) => m.position).map((m) => <MapMarker key={m.id} m={m} />)}
      <Controller fitPoints={fitPoints} fitKey={fitKey} panTo={panTo} onMapClick={onMapClick} onReady={onReady} />
    </MapContainer>
  );
}
