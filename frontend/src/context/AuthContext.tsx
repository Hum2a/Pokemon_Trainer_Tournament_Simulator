import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => _cachedUser);
  const [session, setSession] = useState<Session | null>(() => _cachedSession);
  const [loading, setLoading] = useState(!_cachedUser);

  const updateAuth = useCallback((newSession: Session | null, newUser: User | null) => {
    _cachedSession = newSession;
    _cachedUser = newUser;
    setSession(newSession);
    setUser(newUser);
    setLoading(false);
  }, []);

  const refreshAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    updateAuth(data.session, data.session?.user ?? null);
  }, [updateAuth]);

  useEffect(() => {
    refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session && event !== "SIGNED_OUT") {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          updateAuth(data.session, data.session.user);
          return;
        }
      }
      updateAuth(session, session?.user ?? null);
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
