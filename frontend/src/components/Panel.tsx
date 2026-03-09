import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PanelProps {
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function Panel({ title, children, defaultCollapsed = false }: PanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <motion.section
      className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border)] overflow-visible backdrop-blur-xl bg-[var(--bg-panel)] shadow-[0_0_0_1px_rgba(0,245,255,0.05),0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_0_0_1px_rgba(0,245,255,0.15),0_8px_32px_rgba(0,0,0,0.4)] transition-shadow duration-300"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h2
        className="m-0 px-5 py-4 text-base font-display font-semibold flex items-center justify-between cursor-pointer select-none bg-gradient-to-r from-black/30 to-transparent rounded-t-[var(--radius-lg)] hover:from-black/40 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-[var(--text)]">{title}</span>
        <motion.span
          className="inline-block w-5 h-5 text-[var(--primary)] flex items-center justify-center"
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          aria-hidden
        >
          ▼
        </motion.span>
      </h2>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-[var(--border)]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
