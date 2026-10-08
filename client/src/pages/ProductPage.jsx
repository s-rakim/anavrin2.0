import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingBag, Smartphone, Truck } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { FREE_DELIVERY_OVER, useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money } from '../lib/format';
import { Page, Reveal } from '../components/Motion';
import { ProductCard } from '../components/ProductCard';
import { StockLine } from '../components/QuickView';
import { EmptyState, Stars } from '../components/ui';

export default function ProductPage() {
  const { id } = useParams();
  const { products, loading } = useCatalog();
  const { add, setOpen } = useCart();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const imgRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: imgRef, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  const product = products.find((p) => p.id === Number(id));
  const related = useMemo(
    () => (product ? products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4) : []),
    [products, product],
  );

  if (!product) {
    return (
      <Page className="mx-auto max-w-xl px-4 pt-32 pb-28">
        {loading ? <div className="skeleton h-96 rounded-3xl" /> : (
          <EmptyState title="Product not found" action={<Link to="/" className="btn btn-secondary">Back to the store</Link>}>
            This item may have been removed from the store.
          </EmptyState>
        )}
      </Page>
    );
  }

  return (
    <Page className="mx-auto max-w-6xl px-4 pt-28 pb-32 sm:px-6 sm:pt-32">
      <Link to="/" className="btn btn-ghost btn-sm -ml-3 mb-4"><ArrowLeft className="size-4" aria-hidden /> Back to shop</Link>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div ref={imgRef} className="card overflow-hidden rounded-[28px]">
          <motion.img style={{ y: imgY, scale: imgScale }} src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
        </div>
        <div className="lg:py-4">
          <Reveal><p className="eyebrow">{product.category}</p></Reveal>
          <Reveal delay={0.05}><h1 className="mt-2 font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">{product.name}</h1></Reveal>
          <Reveal delay={0.1} className="mt-3"><Stars rating={product.rating} count={product.reviewCount} /></Reveal>
          <Reveal delay={0.15} className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tabular">{money(product.price)}</span>
            {product.compareAtPrice > product.price && <span className="text-lg text-muted line-through tabular">{money(product.compareAtPrice)}</span>}
          </Reveal>
          <Reveal delay={0.2}><p className="mt-5 text-base leading-relaxed text-ink-soft">{product.description}</p></Reveal>
          <StockLine product={product} />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-silver-300 bg-white">
              <button className="grid size-12 place-items-center rounded-full hover:bg-silver-100 disabled:opacity-40" aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Minus className="size-4" /></button>
              <span className="w-8 text-center font-semibold tabular" aria-live="polite">{qty}</span>
              <button className="grid size-12 place-items-center rounded-full hover:bg-silver-100 disabled:opacity-40" aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(product.stock, q + 1))} disabled={qty >= product.stock}><Plus className="size-4" /></button>
            </div>
            <button className="btn btn-primary h-12 flex-1" disabled={product.stock === 0}
              onClick={() => { add(product, qty); toast(`${qty} × ${product.name} added to your cart.`); setOpen(true); }}>
              <ShoppingBag className="size-4" aria-hidden /> {product.stock === 0 ? 'Out of stock' : 'Add to cart'}
            </button>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[[Truck, `Free delivery over ${money(FREE_DELIVERY_OVER)}`], [Smartphone, 'M-Pesa or cash on delivery'], [ShieldCheck, 'You confirm receipt']].map(([Icon, t]) => (
              <li key={t} className="glass flex items-center gap-2.5 rounded-2xl p-3 text-[13px] font-medium text-ink-soft">
                <Icon className="size-5 shrink-0 text-brand-600" aria-hidden />{t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <Reveal><h2 className="section-title">More in {product.category}</h2></Reveal>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} scope="related" />)}
          </div>
        </section>
      )}
    </Page>
  );
}
