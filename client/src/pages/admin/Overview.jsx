import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowRight, Banknote, Boxes, ClipboardList, Package, UserCheck, Users } from 'lucide-react';
import { useAdmin } from './AdminLayout';
import { AdminHeader } from './AdminLayout';
import { CountUp, Reveal } from '../../components/Motion';
import { StatusBadge } from '../../components/ui';
import { STATUS, money, num, parseDate, timeAgo } from '../../lib/format';

const BRAND = '#295f81';
const GRID = '#e1e7ed';
const AXIS = '#64798a';
const dayLabel = (d) => new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(parseDate(`${d} 00:00:00`));

function ChartTooltip({ active, payload, label, valueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-silver-200 bg-white px-3 py-2 text-sm shadow-[var(--shadow-card)]">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold text-ink tabular">{valueFormat(payload[0].value)}</p>
    </div>
  );
}

export default function Overview() {
  const { overview } = useAdmin();
  if (!overview) {
    return (
      <>
        <AdminHeader title="Overview" subtitle="Loading live store data…" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
      </>
    );
  }
  const { kpis, revenueSeries, statusBreakdown, lowStock, topProducts, recentOrders } = overview;
  const series = revenueSeries.map((d) => ({ ...d, label: dayLabel(d.date) }));
  const statusRows = Object.keys(STATUS).filter((s) => s !== 'payment_confirmed')
    .map((s) => ({ status: s, label: STATUS[s].label, count: statusBreakdown.find((b) => b.status === s)?.count || 0 }));

  const tiles = [
    { label: 'Revenue collected', value: kpis.revenue, sub: `${money(kpis.revenueToday)} today`, icon: Banknote, fmt: money, to: '/admin/transactions' },
    { label: 'Open orders', value: kpis.openOrders, sub: `${kpis.awaitingConfirmation} awaiting confirmation`, icon: ClipboardList, to: '/admin/orders', alert: kpis.awaitingConfirmation > 0 },
    { label: 'Units in stock', value: kpis.unitsInStock, sub: `${kpis.lowStock} low · ${kpis.outOfStock} out`, icon: Boxes, to: '/admin/stock', alert: kpis.lowStock > 0 },
    { label: 'Customers', value: kpis.customers, sub: `${num(kpis.orders)} orders all-time`, icon: Users, to: '/admin/people' },
    { label: 'Active riders', value: kpis.riders, sub: `${kpis.pendingApplications} applications pending`, icon: UserCheck, to: '/admin/riders', alert: kpis.pendingApplications > 0 },
    { label: 'Products listed', value: kpis.products, sub: 'Visible in the store', icon: Package, to: '/admin/inventory' },
  ];

  return (
    <>
      <AdminHeader title="Overview" subtitle="Everything happening in the store right now." />

      <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <motion.li key={t.label} variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}>
            <Link to={t.to} className="card group flex h-full items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-800 text-white"><t.icon className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-muted">{t.label}</span>
                <span className="mt-1 block text-[28px] leading-tight font-semibold text-ink"><CountUp value={t.value} format={t.fmt} /></span>
                <span className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${t.alert ? 'text-warn-700' : 'text-muted'}`}>
                  {t.alert && <AlertTriangle className="size-3.5" aria-hidden />}{t.sub}
                </span>
              </span>
              <ArrowRight className="size-4 text-silver-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
            </Link>
          </motion.li>
        ))}
      </motion.ul>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Reveal className="card p-5">
          <h2 className="font-semibold">Revenue collected · last 14 days</h2>
          <p className="text-xs text-muted">Payments confirmed by riders, in KSh</p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip cursor={{ stroke: '#9ab8cc', strokeWidth: 1 }} content={<ChartTooltip valueFormat={money} />} />
                <Area type="monotone" dataKey="revenue" stroke={BRAND} strokeWidth={2} fill="url(#rev)" animationDuration={900}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Reveal>

        <Reveal className="card p-5" delay={0.05}>
          <h2 className="font-semibold">Orders placed · last 14 days</h2>
          <p className="text-xs text-muted">All orders, including cancelled</p>
          <div className="mt-4 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={4}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip cursor={{ fill: '#eef2f6' }} content={<ChartTooltip valueFormat={(v) => `${v} order${v === 1 ? '' : 's'}`} />} />
                <Bar dataKey="orders" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Reveal className="card p-5">
          <h2 className="font-semibold">Orders by status</h2>
          <ul className="mt-4 space-y-3">
            {statusRows.map((r) => {
              const max = Math.max(1, ...statusRows.map((x) => x.count));
              return (
                <li key={r.status}>
                  <div className="flex justify-between text-sm"><span className="text-ink-soft">{r.label}</span><span className="font-semibold tabular">{r.count}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-silver-100">
                    <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} whileInView={{ width: `${(r.count / max) * 100}%` }}
                      viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal className="card p-5" delay={0.05}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Needs restocking</h2>
            <Link to="/admin/inventory" className="text-sm font-medium text-brand-700 hover:underline">Restock</Link>
          </div>
          {lowStock.length === 0 ? <p className="mt-6 text-sm text-muted">All products are above their alert level.</p> : (
            <ul className="mt-3 divide-y divide-silver-200">
              {lowStock.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <img src={p.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className={`chip ${p.stock === 0 ? 'bg-danger-100 text-danger-700' : 'bg-warn-100 text-warn-700'}`}>{p.stock === 0 ? 'Out' : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        <Reveal className="card p-5" delay={0.1}>
          <h2 className="font-semibold">Best sellers</h2>
          {topProducts.length === 0 ? <p className="mt-6 text-sm text-muted">Sales will show up here.</p> : (
            <ol className="mt-3 space-y-2.5">
              {topProducts.map((p, i) => (
                <li key={p.id ?? p.name} className="flex items-center gap-3 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-silver-100 text-xs font-semibold text-ink-soft">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-muted tabular">{p.units} sold</span>
                </li>
              ))}
            </ol>
          )}
        </Reveal>
      </div>

      <Reveal className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-semibold">Latest orders</h2>
          <Link to="/admin/orders" className="text-sm font-medium text-brand-700 hover:underline">All orders</Link>
        </div>
        {recentOrders.length === 0 ? <p className="p-5 text-sm text-muted">No orders yet.</p> : (
          <ul className="mt-3 divide-y divide-silver-200">
            {recentOrders.map((o) => (
              <motion.li layout key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="w-28 text-sm font-semibold">{o.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{o.customer.name}</span>
                <span className="text-xs text-muted">{timeAgo(o.createdAt)}</span>
                <span className="w-24 text-right text-sm font-medium tabular">{money(o.total)}</span>
                <StatusBadge status={o.status} />
              </motion.li>
            ))}
          </ul>
        )}
      </Reveal>
    </>
  );
}
