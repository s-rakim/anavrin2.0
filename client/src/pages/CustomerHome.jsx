import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bike, ChevronDown, MessageSquareText, PackageCheck, PackageOpen, Phone, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { STATUS, dateTime, money, phoneDigits, phoneLocal, timeAgo } from '../lib/format';
import { OrderSteps, OrderTimeline } from '../components/OrderTracker';
import { ProductCard } from '../components/ProductCard';
import { Page, Reveal } from '../components/Motion';
import { EmptyState, LiveIndicator, Modal, PaymentBadge, Spinner, StatusBadge } from '../components/ui';

const ACTIVE = ['placed', 'confirmed', 'assigned', 'out_for_delivery', 'delivered'];

/** The shopper's home page: live order tracking, receipt confirmation and history. */
export default function CustomerHome() {
  const { user } = useAuth();
  const { products } = useCatalog();
  const { toast } = useToast();
  const location = useLocation();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const { orders: list } = await api('/orders/mine');
      setOrders(list);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { if (user?.role === 'customer') load(); }, [user, load]);

  useSocketEvent('order:updated', (order) => {
    setOrders((prev) => {
      if (!prev) return prev;
      const before = prev.find((o) => o.id === order.id);
      if (before && before.status !== order.status && order.status !== 'received') {
        toast(STATUS[order.status]?.label || order.status, { title: `Order ${order.code}`, type: 'info' });
      }
      return before ? prev.map((o) => (o.id === order.id ? order : o)) : [order, ...prev];
    });
  });

  const active = useMemo(() => (orders || []).filter((o) => ACTIVE.includes(o.status)), [orders]);
  const past = useMemo(() => (orders || []).filter((o) => !ACTIVE.includes(o.status)), [orders]);
  const picks = useMemo(() => [...products].sort((a, b) => b.rating - a.rating).slice(0, 4), [products]);

  if (!user) return <Navigate to="/login" replace state={{ from: '/home' }} />;
  if (user.role !== 'customer') return <Navigate to={user.role === 'admin' ? '/admin' : '/rider'} replace />;

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-28 pb-32 sm:px-6 sm:pt-32">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your home</p>
          <h1 className="section-title mt-1">Habari, {user.name.split(' ')[0]}</h1>
          <p className="mt-2 text-muted">Track your deliveries live and confirm when they arrive.</p>
        </div>
        <div className="flex items-center gap-3">
          <LiveIndicator label="Live updates" />
          <Link to="/" className="btn btn-primary"><ShoppingBag className="size-4" aria-hidden /> Shop</Link>
        </div>
      </Reveal>

      {error && (
        <div className="card mt-8"><EmptyState title="We couldn’t load your orders" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState></div>
      )}

      {!orders && !error ? (
        <div className="mt-8 space-y-4">{[0, 1].map((i) => <div key={i} className="skeleton h-56 rounded-3xl" />)}</div>
      ) : orders && (
        <>
          <section className="mt-10" aria-labelledby="active-h">
            <h2 id="active-h" className="text-lg font-semibold">Active orders <span className="text-muted tabular">({active.length})</span></h2>
            {active.length === 0 ? (
              <div className="card mt-4">
                <EmptyState icon={PackageOpen} title="No active orders" action={<Link to="/" className="btn btn-primary">Start shopping</Link>}>
                  When you place an order, you’ll see it move here in real time.
                </EmptyState>
              </div>
            ) : (
              <motion.div layout className="mt-4 space-y-5">
                <AnimatePresence initial={false}>
                  {active.map((o, i) => (
                    <ActiveOrderCard key={o.id} order={o} index={i} highlight={location.state?.highlight === o.id} onConfirm={() => setConfirming(o)} />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </section>

          {past.length > 0 && (
            <section className="mt-14" aria-labelledby="past-h">
              <Reveal><h2 id="past-h" className="text-lg font-semibold">Order history</h2></Reveal>
              <div className="mt-4 space-y-3">
                {past.map((o, i) => <PastOrderRow key={o.id} order={o} index={i} />)}
              </div>
            </section>
          )}
        </>
      )}

      {picks.length > 0 && (
        <section className="mt-16">
          <Reveal><h2 className="section-title text-3xl">Top rated for you</h2></Reveal>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {picks.map((p, i) => <ProductCard key={p.id} product={p} index={i} scope="home" />)}
          </div>
        </section>
      )}

      <ConfirmReceipt order={confirming} onClose={() => setConfirming(null)}
        onDone={(order) => { setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o))); toast('Thanks for shopping with Anavrin.', { title: 'Receipt confirmed' }); }} />
    </Page>
  );
}

function ActiveOrderCard({ order, index, highlight, onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0, boxShadow: highlight ? ['0 0 0 0 rgba(59,115,150,0.5)', '0 0 0 12px rgba(59,115,150,0)'] : undefined }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.5, delay: index * 0.06, boxShadow: { duration: 1.4, repeat: 2 } }}
      className="card overflow-hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-silver-200 bg-silver-50 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-ink">Order {order.code}</p>
          <p className="text-xs text-muted">Placed {timeAgo(order.createdAt)} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {money(order.total)}</p>
        </div>
        <div className="flex flex-wrap gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} method={order.paymentMethod} /></div>
      </div>

      <div className="px-5 py-6"><OrderSteps status={order.status} /></div>

      <AnimatePresence initial={false}>
        {order.rider && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mx-5 mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4">
              <span className="grid size-11 place-items-center rounded-full bg-brand-800 text-white"><Bike className="size-5" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{order.rider.name} is your rider</p>
                <p className="text-xs text-muted">{order.status === 'out_for_delivery' ? 'On the way to you now' : 'Getting your order ready to go'}</p>
              </div>
              {order.rider.phone && (
                <a href={`tel:${order.rider.phone}`} className="btn btn-secondary btn-sm"><Phone className="size-4" aria-hidden /> Call {phoneLocal(order.rider.phone)}</a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {order.status === 'delivered' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok-700/20 bg-ok-100 p-4">
          <p className="text-sm font-medium text-ok-700">Your rider marked this order as delivered. Did everything arrive?</p>
          <button className="btn btn-primary" onClick={onConfirm}><PackageCheck className="size-4" aria-hidden /> Confirm receipt</button>
        </motion.div>
      )}

      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-between border-t border-silver-200 px-5 py-3.5 text-sm font-medium text-ink-soft hover:bg-silver-50">
        Order details
        <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="size-4" aria-hidden /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-6 px-5 pt-2 pb-6 md:grid-cols-2">
              <div>
                <ul className="divide-y divide-silver-200">
                  {order.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 py-2.5">
                      <img src={it.imageUrl} alt="" className="size-12 rounded-lg object-cover" />
                      <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
                      <span className="text-sm text-muted tabular">× {it.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-2 rounded-xl bg-silver-100 p-3 text-sm">
                  <p className="flex items-center gap-2"><Phone className="size-4 text-muted" aria-hidden /> {phoneLocal(order.phone)}</p>
                  <p className="flex gap-2"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> {order.instructions}</p>
                </div>
              </div>
              <OrderTimeline events={order.events} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function PastOrderRow({ order, index }) {
  return (
    <Reveal delay={Math.min(index, 6) * 0.04} className="card flex flex-wrap items-center gap-4 p-4">
      <div className="flex -space-x-3">
        {order.items.slice(0, 3).map((it) => <img key={it.id} src={it.imageUrl} alt="" className="size-11 rounded-full border-2 border-white object-cover" />)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Order {order.code}</p>
        <p className="text-xs text-muted">{dateTime(order.createdAt)} · {money(order.total)}</p>
      </div>
      <StatusBadge status={order.status} />
    </Reveal>
  );
}

function ConfirmReceipt({ order, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setError(''); setBusy(false); }, [order?.id]);
  const confirm = async () => {
    setBusy(true);
    try {
      const { order: updated } = await api(`/orders/${order.id}/confirm-receipt`, { method: 'POST', body: {} });
      onDone(updated);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal open={!!order} onClose={onClose} title="Confirm you received your order">
      {order && (
        <div className="p-5">
          <p className="text-sm text-ink-soft">Please check that all {order.itemCount} item{order.itemCount === 1 ? '' : 's'} in order <b>{order.code}</b> arrived in good condition.</p>
          <ul className="mt-4 divide-y divide-silver-200 rounded-2xl border border-silver-200">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <img src={it.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                <span className="flex-1">{it.name}</span><span className="text-muted tabular">× {it.quantity}</span>
              </li>
            ))}
          </ul>
          {error && <p className="mt-3 text-sm font-medium text-danger-700" role="alert">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <a href={`tel:${'+254700000001'}`} className="btn btn-secondary">Something’s wrong? Call us</a>
            <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? <><Spinner /> Confirming…</> : 'Yes, I received everything'}</button>
          </div>
          <p className="mt-3 text-xs text-muted">Paid {order.paymentStatus === 'paid' ? `via ${order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'cash'}` : '—'} · {phoneDigits(order.phone) && 'We’ll close the order after you confirm.'}</p>
        </div>
      )}
    </Modal>
  );
}
