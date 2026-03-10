import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type UserRole = "user" | "admin" | "developer";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Persist auth across React Strict Mode remounts and navigation
let _cachedUser: User | null = null;
let _cachedSession: Session | null = null;
let _cachedRole: UserRole = "user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => _cachedUser);
  const [session, setSession] = useState<Session | null>(() => _cachedSession);
  const [role, setRole] = useState<UserRole>(() => _cachedRole);
  const [loading, setLoading] = useState(!_cachedUser);

  const updateAuth = useCallback((newSession: Session | null, newUser: User | null) => {
    _cachedSession = newSession;
    _cachedUser = newUser;
    setSession(newSession);
    setUser(newUser);
    setLoading(false);
    if (!newUser) {
      _cachedRole = "user";
      setRole("user");
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    updateAuth(data.session, data.session?.user ?? null);
    if (data.session?.user) {
      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
          credentials: "include",
        });
        if (res.ok) {
          const { role: r } = await res.json();
          if (r === "admin" || r === "developer" || r === "user") {
            _cachedRole = r;
            setRole(r);
          }
        }
      } catch {
        _cachedRole = "user";
        setRole("user");
      }
    }
  }, [updateAuth]);

  useEffect(() => {
    refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (!session && event !== "SIGNED_OUT") {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await refreshAuth();
          return;
        }
      }
      if (session) {
        await refreshAuth();
      } else {
        updateAuth(null, null);
      }
    });

    const onFocus = () => refreshAuth();
    window.addEventListener("focus", onFocus);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshAuth, updateAuth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ?? null };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ?? null };
    },
    []
  );

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error: error ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    updateAuth(null, null);
  }, [updateAuth]);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        getAccessToken,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
