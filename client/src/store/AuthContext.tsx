import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, refreshSession, setToken } from '../lib/api';

export interface User { id: number; email: string; name: string; role: 'seeker' | 'recruiter' | 'admin'; company_id?: number | null; companyId?: number | null }
interface AuthState { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; register: (b: Record<string, unknown>) => Promise<void>; logout: () => Promise<void> }
const Ctx = createContext<AuthState>({ user: null, loading: true, login: async () => undefined, register: async () => undefined, logout: async () => undefined });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { refreshSession().then((d) => { setUser((d?.user as User) ?? null); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const login = async (email: string, password: string) => { const d = await api<{ user: User; accessToken: string }>('POST', '/api/auth/login', { email, password }); setToken(d.accessToken); setUser(d.user); };
  const register = async (b: Record<string, unknown>) => { const d = await api<{ user: User; accessToken: string }>('POST', '/api/auth/register', b); setToken(d.accessToken); setUser(d.user); };
  const logout = async () => { await api('POST', '/api/auth/logout').catch(() => undefined); setToken(null); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
