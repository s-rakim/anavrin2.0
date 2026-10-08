import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';
import { refreshSocket, useSocketEvent } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
    refreshSocket();
  }, []);

  const reload = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return null; }
    try {
      const { user: u } = await api('/auth/me');
      setUser(u);
      return u;
    } catch (err) {
      if (err.status === 401 || err.status === 403) logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    reload().finally(() => setReady(true));
  }, [reload, logout]);

  // An admin changed this account (hired, suspended, promoted...): pick up the new access straight away.
  useSocketEvent('session:refresh', async () => {
    await reload();
    refreshSocket();
  });

  const login = useCallback(async (email, password) => {
    const { token, user: u } = await api('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(token);
    setUser(u);
    refreshSocket();
    return u;
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout, reload }), [user, ready, login, logout, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
