import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";

interface OutputFile {
  name: string;
  size: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function Outputs() {
  const { refreshOutputsTrigger } = useApp();
  const [files, setFiles] = useState<OutputFile[]>([]);

  const refresh = async () => {
    try {
      const data = await api.get<OutputFile[]>("/outputs");
      setFiles(data);
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => {
    refresh();
  }, [refreshOutputsTrigger]);

  return (
    <Panel title="Outputs">
      <div className="space-y-3 mb-5">
        {files.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">Run simulations and parse to generate outputs.</p>
        ) : (
          files.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50 hover:border-[var(--primary)]/30 transition-colors group"
            >
              <a
                href={`${api.base}/outputs/${encodeURIComponent(f.name)}`}
                download
                className="text-[var(--primary)] hover:text-[var(--primary)] font-medium hover:underline flex-1 group-hover:shadow-[0_0_12px_var(--primary-glow)] transition-all"
              >
                {f.name}
              </a>
              <span className="text-[var(--text-muted)] text-sm">({formatSize(f.size)})</span>
            </motion.div>
          ))
        )}
      </div>
      <motion.button
        type="button"
        onClick={refresh}
        className="px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:shadow-[0_0_20px_var(--primary-glow)] transition-all font-medium"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Refresh
      </motion.button>
    </Panel>
  );
}
