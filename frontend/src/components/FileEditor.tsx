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

  const btnPrimary = "px-4 py-2 rounded bg-[var(--primary)] text-white hover:opacity-90";
  const btnAccent = "px-4 py-2 rounded bg-[var(--accent)] text-[#1a1a1a] hover:opacity-90";

  return (
    <Panel title="Pokemon Builds Editor">
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Edit GymLeaderPokemon.txt (Showdown format: <code className="bg-[var(--bg-input)] px-1 rounded">|Species</code> per build, Level, Nature, Ability, moves) or GymLeaderTeams.json (trainer → [[species, lineNo], ...]).
      </p>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>File</span>
          <select
            value={editorPath}
            onChange={(e) => setEditorPath(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded px-3 py-2 text-[var(--text)] min-w-[220px]"
          >
            {FILE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
        <button type="button" className={btnPrimary} onClick={load}>Load</button>
        <button type="button" className={btnAccent} onClick={save}>Save</button>
        <button
          type="button"
          onClick={loadExample}
          className="px-3 py-1.5 text-xs rounded border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:bg-white/5"
          title="Load from example (Trainer Tournament 1+2)"
        >
          Load example
        </button>
      </div>
      <textarea
        value={editorContent}
        onChange={(e) => setEditorContent(e.target.value)}
        placeholder="Load a file to edit..."
        className="w-full font-mono text-sm bg-[var(--bg-input)] border border-[var(--border)] rounded p-4 min-h-[200px] text-[var(--text)] placeholder:text-[var(--text-muted)]"
      />
    </Panel>
  );
}
