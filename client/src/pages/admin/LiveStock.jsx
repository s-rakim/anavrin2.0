import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, Database, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { timeAgo } from '../../lib/format';
import { CountUp } from '../../components/Motion';
import { EmptyState } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

const REASON = {
  order: 'Sold',
  restock: 'Restocked',
  adjustment: 'Count corrected',
  cancel: 'Returned (cancelled)',
  initial: 'Opening stock',
};

/** Live view of the stock table and every stock movement as it is written to the database. */
export default function LiveStock() {
  const [products, setProducts] = useState(null);
  const [moves, setMoves] = useState(null);
  const [flash, setFlash] = useState({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('stock');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [p, m] = await Promise.all([api('/admin/products'), api('/admin/stock-movements?limit=80')]);
      setProducts(p.products);
      setMoves(m.movements);
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useSocketEvent('product:updated', (p) => {
    setProducts((prev) => prev && (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p]));
  });
  useSocketEvent('stock:movement', (m) => {
    setMoves((prev) => prev && [m, ...prev].slice(0, 120));
    setFlash((f) => ({ ...f, [m.productId]: { dir: m.change > 0 ? 'up' : 'down', at: Date.now() } }));
    setTimeout(() => setFlash((f) => { const n = { ...f }; delete n[m.productId]; return n; }), 1800);
  });

  const active = useMemo(() => (products || []).filter((p) => p.active), [products]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = active.filter((p) => !term || p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
    return [...list].sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  }, [active, q, sort]);

  const totals = useMemo(() => ({
    units: active.reduce((s, p) => s + p.stock, 0),
    value: active.reduce((s, p) => s + p.stock * p.price, 0),
    low: active.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length,
    out: active.filter((p) => p.stock === 0).length,
  }), [active]);

  return (
    <>
      <AdminHeader title="Live stock" subtitle="Straight from the database. Every sale, restock and cancellation appears here as it happens." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Units on hand', totals.units],
          ['Stock value (KSh)', totals.value],
          ['Low stock', totals.low],
          ['Out of stock', totals.out],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold"><CountUp value={value} /></p>
          </div>
        ))}
      </div>

      {error ? <div className="card mt-4"><EmptyState title="Couldn’t connect to the database" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState></div> : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-silver-200 px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold"><Database className="size-4 text-brand-600" aria-hidden /> products</h2>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter products" className="field h-9 w-40 rounded-full py-1 pl-9 text-sm" />
              </div>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="field h-9 w-auto rounded-full py-1 text-sm" aria-label="Sort by">
                <option value="stock">Lowest stock first</option><option value="name">Name A–Z</option>
              </select>
            </div>
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-silver-50 text-left text-xs font-semibold tracking-wider text-muted uppercase">
                  <tr><th className="px-4 py-2.5">ID</th><th className="px-3 py-2.5">Product</th><th className="px-3 py-2.5">Level</th><th className="px-4 py-2.5 text-right">Stock</th></tr>
                </thead>
                <tbody className="divide-y divide-silver-200 font-mono text-[13px]">
                  {!products ? Array.from({ length: 8 }, (_, i) => <tr key={i}><td colSpan={4} className="p-2"><div className="skeleton h-8 rounded" /></td></tr>) : (
                    rows.map((p) => {
                      const f = flash[p.id];
                      const low = p.stock <= p.lowStockThreshold;
                      return (
                        <motion.tr key={p.id} layout transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                          animate={{ backgroundColor: f ? (f.dir === 'up' ? '#e3f2ea' : '#fbf0dc') : 'rgba(255,255,255,0)' }}>
                          <td className="px-4 py-2 text-muted">{p.id}</td>
                          <td className="px-3 py-2 font-sans"><span className="line-clamp-1">{p.name}</span></td>
                          <td className="w-40 px-3 py-2">
                            <div className="h-1.5 overflow-hidden rounded-full bg-silver-200">
                              <motion.div className={`h-full rounded-full ${p.stock === 0 ? 'bg-danger-700' : low ? 'bg-warn-700' : 'bg-brand-600'}`}
                                initial={false} animate={{ width: `${Math.min(100, (p.stock / Math.max(p.lowStockThreshold * 4, 1)) * 100)}%` }} />
                            </div>
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${p.stock === 0 ? 'text-danger-700' : low ? 'text-warn-700' : 'text-ink'}`}>
                            <span className="inline-flex items-center gap-1">
                              {f && (f.dir === 'up' ? <ArrowUpRight className="size-3.5 text-ok-700" aria-hidden /> : <ArrowDownRight className="size-3.5 text-warn-700" aria-hidden />)}
                              <motion.span key={p.stock} initial={{ y: f ? (f.dir === 'up' ? 8 : -8) : 0, opacity: 0.3 }} animate={{ y: 0, opacity: 1 }}>{p.stock}</motion.span>
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card flex flex-col overflow-hidden">
            <div className="border-b border-silver-200 px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold"><Database className="size-4 text-brand-600" aria-hidden /> stock_movements</h2>
              <p className="text-xs text-muted">Newest first</p>
            </div>
            <ul className="max-h-[640px] flex-1 divide-y divide-silver-200 overflow-auto">
              {!moves ? Array.from({ length: 6 }, (_, i) => <li key={i} className="p-3"><div className="skeleton h-10 rounded" /></li>) : moves.length === 0 ? (
                <li className="p-6 text-center text-sm text-muted">No stock movements yet.</li>
              ) : (
                <AnimatePresence initial={false}>
                  {moves.map((m) => (
                    <motion.li key={m.id} layout initial={{ opacity: 0, height: 0, backgroundColor: '#e2eaf1' }} animate={{ opacity: 1, height: 'auto', backgroundColor: 'rgba(255,255,255,0)' }}
                      transition={{ duration: 0.6 }} className="overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold tabular ${m.change > 0 ? 'bg-ok-100 text-ok-700' : 'bg-warn-100 text-warn-700'}`}>
                          {m.change > 0 ? `+${m.change}` : m.change}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.productName}</p>
                          <p className="truncate text-xs text-muted">{REASON[m.reason] || m.reason}{m.note ? ` · ${m.note}` : ''}{m.actorName ? ` · ${m.actorName}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold tabular">→ {m.stockAfter}</p>
                          <p className="text-[11px] text-muted">{timeAgo(m.createdAt)}</p>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              )}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
