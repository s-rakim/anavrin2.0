import { useState } from 'react';
import { Crosshair, ExternalLink, Navigation } from 'lucide-react';
import { directionsUrl, distanceMeters, etaMinutes, formatDistance, pinUrl } from '../../lib/geo';
import { MapCanvas, MapFab } from './MapCanvas';

/**
 * The rider's view of a delivery: their own position, the pickup point and the shopper's pin,
 * with a one-tap hand-off to turn-by-turn navigation in the Google Maps app.
 */
export function RiderDeliveryMap({ order, me, store }) {
  const [fitKey, setFitKey] = useState(0);
  const dest = order.destination;
  const headingToStore = order.status === 'assigned' && store;
  const target = headingToStore ? store : dest;
  const remaining = me && target ? distanceMeters(me, target) : null;
  // Always current; the map only re-fits when the key changes (button press, first GPS fix, leg change).
  const fitPoints = [dest, me, headingToStore ? store : null].filter(Boolean);

  if (!dest) return null;
  const markers = [
    store && { id: 'store', kind: 'store', position: store, title: store.name, label: headingToStore ? 'Pick up' : undefined },
    { id: 'dest', kind: 'destination', position: dest, zIndex: 5, label: order.customer.name.split(' ')[0], title: dest.label || 'Drop-off' },
    me && { id: 'me', kind: 'me', position: me, heading: me.heading, zIndex: 10, title: 'You' },
  ].filter(Boolean);
  const paths = me && target ? [{ id: 'leg', points: [me, target], color: '#1a73e8', width: 4, dashed: true }] : [];

  return (
    <div>
      <MapCanvas className="h-64 sm:h-72" label={`Map for order ${order.code}`} center={dest} zoom={14}
        markers={markers} paths={paths} fitPoints={fitPoints} fitKey={`${fitKey}-${me ? 'gps' : 'none'}-${order.status}`}>
        <div className="absolute top-3 right-3 z-[1100]">
          <MapFab onClick={() => setFitKey((k) => k + 1)} label="Recenter map"><Crosshair className="size-5" /></MapFab>
        </div>
        {remaining != null && (
          <div className="absolute top-3 left-3 z-[1100] rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-[#202124] shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)]">
            {headingToStore ? 'To store' : 'To customer'} · {formatDistance(remaining)} · ~{etaMinutes(remaining)} min
          </div>
        )}
      </MapCanvas>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <a href={directionsUrl(target)} target="_blank" rel="noreferrer"
          className="btn h-12 bg-[#1a73e8] text-white shadow-[0_1px_3px_rgb(60_64_67/0.3)] hover:bg-[#1765cc]">
          <Navigation className="size-4" aria-hidden /> Navigate {headingToStore ? 'to store' : `to ${order.customer.name.split(' ')[0]}`} in Google Maps
        </a>
        <a href={pinUrl(dest)} target="_blank" rel="noreferrer" className="btn btn-secondary h-12" aria-label="Open the drop-off pin in Google Maps" title="Open pin">
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
      {dest.label && <p className="mt-2 text-[13px] text-muted">Pinned: {dest.label}</p>}
    </div>
  );
}
