import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Redirect } from '../../components/Motion';
import { AnimatePresence, motion } from 'motion/react';
import { Boxes, ClipboardList, Database, LayoutDashboard, LogOut, Receipt, Store, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { money } from '../../lib/format';
import { LiquidNav } from '../../components/LiquidGlass';
import { LiveIndicator } from '../../components/ui';

const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

/** Admin shell: liquid-glass sidebar, live counters and notifications for new orders, riders and payments. */
export default function AdminLayout() {
  const { user, ready, logout } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const timer = useRef(null);

  const loadOverview = useCallback(() => api('/admin/overview').then(setOverview).catch(() => {}), []);
  useEffect(() => { if (user?.role === 'admin') loadOverview(); }, [user, loadOverview]);

  // Coalesce bursts of changes (e.g. an order touching several products) into one refresh.
  useSocketEvent('stats:changed', () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(loadOverview, 300);
  });
  useSocketEvent('order:new', (o) => toast(`${o.customer} · ${money(o.total)}`, { title: `New order ${o.code}`, type: 'info' }));
  useSocketEvent('application:new', () => toast('A new rider has applied to join Anavrin.', { title: 'Rider application', type: 'info' }));
  useSocketEvent('transaction:new', (t) => toast(`${money(t.amount)} via ${t.method === 'mpesa' ? 'M-Pesa' : 'cash'} for ${t.orderCode}`, { title: 'Payment received' }));

  if (!ready) return null;
  if (!user) return <Redirect to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== 'admin') return <Redirect to="/" replace />;

  const k = overview?.kpis;
  const items = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList, badge: k?.awaitingConfirmation },
    { to: '/admin/inventory', label: 'Inventory', icon: Boxes, badge: k?.lowStock },
    { to: '/admin/stock', label: 'Live stock', icon: Database },
    { to: '/admin/riders', label: 'Riders', icon: UserCheck, badge: k?.pendingApplications },
    { to: '/admin/people', label: 'People', icon: Users },
    { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
  ];

  return (
    <AdminContext.Provider value={{ overview, reloadOverview: loadOverview }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-dvh lg:pl-[272px]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-3 left-3 z-40 hidden w-[256px] flex-col lg:flex">
          <div className="glass-dark glass-refract flex h-full flex-col rounded-[28px] p-3">
            <Link to="/admin" className="px-3 pt-2 pb-4"><img src="/anavrin-logo-light.png" alt="Anavrin" className="h-16 w-auto" /></Link>
            <p className="px-3.5 pb-2 text-[11px] font-semibold tracking-[0.16em] text-white/50 uppercase">Admin</p>
            <LiquidNav items={items} dark vertical />
            <div className="mt-auto space-y-1 border-t border-white/10 pt-3">
              <Link to="/" className="flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">
                <Store className="size-[18px]" aria-hidden /> View store
              </Link>
              <button onClick={() => { logout(); navigate('/'); }} className="flex min-h-10 w-full items-center gap-2 rounded-full px-3.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white">
                <LogOut className="size-[18px]" aria-hidden /> Log out
              </button>
              <p className="truncate px-3.5 pt-2 text-xs text-white/50">{user.email}</p>
            </div>
          </div>
        </aside>

        {/* Mobile / tablet top bar */}
        <div className="sticky top-0 z-40 px-3 pt-3 lg:hidden">
          <div className="glass glass-refract rounded-[24px] p-2">
            <div className="flex items-center justify-between px-2 pb-1.5">
              <Link to="/admin"><img src="/anavrin-logo.png" alt="Anavrin" className="h-9 w-auto" /></Link>
              <div className="flex items-center gap-1">
                <Link to="/" className="btn btn-ghost btn-sm" aria-label="View store"><Store className="size-4" /></Link>
                <button onClick={() => { logout(); navigate('/'); }} className="btn btn-ghost btn-sm" aria-label="Log out"><LogOut className="size-4" /></button>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-none"><LiquidNav items={items} className="w-max" /></div>
          </div>
        </div>

        <div className="px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.18 } }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </AdminContext.Provider>
  );
}

export function AdminHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{title}</h1>
          <LiveIndicator />
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
