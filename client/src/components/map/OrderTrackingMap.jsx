import { useState } from 'react';
import { motion } from 'motion/react';
import { Crosshair, Navigation, PauseCircle, Store } from 'lucide-react';
import { LIVE_STALE_MS, ageMs, distanceMeters, etaMinutes, formatDistance, useAnimatedPosition, useNow } from '../../lib/geo';
import { timeAgo } from '../../lib/format';
import { MapCanvas, MapFab } from './MapCanvas';

const RIDER_BLUE = '#1a73e8';

/**
 * Live delivery map: pickup point, the shopper's pin, the rider gliding along their trail,
 * and a dashed line for the rest of the way, with a Google-Maps-style ETA card.
 * `viewer` is 'customer' or 'admin'.
 */
export function OrderTrackingMap({ order, trail = [], store, viewer = 'customer', className = 'h-72 sm:h-80' }) {
  const [fitKey, setFitKey] = useState(0);
  const now = useNow(15000);
  const live = order.riderLocation && ['assigned', 'out_for_delivery'].includes(order.status) ? order.riderLocation : null;
  const stale = !!live && ageMs(live.at, now) > LIVE_STALE_MS;
  const rider = useAnimatedPosition(live);
  const dest = order.destination;

  const remaining = live && dest ? distanceMeters(live, dest) : null;
  const eta = etaMinutes(remaining);
  // Always current; the map only re-fits when the fit key changes (button press, rider appears/disappears).
  const fitPoints = [dest, live || (order.status !== 'out_for_delivery' ? store : null)].filter(Boolean);
  const autoFitKey = `${fitKey}-${live ? 'rider' : 'none'}-${order.status}`;

  if (!dest) return null;

  const markers = [
    store && { id: 'store', kind: 'store', position: store, title: store.name },
    { id: 'dest', kind: 'destination', position: dest, zIndex: 5, label: viewer === 'customer' ? 'You' : order.customer?.name?.split(' ')[0], title: dest.label || 'Drop-off point' },
    rider && { id: 'rider', kind: 'rider', position: rider, heading: stale ? null : live?.heading, stale, zIndex: 10, label: order.rider?.name?.split(' ')[0], title: `${order.rider?.name || 'Rider'}${stale ? ' (location paused)' : ''}` },
  ].filter(Boolean);

  const paths = [
    trail.length > 1 && { id: 'trail', points: [...trail, ...(rider ? [rider] : [])], color: RIDER_BLUE, width: 5 },
    rider && order.status === 'out_for_delivery' && { id: 'rest', points: [rider, dest], color: RIDER_BLUE, width: 4, dashed: true },
    rider && order.status === 'assigned' && store && { id: 'to-store', points: [rider, store], color: '#5f6368', width: 4, dashed: true },
  ].filter(Boolean);

  const sheet = (() => {
    if (order.status === 'delivered' || order.status === 'received') return { title: 'Delivered', body: dest.label || 'At your drop-off point' };
    if (order.status === 'out_for_delivery' && order.riderOnAnotherStop) {
      return { title: 'Your rider is finishing another delivery', body: 'You’ll see them on the map as soon as they head to you.', paused: true };
    }
    if (order.status === 'out_for_delivery' && live && stale) {
      return { title: 'Rider’s live location paused', body: `Last seen ${formatDistance(remaining)} away · ${timeAgo(live.at)}. They may be navigating or have weak signal.`, paused: true };
    }
    if (order.status === 'out_for_delivery' && live) {
      return { title: `Arriving in about ${eta} min`, body: `${formatDistance(remaining)} away · updated ${timeAgo(live.at)}`, live: true };
    }
    if (order.status === 'out_for_delivery') return { title: 'On the way', body: 'Waiting for the rider’s live location…' };
    if (order.status === 'assigned') return { title: live ? 'Rider heading to the store' : 'Rider assigned', body: `${order.rider?.name || 'Your rider'} is collecting your order` };
    return { title: 'Drop-off pinned', body: dest.label || 'The rider will navigate to this pin' };
  })();

  return (
    <MapCanvas className={className} label={`Delivery map for order ${order.code}`} center={dest} zoom={14}
      markers={markers} paths={paths} fitPoints={fitPoints} fitKey={autoFitKey}>
      <div className="absolute top-3 right-3 z-[1100]">
        <MapFab onClick={() => setFitKey((k) => k + 1)} label="Recenter map"><Crosshair className="size-5" /></MapFab>
      </div>
      <motion.div layout initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="absolute inset-x-3 bottom-6 z-[1100] flex items-center gap-3 rounded-[20px] bg-white px-4 py-3 shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)] sm:right-auto sm:max-w-sm">
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${sheet.live ? 'bg-[#e8f0fe] text-[#1a73e8]' : sheet.paused ? 'bg-warn-100 text-warn-700' : 'bg-silver-100 text-brand-700'}`}>
          {sheet.live ? <Navigation className="size-5" aria-hidden /> : sheet.paused ? <PauseCircle className="size-5" aria-hidden /> : <Store className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0">
          <motion.span key={sheet.title} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="block text-[15px] font-semibold text-[#202124]">{sheet.title}</motion.span>
          <span className={`block text-[13px] text-[#5f6368] ${sheet.paused ? '' : 'truncate'}`}>{sheet.body}</span>
        </span>
      </motion.div>
    </MapCanvas>
  );
}
