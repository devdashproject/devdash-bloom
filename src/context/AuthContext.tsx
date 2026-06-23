import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearAuthToken, getAuthToken, setAuthToken } from '../services/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithToken: (token: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function verify(): Promise<User | null> {
    const r = await api.get<User>('/auth/me');
    return r.success ? r.data! : null;
  }

  useEffect(() => {
    (async () => {
      if (!getAuthToken()) { setIsLoading(false); return; }
      const u = await verify();
      if (u) setUser(u);
      else clearAuthToken();
      setIsLoading(false);
    })();
  }, []);

  async function loginWithToken(token: string): Promise<boolean> {
    setAuthToken(token);
    const u = await verify();
    if (u) { setUser(u); return true; }
    clearAuthToken();
    return false;
  }

  function logout() {
    clearAuthToken();
    setUser(null);
  }

  return (
    <Ctx.Provider value={{ user, isLoading, isAuthenticated: !!user, loginWithToken, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
