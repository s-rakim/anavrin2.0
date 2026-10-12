import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Bike, Crosshair, MapPinned, Phone, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { STATUS, phoneLocal, timeAgo } from '../../lib/format';
import { LIVE_STALE_MS, ageMs, distanceMeters, formatDistance, useNow } from '../../lib/geo';
import { MapCanvas, MapFab } from '../../components/map/MapCanvas';
import { googleSafe, useMapProvider } from '../../components/map/provider';
import { Chip, EmptyState, StatusBadge } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

const ACTIVE = ['placed', 'confirmed', 'assigned', 'out_for_delivery'];
const LEGEND = [
  ['placed', '#b7791f'],
  ['confirmed', '#295f81'],
  ['out_for_delivery', '#5b2d8e'],
];

/** Live fleet map: every rider's last position and every open order's drop-off pin. */
export default function LiveMap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState(null);
  const [focusSeq, setFocusSeq] = useState(0);
  // Each tap re-centres, even on the same rider or order after the map was moved.
  const focusOn = (f) => { setFocus(f); setFocusSeq((n) => n + 1); };
  const [fitKey, setFitKey] = useState(0);
  // Full-page map on desktop: one finger/wheel moves it. On phones the page must still scroll past it.
  const [wide] = useState(() => window.matchMedia('(min-width: 1280px)').matches);
  const now = useNow(15000);
  // "Online" means a fix within the last 2 minutes, re-evaluated as time passes.
  const isOnline = (r) => ageMs(r.at, now) < 2 * 60 * 1000;

  const load = useCallback(async () => {
    try { setError(''); setData(await api('/admin/fleet')); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useSocketEvent('fleet:location', (loc) => setData((d) => d && {
    ...d,
    riders: d.riders.map((r) => (r.id === loc.riderId ? { ...r, lat: loc.lat, lng: loc.lng, heading: loc.heading, at: loc.at, online: true } : r)),
  }));
  useSocketEvent('order:updated', (o) => setData((d) => {
    if (!d) return d;
    const rest = d.orders.filter((x) => x.id !== o.id);
    return { ...d, orders: ACTIVE.includes(o.status) ? [o, ...rest] : rest };
  }));
  useSocketEvent('stats:changed', () => api('/admin/fleet').then((f) => setData((d) => (d ? { ...d, riders: f.riders } : f))).catch(() => {}));

  const { provider } = useMapProvider();
  const orders = useMemo(() => (data?.orders || []).map((o) => ({ ...o, destination: googleSafe(o.destination, provider) })), [data, provider]);
  const pinned = useMemo(() => orders.filter((o) => o.destination?.onMap), [orders]);
  const located = useMemo(() => (data?.riders || []).filter((r) => r.lat != null), [data]);
  // Always current; the map only re-fits when fitKey changes.
  const fitPoints = [data?.store, ...pinned.map((o) => o.destination), ...located.map((r) => ({ lat: r.lat, lng: r.lng }))].filter(Boolean);

  const markers = [
    data?.store && { id: 'store', kind: 'store', position: data.store, title: data.store.name, label: 'Store' },
    ...pinned.map((o) => ({
      id: `o${o.id}`, kind: 'order', status: o.status, position: o.destination, label: o.code, title: `${o.code} · ${o.customer.name}`,
      onClick: () => focusOn({ type: 'order', id: o.id }), zIndex: 5,
    })),
    ...located.map((r) => ({
      id: `r${r.id}`, kind: 'rider', position: { lat: r.lat, lng: r.lng }, heading: ageMs(r.at, now) > LIVE_STALE_MS ? null : r.heading,
      stale: ageMs(r.at, now) > LIVE_STALE_MS, label: r.name.split(' ')[0],
      title: `${r.name}${isOnline(r) ? '' : ` · last seen ${timeAgo(r.at)}`}`, onClick: () => focusOn({ type: 'rider', id: r.id }), zIndex: 10,
    })),
  ].filter(Boolean);

  const paths = located.flatMap((r) => r.orders.map((ro) => {
    const o = pinned.find((x) => x.id === ro.id);
    return o && o.status === 'out_for_delivery'
      ? { id: `p${r.id}-${o.id}`, points: [{ lat: r.lat, lng: r.lng }, o.destination], color: '#5b2d8e', width: 3, dashed: true }
      : null;
  })).filter(Boolean);

  const focused = focus?.type === 'order' ? pinned.find((o) => o.id === focus.id) : focus?.type === 'rider' ? located.find((r) => r.id === focus.id) : null;
  const panTo = focused ? { ...(focus.type === 'order' ? focused.destination : { lat: focused.lat, lng: focused.lng }), key: `${focus.type}${focus.id}-${focusSeq}` } : null;

  return (
    <>
      <AdminHeader title="Live map" subtitle="Riders and open orders across the city, updating as riders move." />
      {error ? <div className="card"><EmptyState title="Couldn’t load the live map" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState></div> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <MapCanvas className="h-[55dvh] min-h-[320px] xl:h-[calc(100dvh-170px)]" label="Live fleet map"
            center={data?.store} zoom={12} markers={markers} paths={paths} fitPoints={fitPoints} fitKey={`${fitKey}-${data ? 1 : 0}`} panTo={panTo}
            onMapClick={() => setFocus(null)} gestures={wide ? 'greedy' : 'cooperative'}>
            <div className="absolute top-3 right-3 z-[1100]">
              <MapFab onClick={() => { setFocus(null); setFitKey((k) => k + 1); }} label="Show everything"><Crosshair className="size-5" /></MapFab>
            </div>
            <ul className="absolute bottom-6 left-3 z-[1100] flex flex-wrap gap-1.5" aria-label="Order pin colours">
              {LEGEND.map(([s, c]) => (
                <li key={s} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#3c4043] shadow">
                  <span className="size-2.5 rounded-full" style={{ background: c }} aria-hidden />{STATUS[s].label}
                </li>
              ))}
            </ul>
            {focused && (
              <motion.div key={`${focus.type}${focus.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="absolute top-3 right-16 left-3 z-[1100] max-w-sm rounded-[20px] bg-white p-4 pr-10 shadow-[0_1px_3px_rgb(60_64_67/0.3),0_4px_8px_3px_rgb(60_64_67/0.15)] sm:right-auto">
                <button onClick={() => setFocus(null)} aria-label="Close details"
                  className="absolute top-2 right-2 grid size-9 place-items-center rounded-full text-[#5f6368] hover:bg-[#f1f3f4]"><X className="size-4" /></button>
                {focus.type === 'order' ? (
                  <>
                    <div className="flex items-center justify-between gap-2"><p className="font-semibold">{focused.code}</p><StatusBadge status={focused.status} /></div>
                    <p className="mt-1 text-sm text-ink-soft">{focused.customer.name} · {phoneLocal(focused.phone)}</p>
                    {focused.destination.label && <p className="text-xs text-muted">{focused.destination.label}</p>}
                    <p className="mt-1 text-xs text-muted">{focused.rider ? `Rider: ${focused.rider.name}` : 'No rider yet'}</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">{focused.name}</p>
                    <a href={`tel:${focused.phone}`} className="text-sm text-brand-700 hover:underline">{phoneLocal(focused.phone)}</a>
                    <p className="text-xs text-muted">{isOnline(focused) ? 'Online now' : `Last seen ${timeAgo(focused.at)}`} · {focused.orders.length} active</p>
                  </>
                )}
              </motion.div>
            )}
          </MapCanvas>

          <aside className="space-y-4">
            <section className="card p-4">
              <h2 className="flex items-center gap-2 font-semibold"><Bike className="size-4 text-brand-600" aria-hidden /> Riders</h2>
              {!data ? <div className="skeleton mt-3 h-24 rounded-xl" /> : data.riders.length === 0 ? <p className="mt-3 text-sm text-muted">No active riders yet.</p> : (
                <ul className="mt-2 divide-y divide-silver-200">
                  {data.riders.map((r) => (
                    <li key={r.id}>
                      <button className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-default" disabled={r.lat == null}
                        aria-label={`Show ${r.name} on the map`} onClick={() => focusOn({ type: 'rider', id: r.id })}>
                        <span className={`size-2.5 shrink-0 rounded-full ${isOnline(r) ? 'bg-ok-700' : 'bg-silver-400'}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.name}</span>
                          <span className="block text-xs text-muted">{r.lat == null ? 'Location not shared yet' : isOnline(r) ? 'Online' : `Last seen ${timeAgo(r.at)}`}</span>
                        </span>
                        {r.orders.length > 0 && <Chip tone="berry">{r.orders.length} active</Chip>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card p-4">
              <h2 className="flex items-center gap-2 font-semibold"><MapPinned className="size-4 text-brand-600" aria-hidden /> Open orders</h2>
              {!data ? <div className="skeleton mt-3 h-24 rounded-xl" /> : data.orders.length === 0 ? <p className="mt-3 text-sm text-muted">No open orders.</p> : (
                <ul className="mt-2 max-h-[44dvh] divide-y divide-silver-200 overflow-auto">
                  {orders.map((o) => {
                    const rider = o.rider && located.find((r) => r.id === o.rider.id);
                    const away = rider && o.destination ? distanceMeters(rider, o.destination) : null;
                    return (
                      <li key={o.id}>
                        <button className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-default" disabled={!o.destination?.onMap}
                          onClick={() => focusOn({ type: 'order', id: o.id })}>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{o.code} · {o.customer.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {o.destination ? (o.destination.label || 'Pinned') : 'No pin'}{away != null ? ` · rider ${formatDistance(away)} away` : ''}
                            </span>
                          </span>
                          <StatusBadge status={o.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {data?.riders.some((r) => r.phone) && <p className="flex items-center gap-1.5 text-xs text-muted"><Phone className="size-3.5" aria-hidden /> Tap a rider for their number.</p>}
          </aside>
        </div>
      )}
    </>
  );
}
