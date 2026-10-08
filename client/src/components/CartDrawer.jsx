import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { FREE_DELIVERY_OVER, deliveryFee, useCart } from '../context/CartContext';
import { money } from '../lib/format';
import { Drawer, EmptyState } from './ui';

export function CartDrawer() {
  const { lines, open, setOpen, setQuantity, remove, subtotal, count } = useCart();
  const navigate = useNavigate();
  const fee = deliveryFee(subtotal);
  const toFree = Math.max(0, FREE_DELIVERY_OVER - subtotal);

  return (
    <Drawer open={open} onClose={() => setOpen(false)} title={`Your cart${count ? ` (${count})` : ''}`}
      footer={lines.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between text-sm text-ink-soft"><span>Subtotal</span><span className="tabular">{money(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-ink-soft"><span>Delivery</span><span className="tabular">{fee === 0 ? 'Free' : money(fee)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular">{money(subtotal + fee)}</span></div>
          <button className="btn btn-primary w-full" onClick={() => { setOpen(false); navigate('/checkout'); }}>Checkout</button>
        </div>
      )}>
      {lines.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Your cart is empty"
          action={<button className="btn btn-secondary" onClick={() => { setOpen(false); navigate('/'); }}>Start shopping</button>}>
          Browse the store and add a few things you love.
        </EmptyState>
      ) : (
        <div className="p-5">
          <div className="mb-4 rounded-2xl bg-white p-3.5 text-sm shadow-[var(--shadow-card)]">
            <p className="text-ink-soft">
              {toFree > 0 ? <>Add <b className="text-ink tabular">{money(toFree)}</b> more for free delivery.</> : <b className="text-ok-700">You’ve unlocked free delivery.</b>}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-silver-200">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                initial={false} animate={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_OVER) * 100)}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
            </div>
          </div>
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.li key={l.productId} layout
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60, height: 0, marginTop: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  className="flex gap-3 rounded-2xl bg-white p-3 shadow-[var(--shadow-card)]">
                  <img src={l.imageUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-sm font-medium text-ink">{l.name}</p>
                    <p className="mt-0.5 text-sm font-semibold tabular">{money(l.price)}</p>
                    {l.stock === 0 && <p className="text-xs font-medium text-danger-700">No longer in stock</p>}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-silver-300">
                        <button className="grid size-9 place-items-center rounded-full hover:bg-silver-100" aria-label={`Decrease ${l.name}`}
                          onClick={() => setQuantity(l.productId, l.quantity - 1)}><Minus className="size-3.5" /></button>
                        <span className="w-7 text-center text-sm font-semibold tabular">{l.quantity}</span>
                        <button className="grid size-9 place-items-center rounded-full hover:bg-silver-100 disabled:opacity-40" aria-label={`Increase ${l.name}`}
                          disabled={l.quantity >= l.stock} onClick={() => setQuantity(l.productId, l.quantity + 1)}><Plus className="size-3.5" /></button>
                      </div>
                      <button className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger-100 hover:text-danger-700"
                        aria-label={`Remove ${l.name}`} onClick={() => remove(l.productId)}><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </Drawer>
  );
}
