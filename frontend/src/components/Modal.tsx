import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "default";
  /** If true, only show OK button (alert style). If false, show Cancel + Confirm (confirm style). */
  alertOnly?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  alertOnly = false,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const buttonStyles = {
    danger: "bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30 border-[var(--danger)]/40",
    primary: "bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 border-[var(--primary)]/40",
    default: "bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 border-[var(--primary)]/40",
  };

  const modalContent = (
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
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[0_0_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,245,255,0.1)] overflow-hidden shrink-0"
            style={{ margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 id="modal-title" className="font-display font-semibold text-[var(--text)] text-lg mb-2">
                {title}
              </h3>
              <p id="modal-desc" className="text-[var(--text-muted)] text-sm leading-relaxed mb-6">
                {message}
              </p>
              <div className="flex justify-end gap-3">
                {!alertOnly && (
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      "border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)]",
                      "hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50"
                    )}
                  >
                    {cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={cn(
                    "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border",
                    buttonStyles[variant]
                  )}
                >
                  {alertOnly ? "OK" : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
