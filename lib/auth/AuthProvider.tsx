"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  canAccessTab as checkTabAccess,
  canPerformAction as checkActionAccess,
  DEFAULT_USER_ROLE,
  getAccessibleTabs,
  type AppAction,
  type UserRole,
} from "@/lib/auth/permissions";
import { ensureUserProfile, type UserProfile } from "@/lib/auth/profile";
import { supabase } from "@/lib/supabase";
import type { TabId } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  accessibleTabs: TabId[];
  canAccessTab: (tab: TabId) => boolean;
  canPerformAction: (action: AppAction) => boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      return;
    }

    const nextProfile = await ensureUserProfile(
      nextUser.id,
      nextUser.email ?? "",
    );
    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (!mounted) return;

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      try {
        await loadProfile(initialSession?.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setLoading(true);
        try {
          await loadProfile(nextSession.user);
        } finally {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    setProfile(null);
    await supabase.auth.signOut();
  }, []);

  const role = profile?.role ?? DEFAULT_USER_ROLE;
  const accessibleTabs = useMemo(() => getAccessibleTabs(role), [role]);

  const canAccessTab = useCallback(
    (tab: TabId) => checkTabAccess(role, tab),
    [role],
  );

  const canPerformAction = useCallback(
    (action: AppAction) => checkActionAccess(role, action),
    [role],
  );

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      role,
      loading,
      accessibleTabs,
      canAccessTab,
      canPerformAction,
      signIn,
      signOut,
    }),
    [
      user,
      session,
      profile,
      role,
      loading,
      accessibleTabs,
      canAccessTab,
      canPerformAction,
      signIn,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

/** Shorthand for action checks in components. */
export function usePermissions() {
  const { role, accessibleTabs, canAccessTab, canPerformAction } = useAuth();
  return { role, accessibleTabs, canAccessTab, canPerformAction };
}
