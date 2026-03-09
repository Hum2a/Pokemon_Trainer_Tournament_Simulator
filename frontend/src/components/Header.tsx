import { motion } from "framer-motion";
import { useApp } from "../context/AppContext";

export function Header() {
  const { status } = useApp();
  return (
    <header className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--border)] backdrop-blur-sm">
      <motion.h1
        className="m-0 text-3xl sm:text-4xl font-display font-extrabold tracking-tight"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] via-[var(--primary)] to-[var(--amber)] bg-[length:200%_auto] animate-[gradient-shift_4s_ease_infinite]">
          Pokemon Battle Simulator
        </span>
      </motion.h1>
      <motion.div
        className="flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--bg-panel)] border border-[var(--border)] backdrop-blur-md"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.span
          className={`w-3 h-3 rounded-full ${
            status.running
              ? "bg-[var(--accent)] shadow-[0_0_12px_var(--accent-glow)]"
              : "bg-[var(--success)] shadow-[0_0_12px_var(--success-glow)]"
          }`}
          animate={status.running ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
          transition={{ duration: 1.5, repeat: status.running ? Infinity : 0 }}
        />
        <span className="text-sm font-medium text-[var(--text)]">{status.text}</span>
      </motion.div>
    </header>
  );
}
