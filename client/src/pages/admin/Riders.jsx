import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bike, Check, IdCard, MapPin, Phone, UserCheck, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { VEHICLES, dateOnly, phoneLocal, timeAgo } from '../../lib/format';
import { LiquidSegmented } from '../../components/LiquidGlass';
import { Chip, EmptyState, Spinner } from '../../components/ui';
import { AdminHeader } from './AdminLayout';

/** Hiring: review rider applications, and see who is on the team. Riders only get access once approved here. */
export default function Riders() {
  const { toast } = useToast();
  const [apps, setApps] = useState(null);
  const [riders, setRiders] = useState(null);
  const [tab, setTab] = useState('pending');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [a, r] = await Promise.all([api('/admin/applications'), api('/admin/riders')]);
      setApps(a.applications);
      setRiders(r.riders);
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useSocketEvent('application:new', load);
  useSocketEvent('application:reviewed', load);
  useSocketEvent('stats:changed', () => api('/admin/riders').then((r) => setRiders(r.riders)).catch(() => {}));

  const pending = useMemo(() => (apps || []).filter((a) => a.status === 'pending'), [apps]);
  const reviewed = useMemo(() => (apps || []).filter((a) => a.status !== 'pending'), [apps]);

  const decide = async (a, decision) => {
    setBusy(`${a.id}-${decision}`);
    try {
      await api(`/admin/applications/${a.id}/${decision}`, { method: 'POST', body: {} });
      toast(decision === 'approve' ? `${a.name} is hired and can now log in to the rider dashboard.` : `${a.name}’s application was declined.`,
        { title: decision === 'approve' ? 'Rider hired' : 'Application declined' });
      await load();
    } catch (err) { toast(err.message, { type: 'error' }); } finally { setBusy(null); }
  };

  return (
    <>
      <AdminHeader title="Riders" subtitle="Decide who to hire. Approved riders get access to the rider dashboard immediately." />
      <LiquidSegmented className="mb-4" value={tab} onChange={setTab} options={[
        { value: 'pending', label: 'Applications', count: pending.length },
        { value: 'team', label: 'Active riders', count: riders?.length ?? 0 },
        { value: 'history', label: 'Reviewed', count: reviewed.length },
      ]} />

      {error ? <div className="card"><EmptyState title="Couldn’t load riders" action={<button className="btn btn-secondary" onClick={load}>Try again</button>}>{error}</EmptyState></div>
        : !apps ? <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}</div>
        : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              {tab === 'pending' && (pending.length === 0 ? (
                <div className="card"><EmptyState icon={UserCheck} title="No applications waiting">New applications from the rider sign-up page will appear here instantly.</EmptyState></div>
              ) : (
                <motion.ul layout className="grid gap-4 md:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {pending.map((a) => (
                      <motion.li key={a.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 60 }} className="card flex flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="text-lg font-semibold">{a.name}</p><p className="text-sm text-muted">{a.email}</p></div>
                          <Chip tone="warn">Applied {timeAgo(a.createdAt)}</Chip>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                          <Info icon={Phone} label="Phone"><a href={`tel:${a.phone}`} className="text-brand-700 hover:underline">{phoneLocal(a.phone)}</a></Info>
                          <Info icon={IdCard} label="National ID">{a.nationalId}</Info>
                          <Info icon={Bike} label="Vehicle">{VEHICLES[a.vehicleType] || a.vehicleType}{a.plateNumber ? ` · ${a.plateNumber}` : ''}</Info>
                          <Info icon={MapPin} label="Area">{a.area}</Info>
                        </dl>
                        {(a.experience || a.about) && (
                          <div className="mt-3 rounded-xl bg-silver-100 p-3 text-sm text-ink-soft">
                            {a.experience && <p><b className="text-ink">Experience:</b> {a.experience}</p>}
                            {a.about && <p className="mt-1">{a.about}</p>}
                          </div>
                        )}
                        <div className="mt-5 flex gap-2">
                          <button className="btn btn-danger flex-1" disabled={!!busy} onClick={() => decide(a, 'reject')}>
                            {busy === `${a.id}-reject` ? <Spinner /> : <X className="size-4" aria-hidden />} Decline
                          </button>
                          <button className="btn btn-primary flex-1" disabled={!!busy} onClick={() => decide(a, 'approve')}>
                            {busy === `${a.id}-approve` ? <Spinner /> : <Check className="size-4" aria-hidden />} Hire rider
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              ))}

              {tab === 'team' && ((riders || []).length === 0 ? (
                <div className="card"><EmptyState icon={Bike} title="No riders yet">Hire riders from the Applications tab.</EmptyState></div>
              ) : (
                <div className="card overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-silver-50 text-left text-xs font-semibold tracking-wider text-muted uppercase">
                      <tr><th className="px-5 py-3">Rider</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Vehicle</th><th className="px-3 py-3">Area</th><th className="px-3 py-3 text-right">Active</th><th className="px-5 py-3 text-right">Delivered</th></tr>
                    </thead>
                    <tbody className="divide-y divide-silver-200">
                      {riders.map((r) => (
                        <tr key={r.id}>
                          <td className="px-5 py-3"><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.email}</p></td>
                          <td className="px-3 py-3 tabular"><a href={`tel:${r.phone}`} className="text-brand-700 hover:underline">{phoneLocal(r.phone)}</a></td>
                          <td className="px-3 py-3">{VEHICLES[r.vehicleType] || '—'}</td>
                          <td className="px-3 py-3">{r.area || '—'}</td>
                          <td className="px-3 py-3 text-right tabular">{r.active > 0 ? <Chip tone="berry">{r.active} on the road</Chip> : 0}</td>
                          <td className="px-5 py-3 text-right font-semibold tabular">{r.delivered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {tab === 'history' && (reviewed.length === 0 ? (
                <div className="card"><EmptyState title="No reviewed applications yet" /></div>
              ) : (
                <ul className="space-y-3">
                  {reviewed.map((a) => (
                    <li key={a.id} className="card flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1"><p className="font-medium">{a.name}</p><p className="text-xs text-muted">{a.email} · {VEHICLES[a.vehicleType]} · {a.area}</p></div>
                      <span className="text-xs text-muted">{a.reviewedBy ? `${a.reviewedBy} · ` : ''}{dateOnly(a.reviewedAt)}</span>
                      <Chip tone={a.status === 'approved' ? 'ok' : 'danger'}>{a.status === 'approved' ? 'Hired' : 'Declined'}</Chip>
                    </li>
                  ))}
                </ul>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
    </>
  );
}

function Info({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl bg-silver-50 p-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted"><Icon className="size-3.5" aria-hidden /> {label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
