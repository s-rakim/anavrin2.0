import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Eye, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { money } from '../lib/format';
import { Stars } from './ui';

/**
 * Product tile. Layout adapted from the 21st.dev "Product Card" (beratberkayg): image well with badges,
 * rating row, price with strike-through, and an add-to-cart button with loading → added states.
 */
export function ProductCard({ product, index = 0, scope = 'grid' }) {
  const { add, setOpen } = useCart();
  const { openQuickView } = useCatalog();
  const [state, setState] = useState('idle');
  const discount = product.compareAtPrice > product.price
    ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const out = product.stock === 0;
  const low = !out && product.stock <= product.lowStockThreshold;

  const handleAdd = () => {
    if (state !== 'idle' || out) return;
    setState('adding');
    setTimeout(() => {
      add(product, 1);
      setState('added');
      setTimeout(() => setState('idle'), 1600);
    }, 380);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 36, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: (index % 4) * 0.07 }}
      whileHover={{ y: -6 }}
      className="group card flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-square overflow-hidden bg-silver-100">
        <button onClick={() => openQuickView(product, scope)} className="block size-full" aria-label={`Preview ${product.name}`}>
          <motion.img
            layoutId={`${scope}-image-${product.id}`}
            src={product.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.06]"
          />
        </button>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {discount > 0 && <span className="chip bg-berry-600 text-white shadow-sm">−{discount}%</span>}
          {low && <span className="chip bg-warn-100 text-warn-700">Only {product.stock} left</span>}
          {out && <span className="chip bg-ink text-white">Sold out</span>}
        </div>

        <button
          onClick={() => openQuickView(product, scope)}
          className="glass absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-ink opacity-100 transition-all duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
        >
          <Eye className="size-4" aria-hidden /> Quick view
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{product.category}</p>
        <h3 className="line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-medium text-ink">
          <Link to={`/product/${product.id}`} className="hover:text-brand-700 hover:underline underline-offset-2">{product.name}</Link>
        </h3>
        <Stars rating={product.rating} count={product.reviewCount} />
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <motion.span key={product.price} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="text-lg font-semibold tabular text-ink">{money(product.price)}</motion.span>
          {discount > 0 && <span className="text-sm text-muted line-through tabular">{money(product.compareAtPrice)}</span>}
        </div>
        <button
          onClick={state === 'added' ? () => setOpen(true) : handleAdd}
          disabled={out || state === 'adding'}
          className={`btn mt-1 w-full ${state === 'added' ? 'border border-ok-700/20 bg-ok-100 text-ok-700' : 'btn-primary'}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={state} className="flex items-center gap-2"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
              {out ? 'Out of stock'
                : state === 'adding' ? (<><span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> Adding…</>)
                : state === 'added' ? (<><Check className="size-4" aria-hidden /> Added · View cart</>)
                : (<><ShoppingBag className="size-4" aria-hidden /> Add to cart</>)}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-square" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton mt-3 h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
