import { useCallback, useState } from "react";
import { MatchupAnalyticsView, type MatchupAnalyticsData } from "../components/MatchupAnalyticsView";
import { cn } from "../lib/utils";

type FileState = "idle" | "loading" | "ready" | "error";

export function UploadResultsPage() {
  const [matchupResults, setMatchupResults] = useState<Record<string, { p1: string; p2: string; p1_wins: number; p2_wins: number; total: number }> | null>(null);
  const [matchupMatrixCsv, setMatchupMatrixCsv] = useState<string | null>(null);
  const [matchupBattleLogs, setMatchupBattleLogs] = useState<unknown | null>(null);
  const [resultsState, setResultsState] = useState<FileState>("idle");
  const [matrixState, setMatrixState] = useState<FileState>("idle");
  const [logsState, setLogsState] = useState<FileState>("idle");
  const [resultsError, setResultsError] = useState<string | null>(null);

  const parseJson = useCallback(
    (file: File): Promise<unknown> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = reader.result as string;
            resolve(JSON.parse(text));
          } catch (e) {
            reject(new Error("Invalid JSON"));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      }),
    []
  );

  const parseCsv = useCallback(
    (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) ?? "");
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      }),
    []
  );

  const handleResultsUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setResultsState("loading");
      setResultsError(null);
      try {
        const raw = await parseJson(file) as Record<string, unknown>;
        if (typeof raw !== "object" || raw === null) {
          throw new Error("Expected an object with matchup data");
        }
        const data = (raw.matchup_results as Record<string, { p1: string; p2: string; p1_wins: number; p2_wins: number; total: number }>) ?? raw;
        const entries = Object.values(data);
        const valid = entries.every(
          (m) =>
            typeof m?.p1 === "string" &&
            typeof m?.p2 === "string" &&
            typeof m?.p1_wins === "number" &&
            typeof m?.p2_wins === "number" &&
            typeof m?.total === "number"
        );
        if (!valid) {
          throw new Error("Invalid format: each entry needs p1, p2, p1_wins, p2_wins, total");
        }
        setMatchupResults(data);
        setResultsState("ready");
      } catch (err) {
        setResultsError((err as Error).message);
        setResultsState("error");
        setMatchupResults(null);
      }
      e.target.value = "";
    },
    [parseJson]
  );

  const handleMatrixUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setMatrixState("loading");
      try {
        const text = await parseCsv(file);
        setMatchupMatrixCsv(text);
        setMatrixState("ready");
      } catch {
        setMatrixState("error");
        setMatchupMatrixCsv(null);
      }
      e.target.value = "";
    },
    [parseCsv]
  );

  const handleLogsUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setLogsState("loading");
      try {
        const data = await parseJson(file);
        setMatchupBattleLogs(data);
        setLogsState("ready");
      } catch {
        setLogsState("error");
        setMatchupBattleLogs(null);
      }
      e.target.value = "";
    },
    [parseJson]
  );

  const handleClear = useCallback(() => {
    setMatchupResults(null);
    setMatchupMatrixCsv(null);
    setMatchupBattleLogs(null);
    setResultsState("idle");
    setMatrixState("idle");
    setLogsState("idle");
    setResultsError(null);
  }, []);

  const hasAnalytics = matchupResults && Object.keys(matchupResults).length > 0;
  const analyticsData: MatchupAnalyticsData | null = hasAnalytics
    ? {
        matchup_results: matchupResults,
        matchup_matrix_csv: matchupMatrixCsv ?? undefined,
      }
    : null;

  const handleDownloadCsv = useCallback(() => {
    if (!matchupMatrixCsv) return;
    const blob = new Blob([matchupMatrixCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matchup_matrix_uploaded.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [matchupMatrixCsv]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-[var(--text)]">
          Upload Results
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Upload matchup result files you previously downloaded to view analytics.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-6 space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">
          Upload files
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FileUploadSlot
            label="matchup_results.json"
            required
            state={resultsState}
            error={resultsError}
            accept=".json"
            onUpload={handleResultsUpload}
          />
          <FileUploadSlot
            label="matchup_matrix.csv"
            state={matrixState}
            accept=".csv"
            onUpload={handleMatrixUpload}
          />
          <FileUploadSlot
            label="matchup_battle_logs.json"
            state={logsState}
            accept=".json"
            onUpload={handleLogsUpload}
          />
        </div>
        {(hasAnalytics || matchupMatrixCsv || !!matchupBattleLogs) && (
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {analyticsData ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-6">
          <MatchupAnalyticsView
            data={analyticsData}
            onDownloadCsv={matchupMatrixCsv ? handleDownloadCsv : undefined}
          />
        </div>
      ) : (
        resultsState === "idle" && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
            <p className="text-[var(--text-muted)]">
              Upload <strong>matchup_results.json</strong> to view analytics.
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Optionally add matchup_matrix.csv for CSV download and matchup_battle_logs.json for
              extended analytics.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function FileUploadSlot({
  label,
  required,
  state,
  error,
  accept,
  onUpload,
}: {
  label: string;
  required?: boolean;
  state: FileState;
  error?: string | null;
  accept: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--text)]">
        {label}
        {required && <span className="text-[var(--danger)] ml-1">*</span>}
      </label>
      <label
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
          state === "ready" && "border-[var(--success)] bg-[var(--success)]/5",
          state === "error" && "border-[var(--danger)] bg-[var(--danger)]/5",
          (state === "idle" || state === "loading") &&
            "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--bg-input)]/50"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={onUpload}
          className="hidden"
          disabled={state === "loading"}
        />
        {state === "loading" && (
          <span className="text-sm text-[var(--text-muted)]">Loading…</span>
        )}
        {state === "ready" && (
          <span className="text-sm text-[var(--success)]">✓ Uploaded</span>
        )}
        {state === "error" && (
          <span className="text-sm text-[var(--danger)]">Invalid file</span>
        )}
        {(state === "idle" || (state === "error" && error)) && (
          <span className="text-sm text-[var(--text-muted)]">
            {state === "error" && error ? error : "Click to upload"}
          </span>
        )}
      </label>
    </div>
  );
}
