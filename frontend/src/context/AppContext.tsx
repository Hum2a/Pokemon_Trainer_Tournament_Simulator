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
    poolEvolutionStages?: string[];
    poolTypes?: string[];
    poolCategory?: "all" | "legendary" | "regular";
    poolCanMega?: "all" | "yes" | "no";
    poolRegions?: string[];
    poolBst?: string;
    poolRoles?: string[];
    poolTypeCount?: string;
    poolAbility?: string;
    poolMove?: string;
    poolTags?: string[];
    poolEggGroups?: string[];
    poolColors?: string[];
    poolGenerations?: string[];
    poolWeight?: string;
    poolHeight?: string;
    poolLimit?: number;
    useSmogonSets?: boolean;
    smogonFormat?: string;
    customSets?: Record<string, CustomSet>;
    pokemon1?: string;
    pokemon2?: string;
  };
}

export interface CustomSet {
  moves?: string[];
  ability?: string;
  item?: string;
  nature?: string;
  evs?: Record<string, number>;
}

export interface ModalState {
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "default";
  alertOnly?: boolean;
}

interface AppState {
  logEntries: LogEntry[];
  status: { running: boolean; text: string };
  taskStartTime: number | null;
  taskEndTime: number | null;
  editorContent: string;
  editorPath: string;
  config: Config;
  modal: ModalState | null;
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
  showModal: (state: ModalState) => void;
  hideModal: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [status, setStatusState] = useState({ running: false, text: "Ready" });
  const [taskStartTime, setTaskStartTime] = useState<number | null>(null);
  const [taskEndTime, setTaskEndTime] = useState<number | null>(null);
  const [editorContent, setEditorContentState] = useState("");
  const [editorPath, setEditorPathState] = useState("Inputs/GymLeaderPokemon.txt");
  const [config, setConfigState] = useState<Config>({});
  const [refreshOutputsTrigger, setRefreshOutputsTrigger] = useState(0);
  const [modal, setModal] = useState<ModalState | null>(null);

  const showModal = useCallback((state: ModalState) => setModal(state), []);
  const hideModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    api.get<Config>("/config").then(setConfigState).catch(() => {});
  }, []);

  const appendLog = useCallback((text: string, type: "info" | "error" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogEntries((prev) => [...prev, { text: `[${time}] ${text}`, type }]);
  }, []);

  const clearLog = useCallback(() => {
    setLogEntries([]);
    setTaskStartTime(null);
    setTaskEndTime(null);
  }, []);

  const setStatus = useCallback((running: boolean, text: string) => {
    setStatusState({ running, text });
    if (running) {
      setTaskStartTime(Date.now());
      setTaskEndTime(null);
    } else {
      setTaskEndTime(Date.now());
    }
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
      value={{ logEntries, status, taskStartTime, taskEndTime, editorContent, editorPath, config, modal, refreshOutputsTrigger, appendLog, clearLog, setStatus, setEditorContent, setEditorPath, setConfig, saveConfig, triggerOutputsRefresh, showModal, hideModal }}
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
