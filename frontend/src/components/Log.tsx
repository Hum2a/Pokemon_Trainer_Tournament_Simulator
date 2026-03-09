import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";

export function Log() {
  const { logEntries, clearLog } = useApp();
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logEntries]);

  return (
    <Panel title="Log / Progress">
      <pre
        ref={preRef}
        className="bg-[var(--bg-input)] rounded-xl p-4 text-sm font-mono overflow-auto max-h-52 mb-4 whitespace-pre-wrap border border-[var(--border)]/50 focus-within:border-[var(--primary)]/30 transition-colors"
      >
        {logEntries.map((e, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className={cn(
              "py-0.5",
              e.type === "error" && "text-[var(--danger)] font-medium"
            )}
          >
            {e.text}
          </motion.div>
        ))}
      </pre>
      <motion.button
        type="button"
        onClick={clearLog}
        className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)] hover:border-[var(--text-muted)]/40 transition-all"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Clear
      </motion.button>
    </Panel>
  );
}
