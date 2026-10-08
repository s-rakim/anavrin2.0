import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bike, CircleCheck, ClipboardList, MessageSquareText, Phone, Search, XCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { STATUS, dateTime, money, phoneLocal, timeAgo } from '../../lib/format';
import { LiquidSegmented } from '../../components/LiquidGlass';
import { OrderSteps, OrderTimeline } from '../../components/OrderTracker';
import { Drawer, EmptyState, PaymentBadge, Spinner, StatusBadge } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

const FILTERS = [
  { value: 'open', label: 'Open', match: (o) => ['placed', 'confirmed', 'assigned', 'out_for_delivery'].includes(o.status) },
  { value: 'placed', label: 'To confirm', match: (o) => o.status === 'placed' },
  { value: 'delivering', label: 'Delivering', match: (o) => ['assigned', 'out_for_delivery'].includes(o.status) },
  { value: 'delivered', label: 'Delivered', match: (o) => ['delivered', 'received'].includes(o.status) },
  { value: 'cancelled', label: 'Cancelled', match: (o) => o.status === 'cancelled' },
  { value: 'all', label: 'All', match: () => true },
];

export default function Orders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState(null);
  const [riders, setRiders] = useState([]);
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [o, r] = await Promise.all([api('/admin/orders'), api('/admin/riders')]);
      setOrders(o.orders);
      setRiders(r.riders);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useSocketEvent('order:updated', (o) => setOrders((prev) => prev && (prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [o, ...prev])));
  useSocketEvent('stats:changed', () => api('/admin/riders').then((r) => setRiders(r.riders)).catch(() => {}));

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.value, (orders || []).filter(f.match).length])), [orders]);
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter);
    const term = q.trim().toLowerCase();
    return (orders || []).filter(f.match).filter((o) => !term
      || o.code.toLowerCase().includes(term) || o.customer.name.toLowerCase().includes(term) || o.phone.includes(term.replace(/\s/g, '')));
  }, [orders, filter, q]);
  const selected = orders?.find((o) => o.id === selectedId) || null;

  const update = (o) => setOrders((prev) => prev.map((x) => (x.id === o.id ? o : x)));

  return (
    <>
      <AdminHeader title="Orders" subtitle="Confirm new orders, assign riders and follow every delivery live." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <LiquidSegmented size="sm" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))} />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, customer, phone" aria-label="Search orders" className="field rounded-full pl-10" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {error ? <EmptyState title="Couldn’t load orders" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState>
          : !orders ? <div className="space-y-px">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16" />)}</div>
          : visible.length === 0 ? <EmptyState icon={ClipboardList} title="No orders here">Orders matching this filter will appear as soon as they come in.</EmptyState>
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-silver-50 text-left text-xs font-semibold tracking-wider text-muted uppercase">
                  <tr><th className="px-5 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Items</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Rider</th></tr>
                </thead>
                <tbody className="divide-y divide-silver-200">
                  <AnimatePresence initial={false}>
                    {visible.map((o) => (
                      <motion.tr key={o.id} layout initial={{ opacity: 0, backgroundColor: '#e2eaf1' }} animate={{ opacity: 1, backgroundColor: 'rgba(255,255,255,0)' }}
                        exit={{ opacity: 0 }} transition={{ duration: 0.8 }}
                        onClick={() => setSelectedId(o.id)} className="cursor-pointer hover:bg-brand-50/60" tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedId(o.id)}>
                        <td className="px-5 py-3"><p className="font-semibold">{o.code}</p><p className="text-xs text-muted">{timeAgo(o.createdAt)}</p></td>
                        <td className="px-3 py-3"><p>{o.customer.name}</p><p className="text-xs text-muted tabular">{phoneLocal(o.phone)}</p></td>
                        <td className="px-3 py-3 text-ink-soft">{o.itemCount}</td>
                        <td className="px-3 py-3 text-right font-medium tabular">{money(o.total)}</td>
                        <td className="px-3 py-3"><PaymentBadge status={o.paymentStatus} method={o.paymentMethod} /></td>
                        <td className="px-3 py-3"><StatusBadge status={o.status} /></td>
                        <td className="px-3 py-3 text-ink-soft">{o.rider?.name || <span className="text-muted">—</span>}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
      </div>

      <OrderDrawer order={selected} riders={riders} onClose={() => setSelectedId(null)} onUpdated={update} toast={toast} />
    </>
  );
}

function OrderDrawer({ order, riders, onClose, onUpdated, toast }) {
  const [busy, setBusy] = useState('');
  const [riderId, setRiderId] = useState('');
  useEffect(() => { setRiderId(order?.rider?.id ? String(order.rider.id) : ''); }, [order?.id, order?.rider?.id]);

  const run = async (key, path, body, msg) => {
    setBusy(key);
    try {
      const { order: updated } = await api(`/admin/orders/${order.id}/${path}`, { method: 'POST', body });
      onUpdated(updated);
      toast(msg);
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      setBusy('');
    }
  };

  const canAssign = order && ['placed', 'confirmed', 'assigned'].includes(order.status);
  return (
    <Drawer open={!!order} onClose={onClose} title={order ? `Order ${order.code}` : ''}
      footer={order && ['placed', 'confirmed', 'assigned'].includes(order.status) && (
        <div className="flex flex-wrap gap-2">
          {order.status === 'placed' && (
            <button className="btn btn-primary flex-1" disabled={!!busy} onClick={() => run('confirm', 'status', { status: 'confirmed' }, `Order ${order.code} confirmed. Riders can now see it.`)}>
              {busy === 'confirm' ? <Spinner /> : <CircleCheck className="size-4" aria-hidden />} Confirm order
            </button>
          )}
          <button className="btn btn-danger" disabled={!!busy} onClick={() => {
            if (window.confirm(`Cancel order ${order.code}? Stock will be returned to inventory.`)) run('cancel', 'status', { status: 'cancelled' }, `Order ${order.code} cancelled and restocked.`);
          }}>{busy === 'cancel' ? <Spinner /> : <XCircle className="size-4" aria-hidden />} Cancel</button>
        </div>
      )}>
      {order && (
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} method={order.paymentMethod} /></div>
          <div className="card p-4"><OrderSteps status={order.status} /></div>

          <section className="card space-y-2 p-4 text-sm">
            <p className="font-semibold">{order.customer.name} <span className="font-normal text-muted">· {order.customer.email}</span></p>
            <a href={`tel:${order.phone}`} className="flex items-center gap-2 text-brand-700 hover:underline"><Phone className="size-4" aria-hidden /> {phoneLocal(order.phone)}</a>
            <p className="flex gap-2 text-ink-soft"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> {order.instructions}</p>
          </section>

          {canAssign && (
            <section className="card p-4">
              <label htmlFor="rider" className="field-label flex items-center gap-2"><Bike className="size-4 text-brand-600" aria-hidden /> Delivery rider</label>
              <div className="flex gap-2">
                <select id="rider" value={riderId} onChange={(e) => setRiderId(e.target.value)} className="field">
                  <option value="">{order.status === 'confirmed' ? 'Open to any rider' : 'Choose a rider…'}</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.area || 'Any area'} · {r.active} active</option>)}
                </select>
                <button className="btn btn-primary shrink-0" disabled={!!busy || (riderId === '' && !order.rider) || String(order.rider?.id || '') === riderId}
                  onClick={() => run('assign', 'assign', { riderId: riderId ? Number(riderId) : null }, riderId ? 'Rider assigned.' : 'Rider removed. The order is open to all riders.')}>
                  {busy === 'assign' ? <Spinner /> : riderId ? 'Assign' : 'Unassign'}
                </button>
              </div>
              {riders.length === 0 && <p className="field-hint">No active riders yet. Hire riders from the Riders page.</p>}
            </section>
          )}
          {!canAssign && order.rider && (
            <p className="card flex items-center gap-2 p-4 text-sm"><Bike className="size-4 text-brand-600" aria-hidden /> Delivered by <b>{order.rider.name}</b> · {phoneLocal(order.rider.phone)}</p>
          )}

          <section className="card p-4">
            <h3 className="text-sm font-semibold">Items</h3>
            <ul className="mt-2 divide-y divide-silver-200">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
                  <img src={it.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  <span className="text-muted tabular">{it.quantity} × {money(it.unitPrice)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-silver-200 pt-3 text-sm">
              <div className="flex justify-between text-ink-soft"><dt>Subtotal</dt><dd className="tabular">{money(order.subtotal)}</dd></div>
              <div className="flex justify-between text-ink-soft"><dt>Delivery</dt><dd className="tabular">{order.deliveryFee ? money(order.deliveryFee) : 'Free'}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular">{money(order.total)}</dd></div>
            </dl>
            {order.transaction && (
              <p className="mt-3 rounded-xl bg-ok-100 px-3 py-2 text-xs font-medium text-ok-700">
                {money(order.transaction.amount)} received via {order.transaction.method === 'mpesa' ? `M-Pesa (${order.transaction.reference})` : 'cash'} · {dateTime(order.transaction.createdAt)}
              </p>
            )}
          </section>

          <section className="card p-4">
            <h3 className="mb-3 text-sm font-semibold">Activity</h3>
            <OrderTimeline events={order.events} />
          </section>
          <p className="text-xs text-muted">Status key: {Object.entries(STATUS).slice(0, 6).map(([, v]) => v.label).join(' → ')}</p>
        </div>
      )}
    </Drawer>
  );
}
