import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Banknote, Receipt, Search, Smartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { dateTime, money } from '../../lib/format';
import { LiquidSegmented } from '../../components/LiquidGlass';
import { CountUp } from '../../components/Motion';
import { EmptyState } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

/** Every payment riders have confirmed, with M-Pesa codes for reconciliation. */
export default function Transactions() {
  const [data, setData] = useState(null);
  const [method, setMethod] = useState('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setError(''); setData(await api('/admin/transactions')); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('transaction:new', load);
  useSocketEvent('order:new', load);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.transactions || []).filter((t) => (method === 'all' || t.method === method)
      && (!term || t.orderCode.toLowerCase().includes(term) || (t.reference || '').toLowerCase().includes(term) || t.customerName.toLowerCase().includes(term)));
  }, [data, method, q]);

  const t = data?.totals;
  return (
    <>
      <AdminHeader title="Transactions" subtitle="Payments collected on delivery, recorded by riders." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Total collected', t?.total, Receipt],
          ['Via M-Pesa', t?.mpesa, Smartphone],
          ['Via cash', t?.cash, Banknote],
          ['Awaiting payment', t?.outstanding, Receipt],
        ].map(([label, value, Icon]) => (
          <div key={label} className="card p-4">
            <Icon className="size-5 text-brand-600" aria-hidden />
            <p className="mt-2 text-2xl font-semibold">{value === undefined ? <span className="skeleton inline-block h-7 w-20 rounded" /> : <CountUp value={value} format={money} />}</p>
            <p className="text-xs font-medium text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <LiquidSegmented size="sm" value={method} onChange={setMethod} options={[{ value: 'all', label: 'All' }, { value: 'mpesa', label: 'M-Pesa' }, { value: 'cash', label: 'Cash' }]} />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order, M-Pesa code or customer" aria-label="Search transactions" className="field rounded-full pl-10" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {error ? <EmptyState title="Couldn’t load transactions" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState>
          : !data ? <div className="space-y-px">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-12" />)}</div>
          : rows.length === 0 ? <EmptyState icon={Receipt} title="No transactions yet">Payments appear here the moment a rider confirms them.</EmptyState>
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-silver-50 text-left text-xs font-semibold tracking-wider text-muted uppercase">
                  <tr><th className="px-5 py-3">Date</th><th className="px-3 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Reference</th><th className="px-3 py-3">Recorded by</th><th className="px-5 py-3 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-silver-200">
                  <AnimatePresence initial={false}>
                    {rows.map((r) => (
                      <motion.tr key={r.id} layout initial={{ opacity: 0, backgroundColor: '#e3f2ea' }} animate={{ opacity: 1, backgroundColor: 'rgba(255,255,255,0)' }} transition={{ duration: 1 }}>
                        <td className="px-5 py-3 text-ink-soft">{dateTime(r.createdAt)}</td>
                        <td className="px-3 py-3 font-medium">{r.orderCode}</td>
                        <td className="px-3 py-3">{r.customerName}</td>
                        <td className="px-3 py-3">{r.method === 'mpesa' ? 'M-Pesa' : 'Cash'}</td>
                        <td className="px-3 py-3 font-mono text-xs">{r.reference || '—'}</td>
                        <td className="px-3 py-3 text-ink-soft">{r.recordedBy || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular">{money(r.amount)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}
