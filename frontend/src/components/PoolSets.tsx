import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api";
import type { CustomSet } from "../context/AppContext";

export type SmogonSetData = {
  moves?: unknown[];
  ability?: string;
  item?: string | string[] | undefined;
  nature?: string | string[] | undefined;
  evs?: Record<string, number>;
};
export type SmogonSets = Record<string, Record<string, SmogonSetData>>;

function flattenMoves(moves: unknown[] | undefined): string[] {
  if (!moves || !Array.isArray(moves)) return [];
  return moves.slice(0, 4).map((m) => (Array.isArray(m) ? (m[0] as string) : (m as string)));
}

function formatEvs(evs: Record<string, number> | undefined): string {
  if (!evs || typeof evs !== "object") return "";
  const parts = Object.entries(evs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${k.toUpperCase()}`)
    .sort();
  return parts.join(" / ");
}

const EV_STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

function SetEditorModal({
  isOpen,
  onClose,
  pokemonName,
  initialSet,
  customSet,
  onSave,
  moves,
  abilities,
  items,
  natures,
}: {
  isOpen: boolean;
  onClose: () => void;
  pokemonName: string;
  initialSet: { setName: string; set: SmogonSetData } | null;
  customSet: CustomSet | undefined;
  onSave: (set: CustomSet | null) => void;
  moves: { id: string; name: string }[];
  abilities: { id: string; name: string }[];
  items: { id: string; name: string }[];
  natures: string[];
}) {
  const [movesSel, setMovesSel] = useState<string[]>(["", "", "", ""]);
  const [ability, setAbility] = useState("");
  const [item, setItem] = useState("");
  const [nature, setNature] = useState("Hardy");
  const [evs, setEvs] = useState<Record<string, number>>({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

  useEffect(() => {
    if (!isOpen) return;
    const base = customSet ?? (initialSet ? {
      moves: flattenMoves(initialSet.set.moves),
      ability: Array.isArray(initialSet.set.ability) ? initialSet.set.ability[0] : initialSet.set.ability,
      item: Array.isArray(initialSet.set.item) ? initialSet.set.item[0] : initialSet.set.item,
      nature: Array.isArray(initialSet.set.nature) ? initialSet.set.nature[0] : initialSet.set.nature,
      evs: initialSet.set.evs,
    } : null);
    if (base) {
      setMovesSel([...(base.moves ?? []), "", "", ""].slice(0, 4));
      setAbility(base.ability ?? "");
      setItem(base.item ?? "");
      setNature(base.nature ?? "Hardy");
      setEvs(base.evs ? { ...base.evs } : { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    } else {
      setMovesSel(["", "", "", ""]);
      setAbility("");
      setItem("");
      setNature("Hardy");
      setEvs({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    }
  }, [isOpen, customSet, initialSet]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [isOpen, onClose]);

  const handleSave = () => {
    const m = movesSel.filter(Boolean);
    if (m.length === 0) return;
    onSave({
      moves: [...m, "Struggle", "Struggle", "Struggle"].slice(0, 4),
      ability: ability || undefined,
      item: item || undefined,
      nature: nature || undefined,
      evs: Object.fromEntries(EV_STATS.map((s) => [s, evs[s] ?? 0]).filter(([, v]) => Number(v) > 0)) || undefined,
    });
    onClose();
  };

  const handleClear = () => {
    onSave(null);
    onClose();
  };

  if (!isOpen) return null;

  const moveOptions = moves.map((m) => m.name);
  const modalContent = (
    <div
      className="flex items-center justify-center p-4"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2147483647,
        overflow: "auto",
      }}
    >
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col shrink-0"
        style={{ margin: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-display font-semibold text-[var(--primary)]">Edit set: {pokemonName}</h3>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Moves</label>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <select
                  key={i}
                  value={movesSel[i] ?? ""}
                  onChange={(e) => {
                    const next = [...movesSel];
                    next[i] = e.target.value;
                    setMovesSel(next);
                  }}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
                >
                  <option value="">—</option>
                  {moveOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1" id="set-ability">Ability</label>
            <select
              aria-labelledby="set-ability"
              value={ability}
              onChange={(e) => setAbility(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
            >
              <option value="">—</option>
              {abilities.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Item</label>
            <select
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
            >
              <option value="">—</option>
              {items.map((i) => (
                <option key={i.id} value={i.name}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1" id="set-nature">Nature</label>
            <select
              aria-labelledby="set-nature"
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
            >
              {natures.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">EVs</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {EV_STATS.map((stat) => (
                <div key={stat}>
                  <label className="text-[10px] text-[var(--text-muted)] uppercase">{stat === "spa" ? "SpA" : stat === "spd" ? "SpD" : stat}</label>
                  <input
                    type="number"
                    min={0}
                    max={252}
                    aria-label={`EV ${stat}`}
                    value={evs[stat] ?? 0}
                    onChange={(e) => setEvs((prev) => ({ ...prev, [stat]: Math.min(252, Math.max(0, parseInt(String(e.target.value), 10) || 0)) }))}
                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-[var(--border)] flex justify-between gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-red-400 border border-[var(--border)] hover:border-red-400/50 transition-colors"
          >
            Remove custom
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text)] hover:bg-[var(--primary)]/10">
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/50 hover:bg-[var(--primary)]/30">
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function getSetMoves(display: CustomSet | SmogonSetData | null): string[] {
  if (!display) return [];
  if ("moves" in display && Array.isArray(display.moves)) return (display.moves as string[]).filter(Boolean);
  return flattenMoves((display as SmogonSetData).moves);
}
function getSetAbility(display: CustomSet | SmogonSetData | null): string {
  if (!display) return "";
  const a = (display as CustomSet).ability ?? (display as SmogonSetData).ability;
  return Array.isArray(a) ? a[0] : a ?? "";
}
function getSetItem(display: CustomSet | SmogonSetData | null): string {
  if (!display) return "";
  const i = (display as CustomSet).item ?? (display as SmogonSetData).item;
  return Array.isArray(i) ? i[0] : i ?? "";
}
function getSetNature(display: CustomSet | SmogonSetData | null): string {
  if (!display) return "";
  const n = (display as CustomSet).nature ?? (display as SmogonSetData).nature;
  return Array.isArray(n) ? n[0] : n ?? "";
}

function PokemonSetCard({
  name,
  info,
  customSet,
  isExpanded,
  onToggle,
  onEdit,
  editable,
}: {
  name: string;
  info: { setName: string; set: SmogonSetData } | null;
  customSet?: CustomSet;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  editable?: boolean;
}) {
  const display = customSet ?? (info ? info.set : null);
  const label = customSet ? "Custom" : (info ? info.setName : "Default");

  return (
    <div className="rounded-xl border border-[var(--border)]/50 bg-[var(--bg-input)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-[var(--primary)]/5 transition-colors"
      >
        <div className="min-w-0">
          <div className="font-semibold text-[var(--text)] truncate">{name}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {display ? (
              <>
                <span className={customSet ? "text-amber-400" : "text-[var(--primary)]"}>{label}</span>
                {(getSetAbility(display) || getSetItem(display)) && (
                  <> · {getSetAbility(display) || "—"} · {getSetItem(display) || "—"}</>
                )}
              </>
            ) : (
              <span className="italic">Default (no Smogon set)</span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {editable && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
              className="px-2 py-1 rounded text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/20 border border-[var(--primary)]/50"
            >
              Edit
            </button>
          )}
          <span className="text-[var(--primary)] text-sm">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[var(--border)]/30 bg-[var(--bg-panel)]/50">
          {display ? (
            <div className="text-sm space-y-2">
              {getSetMoves(display).length > 0 && (
                <div>
                  <span className="text-[var(--text-muted)]">Moves: </span>
                  <span className="text-[var(--text)]">{getSetMoves(display).join(", ")}</span>
                </div>
              )}
              {getSetNature(display) && (
                <div>
                  <span className="text-[var(--text-muted)]">Nature: </span>
                  <span className="text-[var(--text)]">{getSetNature(display)}</span>
                </div>
              )}
              {((display as CustomSet).evs ?? (display as SmogonSetData).evs) && Object.keys((display as CustomSet).evs ?? (display as SmogonSetData).evs ?? {}).length > 0 && (
                <div>
                  <span className="text-[var(--text-muted)]">EVs: </span>
                  <span className="text-[var(--text)]">{formatEvs((display as CustomSet).evs ?? (display as SmogonSetData).evs)}</span>
                </div>
              )}
              {getSetAbility(display) && (
                <div>
                  <span className="text-[var(--text-muted)]">Ability: </span>
                  <span className="text-[var(--text)]">{getSetAbility(display)}</span>
                </div>
              )}
              {getSetItem(display) && (
                <div>
                  <span className="text-[var(--text-muted)]">Item: </span>
                  <span className="text-[var(--text)]">{getSetItem(display)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">
              Default learnset-based set used. No Smogon set available for this format. Use Edit to add a custom set.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function groupFormatsByGen(formats: string[]): { gen: string; formats: string[] }[] {
  const byGen: Record<string, string[]> = {};
  for (const f of formats) {
    const m = f.match(/^gen(\d+)/);
    const gen = m ? `Gen ${m[1]}` : "Other";
    if (!byGen[gen]) byGen[gen] = [];
    byGen[gen].push(f);
  }
  const order = ["Gen 1", "Gen 2", "Gen 3", "Gen 4", "Gen 5", "Gen 6", "Gen 7", "Gen 8", "Gen 9", "Other"];
  return order.filter((g) => byGen[g]).map((gen) => ({ gen, formats: byGen[gen].sort() }));
}

export interface PoolSetsProps {
  pokemon: string[];
  format: string;
  onFormatChange?: (format: string) => void;
  customSets?: Record<string, CustomSet>;
  onCustomSetChange?: (species: string, set: CustomSet | null) => void;
  refreshTrigger?: number;
  editable?: boolean;
}

export function PoolSets({
  pokemon,
  format,
  onFormatChange,
  customSets = {},
  onCustomSetChange,
  refreshTrigger,
  editable = false,
}: PoolSetsProps) {
  const [smogonSets, setSmogonSets] = useState<SmogonSets | null>(null);
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [formats, setFormats] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingPokemon, setEditingPokemon] = useState<string | null>(null);
  const [dexData, setDexData] = useState<{
    moves: { id: string; name: string }[];
    abilities: { id: string; name: string }[];
    items: { id: string; name: string }[];
    natures: string[];
  } | null>(null);

  useEffect(() => {
    api.get<string[]>("/smogon/formats").then(setFormats).catch(() => setFormats([]));
  }, []);

  useEffect(() => {
    if (editable && editingPokemon) {
      Promise.all([
        api.get<{ id: string; name: string }[]>("/dex/moves"),
        api.get<{ id: string; name: string }[]>("/dex/abilities"),
        api.get<{ id: string; name: string }[]>("/dex/items"),
        api.get<string[] | { name: string }[]>("/dex/natures"),
      ])
        .then(([moves, abilities, items, natures]) => {
          const n = Array.isArray(natures)
            ? natures.map((x) => (typeof x === "string" ? x : (x as { name: string }).name))
            : ["Hardy", "Adamant", "Modest", "Jolly", "Timid", "Bold", "Impish", "Calm", "Careful"];
          setDexData({
            moves: moves ?? [],
            abilities: abilities ?? [],
            items: items ?? [],
            natures: n,
          });
        })
        .catch(() => setDexData(null));
    }
  }, [editable, editingPokemon]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingSets(true);
    api
      .get<SmogonSets>(`/smogon/sets/${format}`)
      .then((s) => {
        if (!cancelled) {
          setSmogonSets(s);
          setIsLoadingSets(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSmogonSets(null);
          setIsLoadingSets(false);
        }
      });
    return () => { cancelled = true; };
  }, [format, refreshTrigger ?? 0]);

  const getSetForPokemon = (name: string): { setName: string; set: SmogonSetData } | null => {
    if (!smogonSets) return null;
    const normalized = name.replace(/[\s-]/g, "");
    for (const [species, sets] of Object.entries(smogonSets)) {
      const speciesNorm = species.replace(/[\s-]/g, "");
      if (speciesNorm === normalized || speciesNorm.toLowerCase() === normalized.toLowerCase()) {
        const setNames = Object.keys(sets);
        if (setNames.length === 0) return null;
        return { setName: setNames[0], set: sets[setNames[0]] ?? {} };
      }
    }
    return null;
  };

  const toggleExpanded = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const allFormats = formats.length ? formats : [format];
  const groupedFormats = groupFormatsByGen(allFormats);
  const formatInList = format === "newest" || formats.includes(format);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--text-muted)]">Smogon format:</span>
        <select
          value={format}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onFormatChange?.(v);
          }}
          aria-label="Smogon format"
          className="px-2 py-1 rounded bg-[var(--bg-panel)] border border-[var(--border)] text-[var(--text)] text-sm min-w-[140px]"
        >
          <option value="newest">Newest (most recent set per Pokemon)</option>
          {!formatInList && format !== "newest" && <option value={format}>{format}</option>}
          {groupedFormats.map(({ gen, formats: fs }) => (
            <optgroup key={gen} label={gen}>
              {fs.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {isLoadingSets && (
          <span
            className="inline-block w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"
            aria-hidden
          />
        )}
      </div>
      <div className="text-xs text-[var(--text-muted)] mb-2">
        {pokemon.length} Pokemon in pool.{" "}
        {isLoadingSets ? (
          <span className="text-[var(--primary)]">Loading sets for {format}…</span>
        ) : smogonSets ? (
          "Smogon sets loaded."
        ) : (
          "Failed to load sets."
        )}{" "}
        Click a card to expand. {editable && "Use Edit to customize a set."}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[28rem] overflow-y-auto pr-1">
        {pokemon.map((p) => (
          <PokemonSetCard
            key={p}
            name={p}
            info={getSetForPokemon(p)}
            customSet={customSets[p]}
            isExpanded={expanded.has(p)}
            onToggle={() => toggleExpanded(p)}
            onEdit={editable ? () => setEditingPokemon(p) : undefined}
            editable={editable}
          />
        ))}
      </div>

      <AnimatePresence>
        {editingPokemon && dexData && (
          <SetEditorModal
            isOpen={!!editingPokemon}
            onClose={() => setEditingPokemon(null)}
            pokemonName={editingPokemon}
            initialSet={getSetForPokemon(editingPokemon)}
            customSet={customSets[editingPokemon]}
            onSave={(set) => {
              onCustomSetChange?.(editingPokemon, set ?? null);
              setEditingPokemon(null);
            }}
            moves={dexData.moves}
            abilities={dexData.abilities}
            items={dexData.items}
            natures={dexData.natures}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
