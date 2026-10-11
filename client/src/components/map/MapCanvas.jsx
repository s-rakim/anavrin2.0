import { Suspense, lazy } from 'react';
import { MapPinned } from 'lucide-react';
import { NAIROBI } from '../../lib/geo';
import { useMapProvider } from './provider';

// Each provider is its own bundle, loaded only when a map is on screen.
const GoogleMapCanvas = lazy(() => import('./GoogleMapCanvas'));
const LeafletMapCanvas = lazy(() => import('./LeafletMapCanvas'));

function MapSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#e8eaed]">
      <MapPinned className="size-7 animate-pulse text-silver-500" aria-hidden />
    </div>
  );
}

/**
 * Provider-agnostic map. Uses Google Maps when a key is configured and working,
 * otherwise an open map with the same markers, lines and behaviour.
 *
 * markers: [{ id, kind: 'destination'|'store'|'rider'|'me'|'order', position, label, heading, status, draggable, onDragEnd, onClick, zIndex }]
 * paths:   [{ id, points: [{lat,lng}], color, width, dashed }]
 * fitPoints + fitKey: fit the camera to these points whenever fitKey changes.
 * panTo: { lat, lng, key } pans whenever key changes.
 */
export function MapCanvas({ className = 'h-72', label = 'Map', children, center = NAIROBI, ...props }) {
  const { provider, config } = useMapProvider();
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-[#e8eaed] ${className}`} role="region" aria-label={label}>
      {!provider ? <MapSkeleton /> : (
        <Suspense fallback={<MapSkeleton />}>
          {provider === 'google'
            ? <GoogleMapCanvas key="google" apiKey={config.maps.googleApiKey} mapId={config.maps.googleMapId} center={center} {...props} />
            : <LeafletMapCanvas key="open" center={center} {...props} />}
        </Suspense>
      )}
      {children}
    </div>
  );
}

/** Round floating map button (recenter, zoom, locate) in the style of the Google Maps app. */
export function MapFab({ onClick, label, children, className = '' }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid size-11 place-items-center rounded-full bg-white text-[#3c4043] shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)] transition hover:bg-[#f8f9fa] active:scale-95 ${className}`}>
      {children}
    </button>
  );
}
