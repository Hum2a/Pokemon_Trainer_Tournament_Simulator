import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AuthForm } from "./AuthForm";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-muted)]">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border)]">
          <p className="text-[var(--text-muted)] text-center max-w-sm">
            Sign in to run simulations and save your config and results.
          </p>
          <AuthForm
            mode={mode}
            onSuccess={() => {}}
            onSwitchMode={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            onSubmit={mode === "signin" ? signIn : signUp}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
