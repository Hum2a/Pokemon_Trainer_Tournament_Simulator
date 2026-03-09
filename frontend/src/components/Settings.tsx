import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";
import type { Config } from "../context/AppContext";

export function Settings() {
  const { appendLog, config, setConfig } = useApp();

  const t = config.trainer ?? {};
  const p = config.pokemon ?? {};
  const parse = config.parse ?? {};

  const form = {
    trainerThreads: t.noOfThreads ?? 4,
    trainerLevel: t.setLevel != null ? String(t.setLevel) : "",
    runNTimes: t.run_n_times ?? 100,
    trainerN: t.n != null ? String(t.n) : "",
    randomiseTeams: t.RandomiseTeams ?? false,
    trainerFilename: t.filename ?? "Inputs/GymLeaderPokemon.txt",
    pokemonThreads: p.noOfThreads ?? 4,
    pokemonN: p.n ?? 2000,
    outputFile: parse.output_file ?? "output.txt",
  };

  const updateConfig = (updates: Partial<Config>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const save = async () => {
    const payload: Config = {
      trainer: {
        noOfThreads: form.trainerThreads,
        setLevel: form.trainerLevel === "" ? null : parseInt(form.trainerLevel) || null,
        RandomiseTeams: form.randomiseTeams,
        n: form.trainerN === "" ? null : parseInt(form.trainerN) || null,
        run_n_times: form.runNTimes,
        filename: form.trainerFilename,
      },
      pokemon: { noOfThreads: form.pokemonThreads, n: form.pokemonN },
      parse: { output_file: form.outputFile },
    };
    setConfig(payload);
    try {
      await api.post("/config", payload);
      appendLog("Settings saved.");
    } catch (e) {
      appendLog("Failed to save: " + (e as Error).message, "error");
    }
  };

  const inputCls = "bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] w-full max-w-xs";
  const labelCls = "flex flex-col gap-1 text-sm font-medium";

  return (
    <Panel title="Settings">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        <fieldset className="space-y-3">
          <legend className="font-semibold text-[var(--text)]">Trainer Tournament</legend>
          <label className={labelCls}>
            <span>Threads</span>
            <input type="number" min={1} max={64} value={form.trainerThreads} onChange={(e) => updateConfig({ trainer: { ...t, noOfThreads: parseInt(e.target.value) || 4 } })} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span>Level Override</span>
            <input type="number" min={1} max={100} placeholder="50" value={form.trainerLevel} onChange={(e) => updateConfig({ trainer: { ...t, setLevel: e.target.value === "" ? null : (parseInt(e.target.value) || null) } })} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span>Battles per Matchup</span>
            <input type="number" min={1} value={form.runNTimes} onChange={(e) => updateConfig({ trainer: { ...t, run_n_times: parseInt(e.target.value) || 100 } })} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span>Battle Cap (test)</span>
            <input type="number" min={1} placeholder="Empty = all" value={form.trainerN} onChange={(e) => updateConfig({ trainer: { ...t, n: e.target.value === "" ? null : (parseInt(e.target.value) || null) } })} className={inputCls} />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.randomiseTeams} onChange={(e) => updateConfig({ trainer: { ...t, RandomiseTeams: e.target.checked } })} />
            <span>Randomise Teams</span>
          </label>
          <label className={labelCls}>
            <span>Pokemon File</span>
            <input type="text" value={form.trainerFilename} onChange={(e) => updateConfig({ trainer: { ...t, filename: e.target.value } })} className={inputCls} />
          </label>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-semibold text-[var(--text)]">Pokemon Tournament</legend>
          <label className={labelCls}>
            <span>Threads</span>
            <input type="number" min={1} max={64} value={form.pokemonThreads} onChange={(e) => updateConfig({ pokemon: { ...p, noOfThreads: parseInt(e.target.value) || 4 } })} className={inputCls} />
          </label>
          <label className={labelCls}>
            <span>Battle Cap</span>
            <input type="number" min={1} placeholder="2000" value={form.pokemonN} onChange={(e) => updateConfig({ pokemon: { ...p, n: parseInt(e.target.value) || 2000 } })} className={inputCls} />
          </label>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-semibold text-[var(--text)]">Parse Output</legend>
          <label className={labelCls}>
            <span>Output File</span>
            <input type="text" value={form.outputFile} onChange={(e) => updateConfig({ parse: { ...parse, output_file: e.target.value } })} className={inputCls} />
          </label>
        </fieldset>
      </div>
      <button type="button" onClick={save} className="px-4 py-2 rounded border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text)] hover:bg-white/5">
        Save Settings
      </button>
    </Panel>
  );
}
