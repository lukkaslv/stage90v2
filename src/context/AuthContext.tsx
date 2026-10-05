import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { AuthContext } from './auth-context';

export type UserRole = 'guest' | 'user' | 'author' | 'media' | 'admin';

export interface User {
  id: string;
  role: UserRole;
  displayName: string;
  isVerified: boolean;
  authorCategory?: string;
}

interface ProfileInput {
  role: 'user' | 'author';
  displayName?: string;
  registrationReason?: string;
  artistName?: string;
  socialUrl: string;
}

function profileToUser(profile: Record<string, unknown> | null, session: Session): User {
  const roleValue = String(profile?.role ?? 'user');
  const role: UserRole = ['user', 'author', 'media', 'admin'].includes(roleValue) ? roleValue as UserRole : 'user';
  const displayName = String(profile?.display_name ?? profile?.artist_name ?? session.user.email?.split('@')[0] ?? 'მომხმარებელი');

  return {
    id: session.user.id,
    role,
    displayName,
    isVerified: Boolean(profile?.is_verified ?? false),
    authorCategory: profile?.author_category ? String(profile.author_category) : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);

  const syncSession = async (session: Session | null) => {
    if (!session) {
      setUser(null);
      setProfile(null);
      return;
    }

    if (!supabase) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const databaseProfile = (profile as Record<string, unknown> | null) ?? null;
    setProfile(databaseProfile);
    setUser(databaseProfile ? profileToUser(databaseProfile, session) : null);
  };

  const refreshProfile = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await syncSession(data.session);
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void syncSession(session); }, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client || !user?.id) return;
    const channel = client.channel(`profile-role-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => {
      void client.auth.getSession().then(({ data }) => syncSession(data.session));
    }).subscribe();
    return () => { void client.removeChannel(channel); };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase ჯერ არ არის კონფიგურირებული' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'შესვლა ვერ მოხერხდა. შეამოწმეთ ელ-ფოსტა და პაროლი.' };
    const { data: account } = await supabase.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
    if (!account) {
      await supabase.auth.signOut();
      return { error: 'ეს ანგარიში ადმინისტრატორის მიერ ჯერ არ არის დამტკიცებული.' };
    }
    return {};
  };

  const signUp = async (email: string, password: string, profile: ProfileInput) => {
    if (!supabase) return { error: 'Supabase ჯერ არ არის კონფიგურირებული' };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: {
        role: profile.role,
        display_name: profile.role === 'author' ? profile.artistName?.trim() : profile.displayName?.trim(),
        artist_name: profile.role === 'author' ? profile.artistName?.trim() : null,
        registration_reason: profile.registrationReason?.trim() || null,
        verification_link: profile.socialUrl.trim(),
      } },
    });
    return error
      ? { error: 'ანგარიშის შექმნა ვერ მოხერხდა. შეამოწმეთ მონაცემები ან სცადეთ სხვა ელ-ფოსტა.' }
      : { needsEmailConfirmation: data.session === null };
  };

  const setPassword = async (password: string) => {
    if (!supabase) return { error: 'Supabase ჯერ არ არის კონფიგურირებული' };
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { error: 'პაროლის შენახვა ვერ მოხერხდა. სცადეთ ხელახლა.' } : {};
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin: profile?.role === 'admin', isAuthenticated: user !== null, signIn, signUp, setPassword, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
