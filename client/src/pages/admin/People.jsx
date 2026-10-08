import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Search, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { dateOnly, money, phoneLocal } from '../../lib/format';
import { LiquidSegmented } from '../../components/LiquidGlass';
import { Chip, EmptyState } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

const STATUS_TONE = { active: 'ok', pending: 'warn', rejected: 'danger', suspended: 'danger' };

/** All accounts. You control who is an admin: promote, demote or suspend accounts here. */
export default function People() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState(null);
  const [role, setRole] = useState('customer');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setError(''); setUsers((await api('/admin/users')).users); } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('user:new', load);
  useSocketEvent('application:new', load);

  const counts = useMemo(() => ({
    customer: (users || []).filter((u) => u.role === 'customer').length,
    rider: (users || []).filter((u) => u.role === 'rider').length,
    admin: (users || []).filter((u) => u.role === 'admin').length,
  }), [users]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users || []).filter((u) => u.role === role && (!term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)));
  }, [users, role, q]);

  const change = async (u, body, msg) => {
    if (body.role === 'admin' && !window.confirm(`Give ${u.name} full admin access to Anavrin?`)) return;
    if (body.role && u.role === 'admin' && !window.confirm(`Remove admin access from ${u.name}?`)) return;
    try {
      const { user: updated } = await api(`/admin/users/${u.id}`, { method: 'PATCH', body });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      toast(msg);
    } catch (err) { toast(err.message, { type: 'error' }); }
  };

  return (
    <>
      <AdminHeader title="People" subtitle="Shoppers, riders and admins. Only admins can grant admin access." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <LiquidSegmented size="sm" value={role} onChange={setRole} options={[
          { value: 'customer', label: 'Shoppers', count: counts.customer },
          { value: 'rider', label: 'Riders', count: counts.rider },
          { value: 'admin', label: 'Admins', count: counts.admin },
        ]} />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" aria-label="Search people" className="field rounded-full pl-10" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {error ? <EmptyState title="Couldn’t load accounts" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState>
          : !users ? <div className="space-y-px">{Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-14" />)}</div>
          : rows.length === 0 ? <EmptyState icon={Users} title="No accounts here" />
          : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-silver-50 text-left text-xs font-semibold tracking-wider text-muted uppercase">
                  <tr><th className="px-5 py-3">Name</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Joined</th>
                    {role === 'customer' && <><th className="px-3 py-3 text-right">Orders</th><th className="px-3 py-3 text-right">Spent</th></>}
                    <th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-silver-200">
                  {rows.map((u, i) => (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 12) * 0.02 }}>
                      <td className="px-5 py-3"><p className="font-medium">{u.name}{u.id === me.id && <span className="ml-2 text-xs text-muted">(you)</span>}</p><p className="text-xs text-muted">{u.email}</p></td>
                      <td className="px-3 py-3 tabular">{u.phone ? phoneLocal(u.phone) : '—'}</td>
                      <td className="px-3 py-3 text-ink-soft">{dateOnly(u.createdAt)}</td>
                      {role === 'customer' && <><td className="px-3 py-3 text-right tabular">{u.orderCount}</td><td className="px-3 py-3 text-right tabular">{money(u.spent)}</td></>}
                      <td className="px-3 py-3"><Chip tone={STATUS_TONE[u.status]}>{u.status}</Chip></td>
                      <td className="px-5 py-3">
                        {u.id !== me.id && (
                          <div className="flex justify-end gap-1.5">
                            {u.status === 'suspended'
                              ? <button className="btn btn-secondary btn-sm" onClick={() => change(u, { status: 'active' }, `${u.name} reactivated.`)}>Reactivate</button>
                              : u.status === 'active' && <button className="btn btn-danger btn-sm" onClick={() => change(u, { status: 'suspended' }, `${u.name} suspended.`)}>Suspend</button>}
                            {u.role === 'customer' && u.status === 'active' && (
                              <button className="btn btn-secondary btn-sm" onClick={() => change(u, { role: 'admin' }, `${u.name} is now an admin.`)}><ShieldCheck className="size-4" aria-hidden /> Make admin</button>
                            )}
                            {u.role === 'admin' && (
                              <button className="btn btn-secondary btn-sm" onClick={() => change(u, { role: 'customer' }, `${u.name} is no longer an admin.`)}>Remove admin</button>
                            )}
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}
