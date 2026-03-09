import { useEffect, useState } from "react";
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
      <div className="space-y-2 mb-4">
        {files.length === 0 ? (
          <p className="text-[var(--text-muted)]">Run simulations and parse to generate outputs.</p>
        ) : (
          files.map((f) => (
            <div key={f.name} className="flex items-center gap-2">
              <a
                href={`${api.base}/outputs/${encodeURIComponent(f.name)}`}
                download
                className="text-[var(--primary)] hover:underline"
              >
                {f.name}
              </a>
              <span className="text-[var(--text-muted)] text-sm">({formatSize(f.size)})</span>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={refresh}
        className="px-4 py-2 rounded border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:bg-white/5"
      >
        Refresh
      </button>
    </Panel>
  );
}
