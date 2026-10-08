import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Banknote, Bike, CalendarClock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { VEHICLES, homeFor, isKePhone } from '../lib/format';
import { AuthShell } from '../components/AuthShell';
import { Field, Spinner } from '../components/ui';

const STEPS = ['Your details', 'Your ride', 'Account'];

/** Rider sign-up is a job application. Admins review it before the rider gets access. */
export default function RiderApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [form, setForm] = useState({
    name: '', phone: '', nationalId: '', area: '',
    vehicleType: 'motorbike', plateNumber: '', experience: '', about: '',
    email: '', password: '', confirm: '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.name.trim()) e.name = 'Enter your full name.';
      if (!isKePhone(form.phone)) e.phone = 'Use a Kenyan mobile number, e.g. 0712 345 678.';
      if (!/^\d{6,10}$/.test(form.nationalId.trim())) e.nationalId = 'National ID should be 6 to 10 digits.';
      if (!form.area.trim()) e.area = 'Tell us where you’d like to deliver.';
    }
    if (s === 1 && ['motorbike', 'car', 'tuktuk'].includes(form.vehicleType) && !form.plateNumber.trim()) {
      e.plateNumber = 'Enter the number plate, e.g. KMDA 123A.';
    }
    if (s === 2) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Enter a valid email address.';
      if (form.password.length < 8) e.password = 'Use at least 8 characters.';
      if (form.confirm !== form.password) e.confirm = 'Passwords don’t match.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (to) => {
    if (to > step && !validateStep(step)) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateStep(2)) return;
    setBusy(true);
    try {
      const { confirm, ...body } = form;
      await api('/auth/rider-apply', { method: 'POST', body });
      navigate('/login', { replace: true, state: { email: form.email.trim(), notice: 'Application sent! Log in any time to check whether you’ve been hired.' } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      wide
      title="Ride with Anavrin"
      subtitle="Apply to deliver for Anavrin. Our team reviews every application, and you get access to the rider app once you’re hired."
      aside={(
        <>
          <p className="font-display text-4xl leading-tight font-semibold">Earn on your own schedule.</p>
          <ul className="mt-8 space-y-5">
            {[
              [Banknote, 'Paid per delivery', 'Weekly payouts straight to M-Pesa.'],
              [CalendarClock, 'Flexible hours', 'Pick up deliveries when it suits you.'],
              [ShieldCheck, 'Verified customers', 'Every order comes with the buyer’s number and directions.'],
            ].map(([Icon, t, b]) => (
              <li key={t} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-200" aria-hidden />
                <span><span className="block font-semibold">{t}</span><span className="text-sm text-white/70">{b}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    >
      <ol className="mb-8 flex items-center gap-2" aria-label="Application steps">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-silver-200">
              <motion.div className="h-full rounded-full bg-brand-700" initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-ink' : 'text-muted'}`} aria-current={i === step ? 'step' : undefined}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <form onSubmit={step === 2 ? submit : (e) => { e.preventDefault(); go(step + 1); }} noValidate>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir}
              initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4">
              {step === 0 && (
                <>
                  <Field label="Full name (as on your ID)" htmlFor="name" error={errors.name}>
                    <input id="name" autoComplete="name" value={form.name} onChange={set('name')} className="field" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Phone number" htmlFor="phone" error={errors.phone} hint="Customers will call this number.">
                      <input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} className="field" placeholder="0712 345 678" />
                    </Field>
                    <Field label="National ID number" htmlFor="nid" error={errors.nationalId}>
                      <input id="nid" inputMode="numeric" value={form.nationalId} onChange={set('nationalId')} className="field" placeholder="12345678" />
                    </Field>
                  </div>
                  <Field label="Where would you like to deliver?" htmlFor="area" error={errors.area} hint="Estate, town or area, e.g. Westlands, Kilimani, Ruaka.">
                    <input id="area" value={form.area} onChange={set('area')} className="field" />
                  </Field>
                </>
              )}
              {step === 1 && (
                <>
                  <fieldset>
                    <legend className="field-label">How will you deliver?</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {Object.entries(VEHICLES).map(([value, label]) => (
                        <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${form.vehicleType === value ? 'border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-200' : 'border-silver-300 bg-white text-ink-soft hover:border-brand-300'}`}>
                          <input type="radio" name="vehicle" value={value} checked={form.vehicleType === value} onChange={set('vehicleType')} className="sr-only" />
                          <Bike className="size-4" aria-hidden /> {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Number plate" htmlFor="plate" error={errors.plateNumber} hint="Skip for bicycle or on foot.">
                      <input id="plate" value={form.plateNumber} onChange={set('plateNumber')} className="field uppercase" placeholder="KMDA 123A" />
                    </Field>
                    <Field label="Delivery experience" htmlFor="exp">
                      <select id="exp" value={form.experience} onChange={set('experience')} className="field">
                        <option value="">Select…</option>
                        <option>No experience yet</option>
                        <option>Less than 1 year</option>
                        <option>1–3 years</option>
                        <option>More than 3 years</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Anything else we should know? (optional)" htmlFor="about">
                    <textarea id="about" rows={3} value={form.about} onChange={set('about')} className="field resize-none"
                      placeholder="Languages you speak, days you’re available, previous delivery apps…" />
                  </Field>
                </>
              )}
              {step === 2 && (
                <>
                  <Field label="Email address" htmlFor="email" error={errors.email} hint="You’ll log in with this email once you’re hired.">
                    <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} className="field" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Password" htmlFor="pw" error={errors.password}>
                      <input id="pw" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className="field" />
                    </Field>
                    <Field label="Confirm password" htmlFor="pw2" error={errors.confirm}>
                      <input id="pw2" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} className="field" />
                    </Field>
                  </div>
                  <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-ink-soft">
                    Your application goes to the Anavrin team. You can log in to check its status, and the rider dashboard unlocks as soon as you’re hired.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {error && <p className="mt-4 rounded-xl bg-danger-100 px-3.5 py-2.5 text-sm font-medium text-danger-700" role="alert">{error}</p>}

        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => go(step - 1)} className="btn btn-secondary"><ArrowLeft className="size-4" aria-hidden /> Back</button>
          )}
          <button type="submit" disabled={busy} className="btn btn-primary ml-auto min-w-40">
            {step < 2 ? <>Continue <ArrowRight className="size-4" aria-hidden /></> : busy ? <><Spinner /> Sending…</> : 'Submit application'}
          </button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already applied? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Log in to check your status</Link>
      </p>
    </AuthShell>
  );
}
