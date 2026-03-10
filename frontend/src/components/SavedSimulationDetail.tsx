import { useEffect, useState } from "react";
import { api } from "../api";
import { MatchupAnalyticsView, type MatchupAnalyticsData } from "./MatchupAnalyticsView";

export function SavedSimulationDetail({
  runId,
  onClose,
  admin = false,
}: {
  runId: string;
  onClose: () => void;
  /** When true, fetches from admin endpoint (any user's simulation). */
  admin?: boolean;
}) {
  const [result, setResult] = useState<MatchupAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = admin ? `/admin/simulations/${runId}` : `/simulations/${runId}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<MatchupAnalyticsData>(endpoint)
      .then((d) => {
        if (!cancelled) setResult(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  if (loading) {
    return <p className="text-[var(--text-muted)] py-4">Loading…</p>;
  }

  if (error || !result) {
    return (
      <p className="text-[var(--danger)] py-4">{error ?? "Failed to load simulation"}</p>
    );
  }

  const handleDownloadCsv = () => {
    if (!result.matchup_matrix_csv) return;
    const blob = new Blob([result.matchup_matrix_csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matchup_matrix_${runId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MatchupAnalyticsView
      data={result}
      onDownloadCsv={handleDownloadCsv}
      extraActions={
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Close
        </button>
      }
    />
  );
}
