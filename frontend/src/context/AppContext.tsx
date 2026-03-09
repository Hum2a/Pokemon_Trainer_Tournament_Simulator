import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";

type LogEntry = { text: string; type: "info" | "error" };

export interface Config {
  trainer?: {
    noOfThreads?: number;
    setLevel?: number | null;
    RandomiseTeams?: boolean;
    n?: number | null;
    run_n_times?: number;
    filename?: string;
  };
  pokemon?: { noOfThreads?: number; n?: number };
  parse?: { output_file?: string };
  matchups?: {
    noOfThreads?: number;
    setLevel?: number;
    battlesPerMatchup?: number;
    mode?: "head-to-head" | "matrix";
    poolFilter?: "all" | "type" | "region" | "evolution" | "ability" | "move" | "role" | "bst" | "typeCount" | "tags" | "eggGroup" | "color" | "generation" | "weight" | "height" | "canMega";
    poolType?: string;
    poolRegion?: string;
    poolEvolutionStage?: string;
    poolAbility?: string;
    poolMove?: string;
    poolRole?: string;
    poolBst?: string;
    poolTypeCount?: string;
    poolTags?: string;
    poolEggGroup?: string;
    poolColor?: string;
    poolGeneration?: string;
    poolWeight?: string;
    poolHeight?: string;
    poolCanMega?: string;
    poolLimit?: number;
    pokemon1?: string;
    pokemon2?: string;
  };
}

interface AppState {
  logEntries: LogEntry[];
  status: { running: boolean; text: string };
  editorContent: string;
  editorPath: string;
  config: Config;
}

interface AppContextValue extends AppState {
  appendLog: (text: string, type?: "info" | "error") => void;
  clearLog: () => void;
  setStatus: (running: boolean, text: string) => void;
  setEditorContent: (content: string | ((prev: string) => string)) => void;
  setEditorPath: (path: string) => void;
  setConfig: (c: Config | ((prev: Config) => Config)) => void;
  saveConfig: () => Promise<void>;
  refreshOutputsTrigger: number;
  triggerOutputsRefresh: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [status, setStatusState] = useState({ running: false, text: "Ready" });
  const [editorContent, setEditorContentState] = useState("");
  const [editorPath, setEditorPathState] = useState("Inputs/GymLeaderPokemon.txt");
  const [config, setConfigState] = useState<Config>({});
  const [refreshOutputsTrigger, setRefreshOutputsTrigger] = useState(0);

  useEffect(() => {
    api.get<Config>("/config").then(setConfigState).catch(() => {});
  }, []);

  const appendLog = useCallback((text: string, type: "info" | "error" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogEntries((prev) => [...prev, { text: `[${time}] ${text}`, type }]);
  }, []);

  const clearLog = useCallback(() => setLogEntries([]), []);

  const setStatus = useCallback((running: boolean, text: string) => {
    setStatusState({ running, text });
  }, []);

  const setEditorContent = useCallback((content: string | ((prev: string) => string)) => {
    setEditorContentState((prev) => (typeof content === "function" ? content(prev) : content));
  }, []);

  const setEditorPath = useCallback((path: string) => {
    setEditorPathState(path);
  }, []);

  const setConfig = useCallback((c: Config | ((prev: Config) => Config)) => {
    setConfigState((prev) => (typeof c === "function" ? c(prev) : c));
  }, []);

  const saveConfig = useCallback(async () => {
    try {
      await api.post("/config", config);
    } catch {
      /* ignore */
    }
  }, [config]);

  const triggerOutputsRefresh = useCallback(() => setRefreshOutputsTrigger((n) => n + 1), []);

  return (
    <AppContext.Provider
      value={{ logEntries, status, editorContent, editorPath, config, refreshOutputsTrigger, appendLog, clearLog, setStatus, setEditorContent, setEditorPath, setConfig, saveConfig, triggerOutputsRefresh }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
