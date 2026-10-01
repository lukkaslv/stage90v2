import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { AuthContext } from './auth-context';

export type UserRole = 'guest' | 'user' | 'author' | 'artist' | 'media' | 'admin';

export interface User {
  id: string;
  role: UserRole;
  displayName: string;
  isVerified: boolean;
  authorCategory?: string;
  mediaMonthlyReleases: number;
}

interface ProfileInput {
  role: Exclude<UserRole, 'guest'>;
  displayName?: string;
  registrationReason?: string;
  artistName?: string;
  verificationLink?: string;
}

function profileToUser(profile: Record<string, unknown> | null, session: Session): User {
  const metadata = session.user.user_metadata ?? {};
  const roleValue = String(profile?.role ?? metadata.role ?? 'user');
  const role: UserRole = ['user', 'author', 'artist', 'media', 'admin'].includes(roleValue) ? roleValue as UserRole : 'user';
  const displayName = role === 'author' || role === 'artist'
    ? String(profile?.artist_name ?? metadata.artist_name ?? session.user.email?.split('@')[0] ?? 'ავტორი')
    : String(profile?.display_name ?? metadata.display_name ?? session.user.email?.split('@')[0] ?? 'მომხმარებელი');

  return {
    id: session.user.id,
    role,
    displayName,
    isVerified: Boolean(profile?.is_verified ?? false),
    authorCategory: profile?.author_category ? String(profile.author_category) : undefined,
    mediaMonthlyReleases: Number(profile?.media_monthly_releases ?? 0),
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

    if (!supabase) {
      setProfile(null);
      setUser(profileToUser(null, session));
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    const databaseProfile = (profile as Record<string, unknown> | null) ?? null;
    setProfile(databaseProfile);
    setUser(profileToUser(databaseProfile, session));
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, profile: ProfileInput) => {
    if (!supabase) return { error: 'Supabase ჯერ არ არის კონფიგურირებული' };

    const metadata = profile.role === 'user'
      ? { role: 'user', display_name: profile.displayName, registration_reason: profile.registrationReason }
      : { role: 'author', artist_name: profile.artistName, verification_link: profile.verificationLink, is_verified: false };

    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) return { error: error.message };

    if (data.user) {
      const profileRow: Record<string, unknown> = profile.role === 'user'
        ? { id: data.user.id, role: 'user', display_name: profile.displayName, registration_reason: profile.registrationReason, is_verified: false }
        : { id: data.user.id, role: 'author', artist_name: profile.artistName, verification_link: profile.verificationLink, is_verified: false };
      const { error: profileError } = await supabase.from('profiles').upsert(profileRow, { onConflict: 'id' });
      if (profileError) return { error: profileError.message };
    }

    return { needsEmailConfirmation: !data.session };
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isAdmin: profile?.role === 'admin', isAuthenticated: user !== null, signIn, signUp, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
