import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
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

  const btnBase = "px-5 py-3 rounded-xl font-medium transition-all duration-300";
  const btnPrimary = `${btnBase} bg-[var(--primary)] text-[#050508] hover:shadow-[0_0_24px_var(--primary-glow)]`;
  const btnAccent = `${btnBase} bg-[var(--accent)] text-white hover:shadow-[0_0_24px_var(--accent-glow)]`;

  const actionGroups = [
    {
      title: "Build Phase",
      items: [
        { label: "Build Trainer Battles", onClick: () => callAction("build-trainer", "Build Trainer Battles"), accent: false },
        { label: "Build Pokemon vs Leaders", onClick: () => callAction("build-pokemon", "Build Pokemon vs Leaders"), accent: false },
      ],
    },
    {
      title: "Run Phase",
      items: [
        { label: "Run Trainer Simulations", onClick: runTrainer, accent: true },
        { label: "Run Pokemon Simulations", onClick: runPokemon, accent: true },
      ],
    },
    {
      title: "Parse Phase",
      items: [
        { label: "Parse to PNG Matrix", onClick: () => callAction("parse-png", "Parse to PNG Matrix"), accent: false },
        { label: "Parse to CSV", onClick: () => callAction("parse-csv", "Parse to CSV"), accent: false },
      ],
    },
  ];

  return (
    <Panel title="Actions">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {actionGroups.map((group, gi) => (
          <motion.div
            key={group.title}
            className="space-y-3 p-4 rounded-xl bg-black/20 border border-[var(--border)]/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.05 }}
            whileHover={{ borderColor: "rgba(0,245,255,0.2)" }}
          >
            <h3 className="font-display font-semibold text-sm text-[var(--primary)]">{group.title}</h3>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <motion.button
                  key={item.label}
                  type="button"
                  className={item.accent ? btnAccent : btnPrimary}
                  onClick={item.onClick}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {item.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </Panel>
  );
}
