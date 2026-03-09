import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";

type Mode = "signin" | "signup";

interface AuthFormProps {
  mode: Mode;
  onSuccess: () => void;
  onSwitchMode: () => void;
  onSubmit: (email: string, password: string) => Promise<{ error: Error | null }>;
}

export function AuthForm({
  mode,
  onSuccess,
  onSwitchMode,
  onSubmit,
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
