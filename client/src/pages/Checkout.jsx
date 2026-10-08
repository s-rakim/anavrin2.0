import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Banknote, Info, MessageSquareText, Phone, ShoppingBag, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deliveryFee, useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { isKePhone, money, phoneLocal } from '../lib/format';
import { Page, Reveal } from '../components/Motion';
import { EmptyState, Field, Spinner } from '../components/ui';

/** Kenyan checkout: no street address. The buyer leaves a phone number and directions for the rider. */
export default function Checkout() {
  const { user } = useAuth();
  const { lines, subtotal, clear } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(phoneLocal(user?.phone) || '');
  const [instructions, setInstructions] = useState('');
  const [method, setMethod] = useState('mpesa');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace state={{ from: '/checkout', notice: 'Log in or create an account to check out.' }} />;
  if (user.role !== 'customer') {
    return (
      <Page className="mx-auto max-w-xl px-4 pt-32 pb-28">
        <EmptyState icon={Info} title="Checkout is for shopper accounts" action={<Link to="/" className="btn btn-secondary">Back to store</Link>}>
          You’re signed in as {user.role === 'admin' ? 'an admin' : 'a rider'}. Use a shopper account to place orders.
        </EmptyState>
      </Page>
    );
  }

  const fee = deliveryFee(subtotal);
  const unavailable = lines.filter((l) => l.stock === 0 || l.quantity > l.stock);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isKePhone(phone)) errs.phone = 'Enter a Kenyan mobile number, e.g. 0712 345 678.';
    if (instructions.trim().length < 10) errs.instructions = 'Give the rider a bit more detail so they can find you.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError('');
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        body: { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), phone, instructions, paymentMethod: method },
      });
      clear();
      toast(`We’ll let you know the moment it’s confirmed.`, { title: `Order ${order.code} placed` });
      navigate('/home', { state: { highlight: order.id } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (lines.length === 0) {
    return (
      <Page className="mx-auto max-w-xl px-4 pt-32 pb-28">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link to="/" className="btn btn-primary">Browse the store</Link>}>
          Add some items to your cart before checking out.
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-28 pb-32 sm:px-6 sm:pt-32">
      <Reveal>
        <p className="eyebrow">Checkout</p>
        <h1 className="section-title mt-1">Where should we bring it?</h1>
      </Reveal>

      <form onSubmit={submit} noValidate className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Reveal className="card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Phone className="size-5 text-brand-600" aria-hidden /> Delivery contact</h2>
            <p className="mt-1 text-sm text-muted">Your rider will call this number when they’re close.</p>
            <div className="mt-5 space-y-4">
              <Field label="Phone number" htmlFor="phone" error={errors.phone} hint="Safaricom, Airtel or Telkom mobile number.">
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-xl border border-r-0 border-silver-300 bg-silver-100 px-3 text-sm font-medium text-ink-soft">🇰🇪 +254</span>
                  <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="field rounded-l-none" placeholder="0712 345 678" aria-invalid={!!errors.phone} />
                </div>
              </Field>
              <Field label="Instructions for the rider" htmlFor="instructions" error={errors.instructions}
                hint="Estate or building, landmark, gate or door colour, and the best time to reach you.">
                <div className="relative">
                  <MessageSquareText className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted" aria-hidden />
                  <textarea id="instructions" rows={4} maxLength={600} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                    className="field resize-none pl-10" aria-invalid={!!errors.instructions}
                    placeholder="e.g. Kilimani, Rose Avenue. Greenpark Apartments, Block C, 3rd floor. Black gate opposite the Total petrol station. Call when at the gate." />
                  <span className="pointer-events-none absolute right-3 bottom-2.5 text-xs text-muted tabular">{instructions.length}/600</span>
                </div>
              </Field>
            </div>
          </Reveal>

          <Reveal className="card p-6" delay={0.05}>
            <h2 className="text-lg font-semibold">How will you pay?</h2>
            <p className="mt-1 text-sm text-muted">You pay the rider when your order arrives.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              {[
                { value: 'mpesa', icon: Smartphone, title: 'M-Pesa on delivery', body: 'Pay to the Anavrin till while the rider waits.' },
                { value: 'cash', icon: Banknote, title: 'Cash on delivery', body: 'Pay the rider in cash. Please have change ready.' },
              ].map((o) => {
                const on = method === o.value;
                return (
                  <label key={o.value} className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${on ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-200' : 'border-silver-300 hover:border-brand-300'}`}>
                    <input type="radio" name="payment" value={o.value} checked={on} onChange={() => setMethod(o.value)} className="sr-only" />
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-brand-800 text-white' : 'bg-silver-100 text-ink-soft'}`}><o.icon className="size-5" aria-hidden /></span>
                    <span><span className="block text-sm font-semibold text-ink">{o.title}</span><span className="text-[13px] text-muted">{o.body}</span></span>
                    {on && <motion.span layoutId="pay-check" className="absolute top-3 right-3 size-2.5 rounded-full bg-brand-700" />}
                  </label>
                );
              })}
            </div>
          </Reveal>
        </div>

        <Reveal className="lg:sticky lg:top-28 lg:self-start" delay={0.1}>
          <div className="card p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <ul className="mt-4 divide-y divide-silver-200">
              {lines.map((l) => (
                <li key={l.productId} className="flex items-center gap-3 py-3">
                  <img src={l.imageUrl} alt="" className="size-14 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted tabular">Qty {l.quantity} × {money(l.price)}</p>
                    {(l.stock === 0 || l.quantity > l.stock) && <p className="text-xs font-medium text-danger-700">Only {l.stock} available</p>}
                  </div>
                  <span className="text-sm font-semibold tabular">{money(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-silver-200 pt-4 text-sm">
              <div className="flex justify-between text-ink-soft"><dt>Subtotal</dt><dd className="tabular">{money(subtotal)}</dd></div>
              <div className="flex justify-between text-ink-soft"><dt>Delivery</dt><dd className="tabular">{fee === 0 ? 'Free' : money(fee)}</dd></div>
              <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total to pay on delivery</dt><dd className="tabular">{money(subtotal + fee)}</dd></div>
            </dl>
            {error && <p className="mt-4 rounded-xl bg-danger-100 px-3.5 py-2.5 text-sm font-medium text-danger-700" role="alert">{error}</p>}
            <button type="submit" disabled={busy || unavailable.length > 0} className="btn btn-primary mt-5 h-12 w-full">
              {busy ? <><Spinner /> Placing order…</> : `Place order · ${money(subtotal + fee)}`}
            </button>
            {unavailable.length > 0 && <p className="mt-2 text-center text-xs text-danger-700">Update the quantities above to continue.</p>}
          </div>
        </Reveal>
      </form>
    </Page>
  );
}
