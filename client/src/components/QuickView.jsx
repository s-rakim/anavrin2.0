import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Minus, Plus, ShieldCheck, ShoppingBag, Smartphone, Truck } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { FREE_DELIVERY_OVER, useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money } from '../lib/format';
import { CloseButton, Stars } from './ui';

/** Item preview. The image morphs out of the product card into the dialog (shared layout animation). */
export function QuickView() {
  const { quickView: product, quickScope, closeQuickView } = useCatalog();
  const { add, setOpen } = useCart();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const close = closeQuickView;

  useEffect(() => { setQty(1); }, [product?.id]);
  useEffect(() => {
    if (!product) return;
    const fn = (e) => e.key === 'Escape' && closeQuickView();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', fn);
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = prev; };
  }, [product, closeQuickView]);

  return createPortal(
    <AnimatePresence>
      {product && (
        <motion.div key="qv" className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
          <div className="absolute inset-0 bg-brand-950/45 backdrop-blur-md" onClick={close} aria-hidden />
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="qv-title"
            className="relative grid max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-[var(--shadow-lift)] sm:grid-cols-2 sm:rounded-3xl"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <div className="relative aspect-square bg-silver-100 sm:aspect-auto">
              <motion.img layoutId={`${quickScope}-image-${product.id}`} src={product.imageUrl} alt={product.name}
                className="size-full object-cover sm:absolute sm:inset-0" />
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <div className="absolute top-3 right-3"><CloseButton onClick={close} /></div>
              <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } } }}
                className="flex flex-1 flex-col">
                {[
                  <p key="c" className="eyebrow">{product.category}</p>,
                  <h2 key="t" id="qv-title" className="mt-2 pr-8 font-display text-3xl leading-tight font-semibold text-ink">{product.name}</h2>,
                  <div key="s" className="mt-2"><Stars rating={product.rating} count={product.reviewCount} /></div>,
                  <div key="p" className="mt-4 flex items-baseline gap-3">
                    <span className="text-2xl font-semibold tabular">{money(product.price)}</span>
                    {product.compareAtPrice > product.price && <span className="text-muted line-through tabular">{money(product.compareAtPrice)}</span>}
                  </div>,
                  <p key="d" className="mt-4 text-[15px] leading-relaxed text-ink-soft">{product.description}</p>,
                  <StockLine key="st" product={product} />,
                  <ul key="b" className="mt-5 space-y-2 text-sm text-ink-soft">
                    <li className="flex items-center gap-2.5"><Truck className="size-4 text-brand-600" aria-hidden />Free delivery on orders over {money(FREE_DELIVERY_OVER)}</li>
                    <li className="flex items-center gap-2.5"><Smartphone className="size-4 text-brand-600" aria-hidden />Pay with M-Pesa or cash when it arrives</li>
                    <li className="flex items-center gap-2.5"><ShieldCheck className="size-4 text-brand-600" aria-hidden />Confirm receipt before the order closes</li>
                  </ul>,
                ].map((el) => (
                  <motion.div key={el.key} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>{el}</motion.div>
                ))}
              </motion.div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-full border border-silver-300 bg-white">
                  <button className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-silver-100 disabled:opacity-40" aria-label="Decrease quantity"
                    onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Minus className="size-4" /></button>
                  <span className="w-8 text-center font-semibold tabular" aria-live="polite">{qty}</span>
                  <button className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-silver-100 disabled:opacity-40" aria-label="Increase quantity"
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))} disabled={qty >= product.stock}><Plus className="size-4" /></button>
                </div>
                <button className="btn btn-primary flex-1" disabled={product.stock === 0}
                  onClick={() => { add(product, qty); toast(`${qty} × ${product.name} added to your cart.`); close(); setOpen(true); }}>
                  <ShoppingBag className="size-4" aria-hidden />
                  {product.stock === 0 ? 'Out of stock' : `Add to cart · ${money(product.price * qty)}`}
                </button>
              </div>
              <Link to={`/product/${product.id}`} onClick={close} className="mt-4 text-center text-sm font-medium text-brand-700 hover:underline">
                See full details
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function StockLine({ product }) {
  const out = product.stock === 0;
  const low = !out && product.stock <= product.lowStockThreshold;
  return (
    <p className={`mt-4 flex items-center gap-2 text-sm font-medium ${out ? 'text-danger-700' : low ? 'text-warn-700' : 'text-ok-700'}`}>
      <span className="live-dot size-2 rounded-full bg-current" aria-hidden />
      <motion.span key={product.stock} initial={{ opacity: 0.2 }} animate={{ opacity: 1 }}>
        {out ? 'Out of stock. Check back soon.' : low ? `Hurry, only ${product.stock} left in stock` : `In stock · ${product.stock} available`}
      </motion.span>
    </p>
  );
}
