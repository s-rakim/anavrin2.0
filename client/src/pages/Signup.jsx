import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CircleCheck, PackageCheck, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { homeFor, isKePhone } from '../lib/format';
import { AuthShell } from '../components/AuthShell';
import { Field, Spinner } from '../components/ui';

/** Shopper sign-up. On success the shopper is sent to the login page to access their home page. */
export default function Signup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
    if (form.phone && !isKePhone(form.phone)) e.phone = 'Use a Kenyan mobile number, e.g. 0712 345 678.';
    if (form.password.length < 8) e.password = 'Use at least 8 characters.';
    if (form.confirm !== form.password) e.confirm = 'Passwords don’t match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setBusy(true);
    try {
      await api('/auth/signup', { method: 'POST', body: { name: form.name, email: form.email, phone: form.phone, password: form.password } });
      navigate('/login', { replace: true, state: { email: form.email.trim(), notice: 'Your account is ready. Log in to open your home page.' } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Shop across Kenya and follow every order live."
      aside={(
        <ul className="space-y-5">
          {[
            [Smartphone, 'Pay with M-Pesa or cash', 'No card needed. Pay the rider when your order arrives.'],
            [PackageCheck, 'Live order tracking', 'See when your order is confirmed, picked up and on the way.'],
            [CircleCheck, 'You confirm receipt', 'Orders close only after you confirm you got them.'],
          ].map(([Icon, t, b]) => (
            <li key={t} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-brand-200" aria-hidden />
              <span><span className="block font-semibold">{t}</span><span className="text-sm text-white/70">{b}</span></span>
            </li>
          ))}
        </ul>
      )}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <input id="name" autoComplete="name" value={form.name} onChange={set('name')} className="field" placeholder="Wanjiru Kamau" />
        </Field>
        <Field label="Email address" htmlFor="email" error={errors.email} hint="You’ll use this to log in.">
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} className="field" placeholder="you@example.com" />
        </Field>
        <Field label="Phone number (optional)" htmlFor="phone" error={errors.phone} hint="We’ll pre-fill it at checkout for the rider.">
          <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className="field" placeholder="0712 345 678" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" error={errors.password}>
            <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className="field" />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
            <input id="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} className="field" />
          </Field>
        </div>
        {error && <p className="rounded-xl bg-danger-100 px-3.5 py-2.5 text-sm font-medium text-danger-700" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary h-12 w-full">{busy ? <><Spinner /> Creating account…</> : 'Create account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
        <span className="mx-2 text-silver-400">·</span>
        <Link to="/riders/apply" className="font-semibold text-brand-700 hover:underline">Apply as a rider</Link>
      </p>
    </AuthShell>
  );
}
