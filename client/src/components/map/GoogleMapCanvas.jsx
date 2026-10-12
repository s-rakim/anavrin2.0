import { useEffect, useRef } from 'react';
import { APILoadingStatus, APIProvider, AdvancedMarker, Map, Polyline, useApiLoadingStatus, useMap } from '@vis.gl/react-google-maps';
import { MARKER_GEOMETRY, markerHtml } from './markers';
import { markGoogleFailed } from './provider';

// The Maps API calls window.gm_authFailure when the key is rejected (invalid key, billing off, referrer
// not allowed). @vis.gl/react-google-maps no longer surfaces this, so hook it here and fall back.
if (typeof window !== 'undefined') {
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => { markGoogleFailed('auth failure'); previous?.(); };
}

const DASHED = [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }];

function Controller({ fitPoints, fitKey, panTo }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (!map || !window.google) return;
    const pts = (fitPoints || []).filter(Boolean);
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.panTo(pts[0]);
      if ((map.getZoom() || 0) < 15) map.setZoom(15);
    } else {
      const bounds = new window.google.maps.LatLngBounds();
      pts.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, 56);
    }
    first.current = false;
  }, [map, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (map && panTo) map.panTo(panTo); }, [map, panTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Switch every map to the fallback if the key is rejected or the script can't load. */
function FailureWatch({ onReady }) {
  const status = useApiLoadingStatus();
  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) markGoogleFailed(status);
    if (status === APILoadingStatus.LOADED) onReady?.();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function GoogleMapCanvas({ apiKey, mapId, center, zoom = 13, markers = [], paths = [], onMapClick, fitPoints, fitKey, panTo, interactive = true, onReady }) {
  return (
    <APIProvider apiKey={apiKey} version="weekly" region="KE" language="en" libraries={['marker', 'places', 'geocoding']}
      onError={() => markGoogleFailed('load error')}>
      <FailureWatch onReady={onReady} />
      <Map
        mapId={mapId || 'DEMO_MAP_ID'}
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling={interactive ? 'greedy' : 'none'}
        disableDefaultUI
        clickableIcons={false}
        colorScheme="LIGHT"
        onClick={(e) => e.detail.latLng && onMapClick?.(e.detail.latLng)}
        className="absolute inset-0 size-full"
      >
        {paths.map((p) => (
          <Polyline key={p.id} path={p.points} strokeColor={p.color} strokeWeight={p.width || 5}
            strokeOpacity={p.dashed ? 0 : (p.opacity ?? 0.9)} icons={p.dashed ? DASHED.map((i) => ({ ...i, icon: { ...i.icon, strokeColor: p.color } })) : undefined} />
        ))}
        {markers.filter((m) => m.position).map((m) => {
          const geo = MARKER_GEOMETRY[m.kind] || MARKER_GEOMETRY.destination;
          return (
            <AdvancedMarker key={m.id} position={m.position} draggable={!!m.draggable} zIndex={m.zIndex}
              title={m.title || ''} anchorLeft={`-${geo.anchor[0]}px`} anchorTop={`-${geo.anchor[1]}px`}
              onClick={m.onClick ? () => m.onClick() : undefined}
              onDragEnd={(e) => e.latLng && m.onDragEnd?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })}>
              <div dangerouslySetInnerHTML={{ __html: markerHtml(m.kind, { label: m.label, heading: m.heading, status: m.status, title: m.title, stale: m.stale }) }} />
            </AdvancedMarker>
          );
        })}
        <Controller fitPoints={fitPoints} fitKey={fitKey} panTo={panTo} />
      </Map>
    </APIProvider>
  );
}
