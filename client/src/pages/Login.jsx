import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bike, Lock, Mail, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../components/AuthShell';
import { Field, Spinner } from '../components/ui';
import { homeFor } from '../lib/format';

/**
 * The single sign-in page. Customers, riders and admins all log in here with their email;
 * the account's role decides where they land.
 */
export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const notice = location.state?.notice;

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      const from = location.state?.from;
      const backToStore = u.role === 'customer' && from && !from.startsWith('/admin') && !from.startsWith('/rider');
      navigate(backToStore ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in with the email address on your Anavrin account."
      aside={(
        <>
          <p className="font-display text-4xl leading-tight font-semibold">One login for shoppers, riders and the Anavrin team.</p>
          <p className="mt-4 text-white/70">We’ll take you to the right place once you’re signed in.</p>
        </>
      )}
    >
      {notice && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl bg-ok-100 px-4 py-3 text-sm font-medium text-ok-700" role="status">{notice}</motion.p>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email address" htmlFor="email">
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="field pl-10" placeholder="you@example.com" />
          </div>
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="field pl-10" placeholder="••••••••" />
          </div>
        </Field>
        {error && (
          <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} transition={{ duration: 0.35 }}
            className="rounded-xl bg-danger-100 px-3.5 py-2.5 text-sm font-medium text-danger-700" role="alert">{error}</motion.p>
        )}
        <button type="submit" disabled={busy || !email || !password} className="btn btn-primary h-12 w-full">
          {busy ? <><Spinner /> Signing in…</> : 'Log in'}
        </button>
      </form>

      <div className="mt-8 border-t border-silver-200 pt-6">
        <p className="text-sm font-medium text-ink">New to Anavrin?</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link to="/signup" className="group flex items-center gap-3 rounded-2xl border border-silver-200 bg-silver-50 p-3.5 transition hover:border-brand-300 hover:bg-white">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-800 text-white transition group-hover:scale-105"><ShoppingBag className="size-5" aria-hidden /></span>
            <span><span className="block text-sm font-semibold text-ink">Create a shopper account</span><span className="text-xs text-muted">Shop and track orders</span></span>
          </Link>
          <Link to="/riders/apply" className="group flex items-center gap-3 rounded-2xl border border-silver-200 bg-silver-50 p-3.5 transition hover:border-brand-300 hover:bg-white">
            <span className="grid size-10 place-items-center rounded-xl bg-berry-600 text-white transition group-hover:scale-105"><Bike className="size-5" aria-hidden /></span>
            <span><span className="block text-sm font-semibold text-ink">Apply to be a rider</span><span className="text-xs text-muted">Deliver with Anavrin</span></span>
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
