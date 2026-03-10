import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { AuthForm } from "./AuthForm";
import { cn } from "../lib/utils";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const { signIn, signUp, signInWithGoogle } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = mode === "signin" ? signIn : signUp;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="flex items-center justify-center p-4"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 2147483647,
            overflow: "auto",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            style={{ top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sign in or create account"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] shrink-0"
            style={{ margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center",
                "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-input)] transition-colors"
              )}
              aria-label="Close"
            >
              ×
            </button>
            <AuthForm
              mode={mode}
              onSuccess={onSuccess}
              onSwitchMode={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
              onSubmit={handleSubmit}
              onGoogleClick={signInWithGoogle}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
