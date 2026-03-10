import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";

type Mode = "signin" | "signup";

interface AuthFormProps {
  mode: Mode;
  onSuccess: () => void;
  onSwitchMode: () => void;
  onSubmit: (email: string, password: string) => Promise<{ error: Error | null }>;
  onGoogleClick?: () => Promise<{ error: Error | null }>;
}

export function AuthForm({
  mode,
  onSuccess,
  onSwitchMode,
  onSubmit,
  onGoogleClick,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const { error: err } = await onSubmit(email, password);
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (mode === "signup") {
      setError(null);
      setEmail("");
      setPassword("");
      setSuccess("Check your email to confirm your account, then sign in.");
      onSwitchMode();
      return;
    }
    onSuccess();
  };

  const handleGoogleClick = async () => {
    if (!onGoogleClick) return;
    setError(null);
    setLoading(true);
    const { error: err } = await onGoogleClick();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSuccess();
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 w-full max-w-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h2 className="text-xl font-semibold text-[var(--text)]">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h2>
      {onGoogleClick && (
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          className={cn(
            "w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
            "bg-white text-gray-800 hover:bg-gray-100 border border-gray-300",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      )}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-[var(--bg-panel)] px-2 text-[var(--text-muted)]">or</span>
        </div>
      </div>
      <div>
        <label htmlFor="auth-email" className="block text-sm text-[var(--text-muted)] mb-1">
          Email
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={cn(
            "w-full px-4 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]",
            "text-[var(--text)] placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
          )}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="auth-password" className="block text-sm text-[var(--text-muted)] mb-1">
          Password
        </label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={6}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border)]",
            "text-[var(--text)] placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 focus:border-[var(--primary)]"
          )}
          placeholder="••••••••"
        />
        {mode === "signup" && (
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            At least 6 characters
          </p>
        )}
      </div>
      {error && (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      )}
      {success && (
        <p className="text-sm text-[var(--success)]">{success}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className={cn(
          "w-full py-2.5 rounded-lg font-medium transition-colors",
          "bg-[var(--primary)] text-[var(--bg-dark)] hover:bg-[var(--primary-dim)]",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        onClick={() => {
          setSuccess(null);
          setError(null);
          onSwitchMode();
        }}
        className="text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
      >
        {mode === "signin"
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </motion.form>
  );
}
