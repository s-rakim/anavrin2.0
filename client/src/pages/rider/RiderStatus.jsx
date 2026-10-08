import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Clock, LogOut, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { VEHICLES, dateOnly } from '../../lib/format';
import { Page } from '../../components/Motion';
import { LiveIndicator, Spinner } from '../../components/ui';

/** What a rider sees between applying and being hired. Updates live when an admin decides. */
export default function RiderStatus() {
  const { user, logout } = useAuth();
  const [app, setApp] = useState(undefined);

  useEffect(() => {
    if (!user || user.status === 'active') return;
    api('/rider/application').then((d) => setApp(d.application)).catch(() => setApp(null));
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'rider') return <Navigate to="/" replace />;
  if (user.status === 'active') return <Navigate to="/rider" replace />;

  const rejected = user.status === 'rejected';
  return (
    <Page className="flex min-h-dvh items-center justify-center px-4 py-28">
      <div className="card w-full max-w-lg overflow-hidden rounded-[32px] text-center">
        <div className="glass-dark px-8 py-10 text-white">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/15">
            {rejected ? <XCircle className="size-8" aria-hidden /> : (
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}><Clock className="size-8" aria-hidden /></motion.span>
            )}
          </motion.div>
          <h1 className="mt-5 font-display text-4xl font-semibold">{rejected ? 'Application not successful' : 'Application under review'}</h1>
          <p className="mt-2 text-white/75">
            {rejected
              ? 'Thank you for applying. We’re not able to take you on right now.'
              : `Thanks, ${user.name.split(' ')[0]}. The Anavrin team is reviewing your application.`}
          </p>
        </div>
        <div className="space-y-4 p-8">
          {app === undefined ? <Spinner className="mx-auto size-5 text-muted" /> : app && (
            <dl className="grid grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-xl bg-silver-100 p-3"><dt className="text-muted">Submitted</dt><dd className="font-medium">{dateOnly(app.createdAt)}</dd></div>
              <div className="rounded-xl bg-silver-100 p-3"><dt className="text-muted">Vehicle</dt><dd className="font-medium">{VEHICLES[app.vehicleType] || app.vehicleType}</dd></div>
              <div className="col-span-2 rounded-xl bg-silver-100 p-3"><dt className="text-muted">Area</dt><dd className="font-medium">{app.area}</dd></div>
            </dl>
          )}
          {!rejected && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <LiveIndicator label="Watching" /> This page unlocks automatically once you’re hired.
            </p>
          )}
          <button onClick={logout} className="btn btn-secondary"><LogOut className="size-4" aria-hidden /> Log out</button>
        </div>
      </div>
    </Page>
  );
}
