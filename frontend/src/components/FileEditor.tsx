import { motion } from "framer-motion";
import { Panel } from "./Panel";
import { useApp } from "../context/AppContext";
import { api } from "../api";

const FILE_OPTIONS = [
  "Inputs/GymLeaderPokemon.txt",
  "Inputs/GymLeaderTeams.json",
];

export function FileEditor() {
  const { appendLog, editorContent, editorPath, setEditorContent, setEditorPath } = useApp();

  const load = async () => {
    try {
      const data = await api.post<{ content: string }>("/files/read", { path: editorPath });
      setEditorContent(data.content);
      appendLog(`Loaded ${editorPath}`);
    } catch (e) {
      appendLog("Load failed: " + (e as Error).message, "error");
    }
  };

  const save = async () => {
    try {
      await api.post("/files/write", { path: editorPath, content: editorContent });
      appendLog(`Saved ${editorPath}`);
    } catch (e) {
      appendLog("Save failed: " + (e as Error).message, "error");
    }
  };

  const loadExample = async () => {
    const examplePath = "Inputs/Videos/Trainer Tournament 1+2/GymLeaderPokemon.txt";
    try {
      const data = await api.post<{ content: string }>("/files/read", { path: examplePath });
      setEditorContent(data.content);
      setEditorPath("Inputs/GymLeaderPokemon.txt");
      appendLog("Loaded example. Save to overwrite your file.");
    } catch (e) {
      appendLog("Example not found: " + (e as Error).message, "error");
    }
  };

  return (
    <Panel title="Pokemon Builds Editor">
      <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
        Edit GymLeaderPokemon.txt (Showdown format: <code className="bg-[var(--bg-input)] px-2 py-0.5 rounded border border-[var(--border)] font-mono text-[var(--primary)]">|Species</code> per build, Level, Nature, Ability, moves) or GymLeaderTeams.json (trainer → [[species, lineNo], ...]).
      </p>
      <div className="flex flex-wrap gap-3 mb-5 items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          <span>File</span>
          <select
            value={editorPath}
            onChange={(e) => setEditorPath(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text)] min-w-[220px] transition-all focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
          >
            {FILE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <motion.button type="button" className="px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[#050508] font-medium hover:shadow-[0_0_20px_var(--primary-glow)] transition-all" onClick={load} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          Load
        </motion.button>
        <motion.button type="button" className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white font-medium hover:shadow-[0_0_20px_var(--accent-glow)] transition-all" onClick={save} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          Save
        </motion.button>
        <motion.button
          type="button"
          onClick={loadExample}
          className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)] hover:border-[var(--text-muted)]/40 transition-all"
          title="Load from example (Trainer Tournament 1+2)"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Load example
        </motion.button>
      </div>
      <textarea
        value={editorContent}
        onChange={(e) => setEditorContent(e.target.value)}
        placeholder="Load a file to edit..."
        className="w-full font-mono text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded-xl p-4 min-h-[220px] text-[var(--text)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:ring-opacity-50 transition-all resize-y focus:shadow-[0_0_0_1px_rgba(0,245,255,0.3)]"
      />
    </Panel>
  );
}
