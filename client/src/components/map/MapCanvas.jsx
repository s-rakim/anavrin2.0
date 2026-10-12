import { Component, Suspense, lazy, useEffect } from 'react';
import { MapPinned, MapPinOff } from 'lucide-react';
import { NAIROBI } from '../../lib/geo';
import { markGoogleFailed, markOpenMapFailed, useMapProvider } from './provider';

// Each provider is its own bundle, loaded only when a map is on screen.
const GoogleMapCanvas = lazy(() => import('./GoogleMapCanvas'));
const OpenMapCanvas = lazy(() => import('./OpenMapCanvas'));

function MapSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#e8eaed]">
      <MapPinned className="size-7 animate-pulse text-silver-500" aria-hidden />
    </div>
  );
}

function MapUnavailable() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#eef0f2] px-8 text-center">
      <MapPinOff className="size-7 text-silver-500" aria-hidden />
      <p className="text-sm font-medium text-ink-soft">The map can’t be shown on this device.</p>
    </div>
  );
}

/** A crashing map (no WebGL, failed chunk download, provider bug) must never take the page down with it. */
class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    if (this.props.provider === 'google') markGoogleFailed(error?.message || 'crash');
    else markOpenMapFailed(error?.message || 'crash');
  }
  componentDidUpdate(prev) {
    if (prev.provider !== this.props.provider && this.state.failed) this.setState({ failed: false });
  }
  render() { return this.state.failed ? <MapUnavailable /> : this.props.children; }
}

/**
 * Provider-agnostic map. Uses Google Maps when a key is configured and working,
 * otherwise an open map with the same markers, lines and behaviour. Overlay children
 * (search box, buttons, status cards) render on top either way, even with no map.
 *
 * markers: [{ id, kind: 'destination'|'store'|'rider'|'me'|'order', position, label, heading, status, stale, draggable, onDragEnd, onClick, zIndex }]
 * paths:   [{ id, points: [{lat,lng}], color, width, dashed }]
 * fitPoints + fitKey: fit the camera to these points whenever fitKey changes.
 * panTo: { lat, lng, key } pans whenever key changes.
 * onAvailability(bool): told whether a map can be shown at all.
 */
export function MapCanvas({ className = 'h-72', label = 'Map', children, center = NAIROBI, onAvailability, ...props }) {
  const { provider, config } = useMapProvider();
  useEffect(() => { if (provider) onAvailability?.(provider !== 'none'); }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-[#e8eaed] ${className}`} role="region" aria-label={label}>
      {!provider ? <MapSkeleton /> : provider === 'none' ? <MapUnavailable /> : (
        <MapErrorBoundary provider={provider}>
          <Suspense fallback={<MapSkeleton />}>
            {provider === 'google'
              ? <GoogleMapCanvas key="google" apiKey={config.maps.googleApiKey} mapId={config.maps.googleMapId} center={center} {...props} />
              : <OpenMapCanvas key="open" center={center} {...props} />}
          </Suspense>
        </MapErrorBoundary>
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
