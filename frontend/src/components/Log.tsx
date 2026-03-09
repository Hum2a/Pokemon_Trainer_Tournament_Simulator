import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseProgress(logEntries: { text: string }[]): { current: number; total: number } | null {
  const full = logEntries.map((e) => e.text).join("\n");
  const completedMatch = full.match(/Completed\s+(\d+)\/(\d+)/g);
  if (completedMatch?.length) {
    const last = completedMatch[completedMatch.length - 1];
    const m = last.match(/(\d+)\/(\d+)/);
    if (m) return { current: parseInt(m[1], 10), total: parseInt(m[2], 10) };
  }
  const tqdmMatch = full.match(/(\d+)\/(\d+)\s+\d+%/);
  if (tqdmMatch) return { current: parseInt(tqdmMatch[1], 10), total: parseInt(tqdmMatch[2], 10) };
  return null;
}

export function Log() {
  const { logEntries, clearLog, status, taskStartTime, taskEndTime } = useApp();
  const preRef = useRef<HTMLPreElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [logEntries]);

  useEffect(() => {
    if (!status.running || !taskStartTime) return;
    const tick = () => setElapsed(Date.now() - taskStartTime);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status.running, taskStartTime]);

  const progress = useMemo(() => parseProgress(logEntries), [logEntries]);
  const lastEstimatedTotalRef = useRef<number | null>(null);
  const estimatedTotal = useMemo(() => {
    if (!progress || progress.current <= 0 || !taskStartTime) return null;
    const elapsedMs = status.running ? Date.now() - taskStartTime : (taskEndTime ?? Date.now()) - taskStartTime;
    return (elapsedMs / progress.current) * progress.total;
  }, [progress, taskStartTime, taskEndTime, status.running]);
  useEffect(() => {
    if (estimatedTotal !== null && progress && progress.current < progress.total) {
      lastEstimatedTotalRef.current = estimatedTotal;
    }
  }, [estimatedTotal, progress]);

  const totalDuration = taskStartTime && taskEndTime ? taskEndTime - taskStartTime : null;
  const showCompletedTimer = !status.running && totalDuration !== null;
  const expectedForComparison = lastEstimatedTotalRef.current ?? estimatedTotal;

  return (
    <Panel title="Log / Progress">
      {(status.running && taskStartTime) || showCompletedTimer ? (
        <div className="mb-3 p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border)]/50">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-[var(--primary)]">
              <span className="text-[var(--text-muted)]">Elapsed:</span>
              <span className="font-mono font-medium">{formatDuration(status.running ? elapsed : totalDuration!)}</span>
            </span>
            {status.running && progress && progress.total > 0 && (
              <>
                <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                  Progress:
                  <span className="text-[var(--text)] font-medium">
                    {progress.current}/{progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
                  </span>
                </span>
                {estimatedTotal !== null && estimatedTotal > 0 && (
                  <>
                    <span className="flex items-center gap-1.5 text-[var(--accent)]">
                      <span className="text-[var(--text-muted)]">Est. total:</span>
                      <span className="font-mono font-medium">{formatDuration(estimatedTotal)}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[var(--amber)]">
                      <span className="text-[var(--text-muted)]">Remaining:</span>
                      <span className="font-mono font-medium">
                        ~{formatDuration(Math.max(0, estimatedTotal - elapsed))}
                      </span>
                    </span>
                  </>
                )}
              </>
            )}
            {showCompletedTimer && expectedForComparison !== null && (
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                vs expected:
                <span className={cn(
                  "font-mono font-medium",
                  totalDuration! <= expectedForComparison ? "text-[var(--success)]" : "text-[var(--amber)]"
                )}>
                  {formatDuration(expectedForComparison)}
                  {totalDuration! <= expectedForComparison ? " (faster)" : " (slower)"}
                </span>
              </span>
            )}
          </div>
          {status.running && progress && progress.total > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-[var(--border)]/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[var(--primary)]"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>
      ) : null}
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
