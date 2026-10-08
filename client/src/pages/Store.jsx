import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowRight, Banknote, PackageCheck, Radio, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import { LiquidSegmented } from '../components/LiquidGlass';
import { Page, Reveal } from '../components/Motion';
import { EmptyState } from '../components/ui';
import { ORDER_STEPS, money } from '../lib/format';

const SORTS = [
  { value: 'featured', label: 'Most popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
];

function sortProducts(list, sort) {
  const arr = [...list];
  switch (sort) {
    case 'price-asc': return arr.sort((a, b) => a.price - b.price);
    case 'price-desc': return arr.sort((a, b) => b.price - a.price);
    case 'rating': return arr.sort((a, b) => b.rating - a.rating);
    case 'newest': return arr.sort((a, b) => b.id - a.id);
    default: return arr.sort((a, b) => b.reviewCount - a.reviewCount);
  }
}

export default function Store() {
  const { products, categories, loading, error, reload } = useCatalog();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').trim().toLowerCase();
  const category = params.get('category') || 'all';
  const [sort, setSort] = useState('featured');

  const setCategory = (c) => {
    const next = new URLSearchParams(params);
    if (c === 'all') next.delete('category'); else next.set('category', c);
    setParams(next, { replace: true, preventScrollReset: true });
  };

  const visible = useMemo(() => {
    let list = products;
    if (category !== 'all') list = list.filter((p) => p.category === category);
    if (q) list = list.filter((p) => `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q));
    return sortProducts(list, sort);
  }, [products, category, q, sort]);

  const deals = useMemo(() => products.filter((p) => p.compareAtPrice > p.price && p.stock > 0), [products]);

  return (
    <Page>
      <Hero products={products} />
      <TrustStrip />
      {categories.length > 0 && <CategoryRail products={products} categories={categories} onPick={setCategory} />}
      {deals.length > 0 && <Deals deals={deals} />}

      <section id="shop" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-16 pb-10 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The store</p>
            <h2 className="section-title mt-1">{q ? <>Results for “{params.get('q')}”</> : 'Shop everything'}</h2>
          </div>
          <p className="text-sm text-muted tabular">{visible.length} item{visible.length === 1 ? '' : 's'}</p>
        </Reveal>

        <div className="sticky top-[88px] z-30 mt-6 flex flex-wrap items-center gap-3 py-2">
          <LiquidSegmented
            value={category}
            onChange={setCategory}
            size="sm"
            options={[{ value: 'all', label: 'All', count: products.length }, ...categories.map((c) => ({ value: c.name, label: c.name, count: c.count }))]}
          />
          <label className="glass ml-auto flex items-center gap-2 rounded-full py-1 pr-2 pl-4 text-sm text-ink-soft">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="rounded-full bg-transparent py-1.5 pr-1 font-medium text-ink focus:outline-none">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {error ? (
          <EmptyState title="We couldn’t load the store" action={<button className="btn btn-secondary" onClick={reload}>Try again</button>}>{error}</EmptyState>
        ) : loading ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="No matches" action={<Link to="/" className="btn btn-secondary">Clear search</Link>}>
            Try a different word or browse all categories.
          </EmptyState>
        ) : (
          <motion.div layout className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {visible.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      <TrackingStory />
    </Page>
  );
}

/* ---------------- Hero with scroll parallax ---------------- */

function Hero({ products }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const textY = useTransform(smooth, [0, 1], [0, 140]);
  const textOpacity = useTransform(smooth, [0, 0.7], [1, 0]);
  const bgScale = useTransform(smooth, [0, 1], [1, 1.15]);

  const picks = useMemo(() => {
    const byCat = new Map();
    products.forEach((p) => { if (!byCat.has(p.category)) byCat.set(p.category, p); });
    return [...byCat.values(), ...products].filter((p, i, a) => a.indexOf(p) === i).slice(0, 5);
  }, [products]);

  return (
    <section ref={ref} className="relative overflow-hidden pt-28 pb-16 sm:pt-32 lg:min-h-[86vh]">
      <motion.div style={{ scale: bgScale }} className="absolute inset-0 -z-10" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-b from-brand-100/80 via-silver-100 to-silver-100" />
        <div className="absolute top-[-20%] right-[-10%] size-[60vw] rounded-full bg-brand-200/50 blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-10%] size-[45vw] rounded-full bg-silver-300/60 blur-3xl" />
      </motion.div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
        <motion.div style={{ y: textY, opacity: textOpacity }}>
          <motion.p className="eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            Delivered across Nairobi, Mombasa &amp; Kisumu
          </motion.p>
          <h1 className="mt-4 font-display text-[44px] leading-[1.02] font-semibold tracking-tight text-ink text-balance sm:text-6xl lg:text-7xl">
            {['Everything you need,', 'brought to your door.'].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-1">
                <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}>
                  {i === 1 ? <span className="italic text-brand-700">{line}</span> : line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            Electronics, groceries, fashion and home essentials. Pay with M-Pesa or cash when it arrives, and watch your order move in real time.
          </motion.p>
          <motion.div className="mt-8 flex flex-wrap gap-3" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <a href="#shop" className="btn btn-primary h-12 px-7">Start shopping <ArrowRight className="size-4" aria-hidden /></a>
            <Link to="/home" className="btn btn-secondary h-12 px-6">Track an order</Link>
          </motion.div>
        </motion.div>

        <HeroCollage picks={picks} progress={smooth} />
      </div>

      <motion.div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-medium text-muted lg:flex"
        style={{ opacity: textOpacity }} aria-hidden>
        Scroll
        <motion.span className="h-8 w-[1.5px] origin-top rounded-full bg-brand-400" animate={{ scaleY: [0.2, 1, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }} />
      </motion.div>
    </section>
  );
}

const COLLAGE = [
  { cls: 'left-[18%] top-[6%] w-[46%] z-20', speed: -120, rotate: -4 },
  { cls: 'right-0 top-[2%] w-[36%] z-10', speed: -220, rotate: 6 },
  { cls: 'left-0 top-[46%] w-[34%] z-10', speed: -60, rotate: 5 },
  { cls: 'left-[36%] top-[52%] w-[38%] z-30', speed: -180, rotate: -3 },
  { cls: 'right-[2%] top-[44%] w-[26%] z-20', speed: -300, rotate: 8 },
];

function HeroCollage({ picks, progress }) {
  return (
    <div className="relative mx-auto aspect-[1/0.95] w-full max-w-xl" aria-hidden>
      {picks.map((p, i) => <CollageTile key={p.id} product={p} spec={COLLAGE[i]} progress={progress} i={i} />)}
    </div>
  );
}

function CollageTile({ product, spec, progress, i }) {
  const y = useTransform(progress, [0, 1], [0, spec.speed]);
  const rotate = useTransform(progress, [0, 1], [spec.rotate, spec.rotate * -1.5]);
  return (
    <motion.div style={{ y, rotate }} className={`absolute ${spec.cls}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 120, damping: 18 }}
        whileHover={{ scale: 1.04 }}
        className="overflow-hidden rounded-[22px] bg-white p-1.5 shadow-[var(--shadow-lift)]"
      >
        <img src={product.imageUrl} alt="" className="aspect-square w-full rounded-[16px] object-cover" />
        <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
          <span className="truncate text-xs font-medium text-ink">{product.name}</span>
          <span className="shrink-0 text-xs font-semibold text-brand-700 tabular">{money(product.price)}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Trust strip ---------------- */

function TrustStrip() {
  const items = [
    { icon: Smartphone, title: 'M-Pesa or cash', body: 'Pay when your order arrives' },
    { icon: Radio, title: 'Live tracking', body: 'See every step in real time' },
    { icon: Truck, title: 'Free delivery', body: 'On orders over KSh 5,000' },
    { icon: ShieldCheck, title: 'Confirm on receipt', body: 'Orders close only when you say so' },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <motion.ul initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        className="glass grid grid-cols-2 gap-px overflow-hidden rounded-3xl lg:grid-cols-4">
        {items.map(({ icon: Icon, title, body }) => (
          <motion.li key={title} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
            className="flex items-start gap-3 p-4 sm:p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-800 text-white"><Icon className="size-5" aria-hidden /></span>
            <span>
              <span className="block text-sm font-semibold text-ink">{title}</span>
              <span className="block text-[13px] text-muted">{body}</span>
            </span>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

/* ---------------- Category rail moves sideways as you scroll ---------------- */

function CategoryRail({ products, categories, onPick }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(useSpring(scrollYProgress, { stiffness: 100, damping: 24 }), [0, 1], ['6%', '-22%']);
  const cover = (name) => products.find((p) => p.category === name)?.imageUrl;

  return (
    <section ref={ref} className="overflow-hidden pt-16">
      <Reveal className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="eyebrow">Browse</p>
        <h2 className="section-title mt-1">Shop by category</h2>
      </Reveal>
      <motion.div style={{ x }} className="mt-6 flex gap-4 pl-4 sm:pl-6">
        {categories.map((c, i) => (
          <motion.a key={c.name} href="#shop" onClick={() => onPick(c.name)}
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6 }}
            className="group relative h-56 w-48 shrink-0 overflow-hidden rounded-3xl bg-brand-900 shadow-[var(--shadow-card)] sm:h-64 sm:w-60">
            {cover(c.name) && <img src={cover(c.name)} alt="" className="absolute inset-0 size-full object-cover opacity-80 transition duration-700 group-hover:scale-110 group-hover:opacity-90" />}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="font-display text-2xl font-semibold">{c.name}</p>
              <p className="text-sm text-white/75">{c.count} items</p>
            </div>
          </motion.a>
        ))}
      </motion.div>
    </section>
  );
}

/* ---------------- Deals ---------------- */

function Deals({ deals }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
      <Reveal className="flex items-end justify-between">
        <div>
          <p className="eyebrow text-berry-600">Limited time</p>
          <h2 className="section-title mt-1">Today’s deals</h2>
        </div>
      </Reveal>
      <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none sm:-mx-6 sm:px-6">
        {deals.map((p, i) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[30%] lg:w-[23%]">
            <ProductCard product={p} index={i} scope="deals" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Scroll-driven tracking story ---------------- */

function TrackingStory() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 60%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 22 });
  const width = useTransform(progress, [0.1, 0.9], ['0%', '100%']);
  const scale = useTransform(progress, [0, 0.5], [0.94, 1]);
  const icons = [PackageCheck, ShieldCheck, Truck, Radio, PackageCheck, Banknote];

  return (
    <section ref={ref} className="px-4 pt-10 pb-28 sm:px-6">
      <motion.div style={{ scale }} className="glass-dark relative mx-auto max-w-6xl overflow-hidden rounded-[32px] px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-200 uppercase">Real-time tracking</p>
          <h2 className="mt-2 max-w-2xl font-display text-4xl leading-tight font-semibold sm:text-5xl">
            Know exactly where your order is, every step of the way.
          </h2>
        </Reveal>
        <div className="relative mt-12">
          <div className="absolute top-5 right-5 left-5 h-[3px] rounded-full bg-white/15" aria-hidden />
          <motion.div style={{ width }} className="absolute top-5 left-5 h-[3px] max-w-[calc(100%-40px)] rounded-full bg-gradient-to-r from-brand-300 to-white" aria-hidden />
          <ol className="relative grid grid-cols-3 gap-y-8 sm:grid-cols-6">
            {ORDER_STEPS.map((s, i) => {
              const Icon = icons[i];
              return (
                <Reveal as="li" key={s.key} delay={i * 0.08} className="flex flex-col items-center text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-white text-brand-900 shadow-lg"><Icon className="size-5" aria-hidden /></span>
                  <span className="mt-3 text-sm font-medium">{s.label}</span>
                </Reveal>
              );
            })}
          </ol>
        </div>
        <Reveal className="mt-12 flex flex-wrap gap-3" delay={0.2}>
          <Link to="/signup" className="btn bg-white text-brand-900 hover:bg-brand-50">Create an account</Link>
          <Link to="/riders/apply" className="btn border border-white/25 text-white hover:bg-white/10">Ride with Anavrin</Link>
        </Reveal>
      </motion.div>
    </section>
  );
}
