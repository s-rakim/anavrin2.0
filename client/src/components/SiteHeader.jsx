import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { Bike, House, LayoutDashboard, LogIn, LogOut, PackageCheck, Search, ShoppingBag, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { LiquidNav } from './LiquidGlass';

function navItemsFor(user) {
  const items = [{ to: '/', label: 'Shop', icon: Store, end: true, match: (p) => p === '/' || p.startsWith('/product') }];
  if (!user || user.role === 'customer') items.push({ to: '/home', label: 'My orders', icon: PackageCheck });
  if (user?.role === 'admin') items.push({ to: '/admin', label: 'Admin', icon: LayoutDashboard });
  if (user?.role === 'rider') items.push({ to: user.status === 'active' ? '/rider' : '/rider/status', label: 'Deliveries', icon: Bike });
  return items;
}

/** Floating liquid-glass header that tightens up as you scroll. */
export function SiteHeader() {
  const { user, logout } = useAuth();
  const { count, setOpen } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  const width = useTransform(scrollY, [0, 160], ['min(1240px, calc(100% - 24px))', 'min(1080px, calc(100% - 24px))']);
  const top = useTransform(scrollY, [0, 160], [14, 8]);

  // Slide away when scrolling down, glide back on scroll up.
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setHidden((h) => (y > 240 && y > prev + 4 ? true : y < prev - 4 ? false : h));
  });

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);

  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}#shop` : '/#shop');
  };

  return (
    <motion.header
      style={{ width, top }}
      animate={{ y: hidden ? -110 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 34 }}
      className="glass glass-refract fixed left-1/2 z-50 -translate-x-1/2 rounded-[28px] px-2.5 py-2"
    >
      <div className="flex items-center gap-2">
        <Link to="/" className="flex shrink-0 items-center rounded-full px-2 py-1" aria-label="Anavrin home">
          <img src="/anavrin-logo.png" alt="Anavrin" className="h-10 w-auto drop-shadow-sm sm:h-11" />
        </Link>

        <LiquidNav items={navItemsFor(user)} className="hidden md:block" />

        <form onSubmit={submit} className="relative ml-auto hidden max-w-sm flex-1 sm:block" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            placeholder="Search phones, tea, sneakers…"
            aria-label="Search products"
            className="h-11 w-full rounded-full border border-white/70 bg-white/70 pr-4 pl-10 text-sm text-ink placeholder:text-muted focus:border-brand-300 focus:bg-white focus:ring-4 focus:ring-brand-200/50 focus:outline-none"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          {user ? (
            <>
              <span className="hidden max-w-32 truncate px-2 text-sm text-ink-soft lg:block">Hi, {user.name.split(' ')[0]}</span>
              <button onClick={() => { logout(); navigate('/'); }} className="btn btn-ghost btn-sm hidden md:inline-flex" aria-label="Log out">
                <LogOut className="size-4" aria-hidden /> <span className="hidden xl:inline">Log out</span>
              </button>
            </>
          ) : (
            <Link to="/login" state={{ from: pathname }} className="btn btn-ghost btn-sm">
              <LogIn className="size-4" aria-hidden /> Log in
            </Link>
          )}
          <button onClick={() => setOpen(true)} className="glass-bubble relative grid size-11 place-items-center rounded-full text-ink transition active:scale-95"
            aria-label={`Open cart, ${count} items`}>
            <ShoppingBag className="size-5" aria-hidden />
            {count > 0 && (
              <motion.span key={count} initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }}
                className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-berry-600 px-1 text-[11px] font-bold text-white tabular">
                {count}
              </motion.span>
            )}
          </button>
        </div>
      </div>
    </motion.header>
  );
}

/** iOS-style floating tab bar on phones, with the same liquid bubble. */
export function MobileTabBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = [
    ...navItemsFor(user).map((i) => (i.to === '/' ? { ...i, label: 'Shop' } : i)),
    ...(user ? [] : [{ to: '/login', label: 'Account', icon: House }]),
  ];
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-safe md:hidden">
      <div className="glass glass-refract flex items-center gap-1 rounded-full p-1.5">
        <LiquidNav items={items} itemClassName="flex-col !gap-0.5 !px-4 !py-1.5 text-[11px]" />
        {user && (
          <button onClick={() => { logout(); navigate('/'); }} className="flex min-h-10 flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-[11px] font-medium text-ink-soft">
            <LogOut className="size-[18px]" aria-hidden /> Log out
          </button>
        )}
      </div>
    </div>
  );
}
