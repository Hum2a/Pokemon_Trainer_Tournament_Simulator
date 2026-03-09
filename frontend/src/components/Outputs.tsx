import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";
import { MatchupAnalytics } from "./MatchupAnalytics";
import { cn } from "../lib/utils";

interface OutputFile {
  name: string;
  size: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function Outputs() {
  const { refreshOutputsTrigger, triggerOutputsRefresh, appendLog, config } = useApp();
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { showModal } = useApp();

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

  const hasMatchupResults = files.some((f) => f.name === "matchup_results.json");

  const handleDeleteClick = (filename: string) => {
    showModal({
      title: "Delete output?",
      message: `Are you sure you want to delete "${filename}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        setDeleting(filename);
        try {
          await api.delete(`/outputs/${encodeURIComponent(filename)}`);
          appendLog(`Deleted ${filename}`);
          triggerOutputsRefresh();
          await refresh();
        } catch (e) {
          appendLog(`Failed to delete: ${(e as Error).message}`, "error");
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  const handleDownload = async (filename: string) => {
    setDownloading(filename);
    try {
      await api.downloadFile(`/outputs/${encodeURIComponent(filename)}`, filename);
    } catch (e) {
      appendLog(`Failed to download: ${(e as Error).message}`, "error");
    } finally {
      setDownloading(null);
    }
  };

  const handleExportAnalyticsJson = async () => {
    try {
      const data = await api.get<Record<string, unknown>>("/outputs/matchup-data");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, "matchup_analytics_export.json");
      appendLog("Exported analytics as JSON");
    } catch (e) {
      appendLog(`Export failed: ${(e as Error).message}`, "error");
    }
  };

  const handleSaveToAccount = async () => {
    setSaving(true);
    try {
      await api.post("/simulations/save-current");
      appendLog("Saved simulation results to your account");
    } catch (e) {
      appendLog(`Save failed: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleExportAnalyticsCsv = async () => {
    try {
      const data = await api.get<Record<string, { p1: string; p2: string; p1_wins: number; p2_wins: number; total: number }>>("/outputs/matchup-data");
      const rows = [["Attacker", "Defender", "P1_Wins", "P2_Wins", "P1_WinRate"]];
      for (const [, m] of Object.entries(data)) {
        const rate = m.total > 0 ? (m.p1_wins / m.total).toFixed(3) : "0.000";
        rows.push([m.p1, m.p2, String(m.p1_wins), String(m.p2_wins), rate]);
      }
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      downloadBlob(blob, "matchup_analytics_export.csv");
      appendLog("Exported analytics as CSV");
    } catch (e) {
      appendLog(`Export failed: ${(e as Error).message}`, "error");
    }
  };

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
              <span className="text-[var(--text)] font-medium flex-1 truncate" title={f.name}>
                {f.name}
              </span>
              <span className="text-[var(--text-muted)] text-sm shrink-0">({formatSize(f.size)})</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(f.name)}
                  disabled={downloading === f.name}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    "bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title="Download"
                >
                  {downloading === f.name ? "…" : "Download"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(f.name)}
                  disabled={deleting === f.name}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    "bg-[var(--danger)]/20 text-[var(--danger)] hover:bg-[var(--danger)]/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title="Delete"
                >
                  {deleting === f.name ? "…" : "Delete"}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {hasMatchupResults && (
        <div className="mt-6 pt-6 border-t border-[var(--border)]/50">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-display font-semibold text-[var(--primary)]">Matchup Analytics</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveToAccount}
                disabled={saving}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  "bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {saving ? "Saving…" : "Save to my account"}
              </button>
              <button
                type="button"
                onClick={handleExportAnalyticsJson}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleExportAnalyticsCsv}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
          <MatchupAnalytics refreshTrigger={refreshOutputsTrigger} smogonFormat={config?.matchups?.smogonFormat} />
        </div>
      )}

      <motion.button
        type="button"
        onClick={refresh}
        className="mt-5 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:shadow-[0_0_20px_var(--primary-glow)] transition-all font-medium"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Refresh
      </motion.button>

    </Panel>
  );
}
