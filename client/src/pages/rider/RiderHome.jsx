import { useCallback, useEffect, useMemo, useState } from 'react';

import { AnimatePresence, motion } from 'motion/react';
import {
  Banknote, Bike, CircleCheck, Hand, MessageCircle, MessageSquareText, Navigation, PackageCheck, PackageOpen, Phone, Smartphone, Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { money, phoneDigits, phoneLocal, timeAgo } from '../../lib/format';
import { LiquidSegmented } from '../../components/LiquidGlass';
import { CountUp, Page, Redirect, Reveal } from '../../components/Motion';
import { OrderSteps } from '../../components/OrderTracker';
import { EmptyState, LiveIndicator, Modal, PaymentBadge, Spinner, StatusBadge } from '../../components/ui';

/** Rider landing page: delivery count, buyer contact & directions, payment confirmation and delivery status. */
export default function RiderHome() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState(null);
  const [mine, setMine] = useState(null);
  const [pool, setPool] = useState(null);
  const [tab, setTab] = useState('active');
  const [paying, setPaying] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadSummary = useCallback(() => api('/rider/summary').then(setSummary).catch(() => {}), []);
  const load = useCallback(async () => {
    try {
      setError('');
      const [a, b] = await Promise.all([api('/rider/orders'), api('/rider/available')]);
      setMine(a.orders);
      setPool(b.orders);
      loadSummary();
    } catch (err) {
      setError(err.message);
    }
  }, [loadSummary]);

  useEffect(() => { if (user?.role === 'rider' && user.status === 'active') load(); }, [user, load]);

  // Live: new pickups appear, assigned jobs update, jobs taken by others disappear.
  useSocketEvent('pool:upsert', (o) => {
    setPool((prev) => {
      if (!prev) return prev;
      if (!prev.some((x) => x.id === o.id)) toast(`${o.itemCount} item${o.itemCount === 1 ? '' : 's'} · ${money(o.total)}`, { title: 'New delivery available', type: 'info' });
      return prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [o, ...prev];
    });
    loadSummary();
  });
  useSocketEvent('pool:remove', ({ id }) => { setPool((prev) => prev && prev.filter((x) => x.id !== id)); loadSummary(); });
  useSocketEvent('order:updated', (o) => {
    if (o.rider?.id !== user?.id) return;
    setMine((prev) => {
      if (!prev) return prev;
      if (!prev.some((x) => x.id === o.id)) toast(`Order ${o.code} has been assigned to you.`, { title: 'New delivery', type: 'info' });
      return prev.some((x) => x.id === o.id) ? prev.map((x) => (x.id === o.id ? o : x)) : [o, ...prev];
    });
    loadSummary();
  });
  useSocketEvent('order:removed', ({ id }) => { setMine((prev) => prev && prev.filter((x) => x.id !== id)); loadSummary(); });

  const active = useMemo(() => (mine || []).filter((o) => ['assigned', 'out_for_delivery'].includes(o.status)), [mine]);
  const done = useMemo(() => (mine || []).filter((o) => ['delivered', 'received'].includes(o.status)), [mine]);

  if (!user) return <Redirect to="/login" replace />;
  if (user.role !== 'rider') return <Redirect to="/" replace />;
  if (user.status !== 'active') return <Redirect to="/rider/status" replace />;

  const act = async (order, path, msg) => {
    setBusyId(order.id);
    try {
      const { order: updated } = await api(`/rider/orders/${order.id}/${path}`, { method: 'POST', body: {} });
      setMine((prev) => (prev.some((x) => x.id === updated.id) ? prev.map((x) => (x.id === updated.id ? updated : x)) : [updated, ...prev]));
      if (path === 'claim') { setPool((prev) => prev.filter((x) => x.id !== order.id)); setTab('active'); }
      toast(msg);
      loadSummary();
    } catch (err) {
      toast(err.message, { type: 'error' });
      if (path === 'claim') setPool((prev) => prev.filter((x) => x.id !== order.id));
    } finally {
      setBusyId(null);
    }
  };

  const stats = [
    { label: 'Active deliveries', value: summary?.active, icon: Bike },
    { label: 'Delivered today', value: summary?.deliveredToday, icon: PackageCheck },
    { label: 'Collected today', value: summary?.collectedToday, icon: Wallet, money: true },
    { label: 'All-time deliveries', value: summary?.deliveredTotal, icon: CircleCheck },
  ];

  return (
    <Page className="mx-auto max-w-5xl px-4 pt-28 pb-36 sm:px-6 sm:pt-32">
      <Reveal className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Rider dashboard</p>
          <h1 className="section-title mt-1">Sasa, {user.name.split(' ')[0]}</h1>
        </div>
        <LiveIndicator label="On shift · live" />
      </Reveal>

      <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <motion.li key={s.label} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} className="card p-4">
            <s.icon className="size-5 text-brand-600" aria-hidden />
            <p className="mt-3 text-2xl font-semibold text-ink">
              {s.value === undefined ? <span className="skeleton inline-block h-7 w-12 rounded" /> : <CountUp value={s.value} format={s.money ? money : undefined} />}
            </p>
            <p className="text-xs font-medium text-muted">{s.label}</p>
          </motion.li>
        ))}
      </motion.ul>

      <div className="sticky top-[88px] z-20 mt-8 py-2">
        <LiquidSegmented value={tab} onChange={setTab} options={[
          { value: 'active', label: 'My deliveries', count: active.length },
          { value: 'pool', label: 'Available', count: pool?.length ?? 0 },
          { value: 'done', label: 'Completed', count: done.length },
        ]} />
      </div>

      {error && <div className="card mt-4"><EmptyState title="Couldn’t load deliveries" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState></div>}

      {!mine && !error ? (
        <div className="mt-4 space-y-4">{[0, 1].map((i) => <div key={i} className="skeleton h-64 rounded-3xl" />)}</div>
      ) : mine && (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="mt-4">
            {tab === 'active' && (active.length === 0 ? (
              <div className="card"><EmptyState icon={Bike} title="No deliveries assigned" action={<button className="btn btn-primary" onClick={() => setTab('pool')}>See available deliveries</button>}>
                Accept a delivery from the Available tab, or wait for the team to assign one to you.
              </EmptyState></div>
            ) : (
              <motion.div layout className="space-y-5">
                <AnimatePresence initial={false}>
                  {active.map((o) => (
                    <DeliveryCard key={o.id} order={o} busy={busyId === o.id}
                      onPickup={() => act(o, 'pickup', `Order ${o.code} is now on the way.`)}
                      onPay={() => setPaying(o)}
                      onDeliver={() => act(o, 'deliver', `Order ${o.code} delivered. The customer will confirm receipt.`)} />
                  ))}
                </AnimatePresence>
              </motion.div>
            ))}

            {tab === 'pool' && ((pool || []).length === 0 ? (
              <div className="card"><EmptyState icon={PackageOpen} title="Nothing waiting right now">New confirmed orders appear here instantly.</EmptyState></div>
            ) : (
              <motion.ul layout className="grid gap-4 md:grid-cols-2">
                <AnimatePresence initial={false}>
                  {pool.map((o) => (
                    <motion.li key={o.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 40 }}
                      className="card flex flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="font-semibold">Order {o.code}</p><p className="text-xs text-muted">Confirmed {timeAgo(o.createdAt)}</p></div>
                        <span className="text-lg font-semibold tabular">{money(o.total)}</span>
                      </div>
                      <p className="mt-3 text-sm text-ink-soft">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                      <p className="mt-2 text-xs text-muted">Collect via {o.paymentMethod === 'mpesa' ? 'M-Pesa' : 'cash'} on delivery. Buyer contact and directions unlock when you accept.</p>
                      <button className="btn btn-primary mt-4" disabled={busyId === o.id} onClick={() => act(o, 'claim', `You’ve accepted order ${o.code}.`)}>
                        {busyId === o.id ? <Spinner /> : <Hand className="size-4" aria-hidden />} Accept delivery
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            ))}

            {tab === 'done' && (done.length === 0 ? (
              <div className="card"><EmptyState icon={PackageCheck} title="No completed deliveries yet" /></div>
            ) : (
              <ul className="space-y-3">
                {done.map((o) => (
                  <li key={o.id} className="card flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Order {o.code} · {o.customer.name}</p><p className="text-xs text-muted">{timeAgo(o.updatedAt)} · {money(o.total)}</p></div>
                    <PaymentBadge status={o.paymentStatus} method={o.paymentMethod} />
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      <PaymentModal order={paying} onClose={() => setPaying(null)} onDone={(updated) => {
        setMine((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        toast(`${money(updated.total)} recorded for ${updated.code}.`, { title: 'Payment confirmed' });
        loadSummary();
      }} />
    </Page>
  );
}

function DeliveryCard({ order, busy, onPickup, onPay, onDeliver }) {
  const paid = order.paymentStatus === 'paid';
  const wa = `https://wa.me/${phoneDigits(order.phone)}?text=${encodeURIComponent(`Hi ${order.customer.name.split(' ')[0]}, this is your Anavrin rider with order ${order.code}.`)}`;
  return (
    <motion.article layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 80 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver-200 bg-silver-50 px-5 py-3.5">
        <p className="font-semibold">Order {order.code}</p>
        <div className="flex flex-wrap gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} method={order.paymentMethod} /></div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted uppercase">Customer</p>
            <p className="mt-1 text-lg font-semibold">{order.customer.name}</p>
            <a href={`tel:${order.phone}`} className="text-[15px] font-medium text-brand-700 tabular hover:underline">{phoneLocal(order.phone)}</a>
          </div>
          <div className="rounded-2xl bg-brand-50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-brand-700 uppercase"><Navigation className="size-3.5" aria-hidden /> Directions from the buyer</p>
            <p className="mt-1.5 flex gap-2 text-[15px] leading-relaxed text-ink"><MessageSquareText className="mt-1 size-4 shrink-0 text-brand-600" aria-hidden />{order.instructions}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a href={`tel:${order.phone}`} className="btn btn-secondary btn-sm"><Phone className="size-4" aria-hidden /> Call</a>
            <a href={`sms:${order.phone}`} className="btn btn-secondary btn-sm"><MessageSquareText className="size-4" aria-hidden /> SMS</a>
            <a href={wa} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><MessageCircle className="size-4" aria-hidden /> WhatsApp</a>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">Items</p>
          <ul className="mt-2 divide-y divide-silver-200">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-2">
                <img src={it.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
                <span className="text-sm text-muted tabular">× {it.quantity}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-silver-100 px-4 py-3">
            <span className="text-sm text-ink-soft">{paid ? 'Collected' : `Collect (${order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'cash'})`}</span>
            <span className="text-xl font-semibold tabular">{money(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4"><OrderSteps status={order.status} compact /></div>

      {/* Actions sit at the bottom of the card, within easy thumb reach. */}
      <div className="grid gap-2 border-t border-silver-200 bg-silver-50 p-4 sm:grid-cols-3">
        <button className="btn btn-secondary" disabled={busy || order.status !== 'assigned'} onClick={onPickup}>
          <Bike className="size-4" aria-hidden /> {order.status === 'assigned' ? 'Start delivery' : 'On the way'}
        </button>
        <button className={`btn ${paid ? 'border border-ok-700/20 bg-ok-100 text-ok-700' : 'btn-secondary'}`} disabled={busy || paid} onClick={onPay}>
          {paid ? <><CircleCheck className="size-4" aria-hidden /> Payment confirmed</> : <><Wallet className="size-4" aria-hidden /> Confirm payment</>}
        </button>
        <button className="btn btn-primary" disabled={busy || !paid} onClick={onDeliver} title={paid ? undefined : 'Confirm payment first'}>
          {busy ? <Spinner /> : <PackageCheck className="size-4" aria-hidden />} Mark delivered
        </button>
      </div>
    </motion.article>
  );
}

function PaymentModal({ order, onClose, onDone }) {
  const [method, setMethod] = useState('mpesa');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) { setMethod(order.paymentMethod); setReference(''); setError(''); setBusy(false); }
  }, [order]);

  const submit = async (e) => {
    e.preventDefault();
    if (method === 'mpesa' && !/^[A-Z0-9]{8,12}$/.test(reference.trim().toUpperCase())) {
      setError('Enter the M-Pesa confirmation code from the SMS, e.g. SJK4H7XQ2P.');
      return;
    }
    setBusy(true);
    try {
      const { order: updated } = await api(`/rider/orders/${order.id}/payment`, { method: 'POST', body: { method, reference: reference.trim() } });
      onDone(updated);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal open={!!order} onClose={onClose} title={order ? `Confirm payment · ${order.code}` : ''}>
      {order && (
        <form onSubmit={submit} className="space-y-5 p-5">
          <div className="rounded-2xl bg-brand-50 p-4 text-center">
            <p className="text-sm text-ink-soft">Amount to collect from {order.customer.name}</p>
            <p className="mt-1 text-3xl font-semibold tabular">{money(order.total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment received via">
            {[['mpesa', 'M-Pesa', Smartphone], ['cash', 'Cash', Banknote]].map(([v, label, Icon]) => (
              <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${method === v ? 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-200' : 'border-silver-300 text-ink-soft'}`}>
                <input type="radio" name="pm" value={v} checked={method === v} onChange={() => setMethod(v)} className="sr-only" />
                <Icon className="size-4" aria-hidden /> {label}
              </label>
            ))}
          </div>
          {method === 'mpesa' && (
            <div>
              <label htmlFor="ref" className="field-label">M-Pesa confirmation code</label>
              <input id="ref" value={reference} onChange={(e) => setReference(e.target.value.toUpperCase())} className="field font-mono tracking-widest uppercase"
                placeholder="SJK4H7XQ2P" autoComplete="off" maxLength={12} />
              <p className="field-hint">Check the customer’s M-Pesa SMS for the 10-character code.</p>
            </div>
          )}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary h-12 w-full" disabled={busy}>
            {busy ? <><Spinner /> Recording…</> : `I’ve received ${money(order.total)}`}
          </button>
        </form>
      )}
    </Modal>
  );
}
