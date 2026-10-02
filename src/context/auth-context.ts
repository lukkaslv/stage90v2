import { createContext, useContext } from 'react';
import type { User } from './AuthContext';

export interface AuthContextValue {
  user: User | null;
  profile: Record<string, unknown> | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, profile: { role: 'user' | 'author'; displayName?: string; registrationReason?: string; artistName?: string; socialUrl: string }) => Promise<{ error?: string }>;
  setPassword: (password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
