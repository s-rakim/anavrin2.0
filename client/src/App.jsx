import { Suspense, lazy } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useAuth } from './context/AuthContext';
import { CartDrawer } from './components/CartDrawer';
import { LiquidGlassFilter } from './components/LiquidGlass';
import { ScrollProgress } from './components/Motion';
import { QuickView } from './components/QuickView';
import { MobileTabBar, SiteHeader } from './components/SiteHeader';
import Store from './pages/Store';
import ProductPage from './pages/ProductPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import RiderApply from './pages/RiderApply';
import Checkout from './pages/Checkout';
import CustomerHome from './pages/CustomerHome';
import RiderHome from './pages/rider/RiderHome';
import RiderStatus from './pages/rider/RiderStatus';

// The admin area (charts, tables) is split into its own bundle.
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
const LiveStock = lazy(() => import('./pages/admin/LiveStock'));
const Riders = lazy(() => import('./pages/admin/Riders'));
const People = lazy(() => import('./pages/admin/People'));
const Transactions = lazy(() => import('./pages/admin/Transactions'));

/** Group routes so the page transition runs between sections, while the admin area animates its own sub-pages. */
const transitionKey = (pathname) => (pathname.startsWith('/admin') ? 'admin' : pathname);

export default function App() {
  const location = useLocation();
  const { ready } = useAuth();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <MotionConfig reducedMotion="user">
      <LiquidGlassFilter />
      <ScrollProgress />
      {!isAdmin && <SiteHeader />}
      {ready && (
        <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo({ top: 0, behavior: 'instant' })}>
          <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted">Loading…</div>} key={transitionKey(location.pathname)}>
            <Routes location={location}>
              <Route path="/" element={<Store />} />
              <Route path="/product/:id" element={<ProductPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/riders/apply" element={<RiderApply />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/home" element={<CustomerHome />} />
              <Route path="/rider" element={<RiderHome />} />
              <Route path="/rider/status" element={<RiderStatus />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Overview />} />
                <Route path="orders" element={<Orders />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="stock" element={<LiveStock />} />
                <Route path="riders" element={<Riders />} />
                <Route path="people" element={<People />} />
                <Route path="transactions" element={<Transactions />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      )}
      {!isAdmin && <Footer />}
      {!isAdmin && <MobileTabBar />}
      <CartDrawer />
      <QuickView />
    </MotionConfig>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 pt-28 text-center">
      <p className="font-display text-7xl font-semibold text-brand-800">404</p>
      <p className="mt-2 text-muted">We couldn’t find that page.</p>
      <Link to="/" className="btn btn-primary mt-6">Back to the store</Link>
    </main>
  );
}

function Footer() {
  return (
    <footer className="border-t border-silver-200 bg-white/60 pb-28 md:pb-10">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <img src="/anavrin-logo.png" alt="Anavrin" className="h-14 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-muted">Everyday essentials delivered across Kenya. Pay with M-Pesa or cash on delivery.</p>
        </div>
        {[
          ['Shop', [['All products', '/#shop'], ['Today’s deals', '/'], ['Your cart', '/checkout']]],
          ['Account', [['Log in', '/login'], ['Create account', '/signup'], ['Track orders', '/home']]],
          ['Work with us', [['Ride with Anavrin', '/riders/apply'], ['Rider log in', '/login']]],
        ].map(([title, links]) => (
          <div key={title}>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {links.map(([label, to]) => <li key={label}><Link to={to} className="text-muted hover:text-brand-700">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-7xl px-4 text-xs text-muted sm:px-6">© {new Date().getFullYear()} Anavrin. Nairobi, Kenya. Prices in Kenyan shillings, VAT inclusive.</p>
    </footer>
  );
}
