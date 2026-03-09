import { useRef, useEffect } from "react";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";

export function Actions() {
  const { appendLog, setStatus, saveConfig, triggerOutputsRefresh } = useApp();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const callAction = async (endpoint: string, label: string) => {
    await saveConfig();
    setStatus(true, label + "...");
    appendLog(`Starting: ${label}`);
    try {
      const data = await api.post<{ output?: string }>(`/${endpoint}`);
      if (data.output) appendLog(data.output);
      appendLog(`${label} completed.`);
      triggerOutputsRefresh();
    } catch (e) {
      appendLog(`${label} failed: ${(e as Error).message}`, "error");
    }
    setStatus(false, "Ready");
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.get<{ running?: boolean; output?: string }>("/status");
        if (!data.running) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setStatus(false, "Ready");
          appendLog("Task finished.");
          triggerOutputsRefresh();
        }
      } catch {
        /* ignore */
      }
    }, 1000);
  };

  const runTrainer = async () => {
    await saveConfig();
    setStatus(true, "Running trainer simulations...");
    appendLog("Starting trainer simulations (this may take a while).");
    try {
      await api.post("/run-trainer");
      startPolling();
    } catch (e) {
      appendLog("Error: " + (e as Error).message, "error");
      setStatus(false, "Ready");
    }
  };

  const runPokemon = async () => {
    await saveConfig();
    setStatus(true, "Running Pokemon simulations...");
    appendLog("Starting Pokemon simulations (this may take a while).");
    try {
      await api.post("/run-pokemon");
      startPolling();
    } catch (e) {
      appendLog("Error: " + (e as Error).message, "error");
      setStatus(false, "Ready");
    }
  };

  const btnPrimary = "px-4 py-2 rounded bg-[var(--primary)] text-white hover:opacity-90";
  const btnAccent = "px-4 py-2 rounded bg-[var(--accent)] text-[#1a1a1a] hover:opacity-90";

  return (
    <Panel title="Actions">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Build Phase</h3>
          <div className="flex flex-col gap-2">
            <button type="button" className={btnPrimary} onClick={() => callAction("build-trainer", "Build Trainer Battles")}>
              Build Trainer Battles
            </button>
            <button type="button" className={btnPrimary} onClick={() => callAction("build-pokemon", "Build Pokemon vs Leaders")}>
              Build Pokemon vs Leaders
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Run Phase</h3>
          <div className="flex flex-col gap-2">
            <button type="button" className={btnAccent} onClick={runTrainer}>
              Run Trainer Simulations
            </button>
            <button type="button" className={btnAccent} onClick={runPokemon}>
              Run Pokemon Simulations
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Parse Phase</h3>
          <div className="flex flex-col gap-2">
            <button type="button" className={btnPrimary} onClick={() => callAction("parse-png", "Parse to PNG")}>
              Parse to PNG Matrix
            </button>
            <button type="button" className={btnPrimary} onClick={() => callAction("parse-csv", "Parse to CSV")}>
              Parse to CSV
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
