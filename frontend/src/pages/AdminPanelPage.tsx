import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
import { SavedSimulationDetail } from "../components/SavedSimulationDetail";
import type { UserRole } from "../context/AuthContext";

interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
}

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
  ms?: number;
}

interface AdminSimulation {
  id: string;
  user_id: string;
  user_email: string;
  type: string;
  status: string;
  created_at: string;
}

interface DatabaseStats {
  configured: boolean;
  tables: Record<string, number>;
}

interface DexTypeStatus {
  count: number;
  updated_at: string | null;
}

interface DexStatus {
  source: "database" | "file";
  types: Record<string, DexTypeStatus>;
  configured: boolean;
}

type AdminTab = "users" | "health" | "simulations" | "database" | "dex";

export function AdminPanelPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [simulations, setSimulations] = useState<AdminSimulation[]>([]);
  const [simulationsLoading, setSimulationsLoading] = useState(false);
  const [simulationsError, setSimulationsError] = useState<string | null>(null);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [dexStatus, setDexStatus] = useState<DexStatus | null>(null);
  const [dexLoading, setDexLoading] = useState(false);
  const [dexError, setDexError] = useState<string | null>(null);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string | null>(null);

  const canAccess = role === "admin" || role === "developer";

  useEffect(() => {
    if (!canAccess || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<AdminUser[]>("/admin/users")
      .then((data) => {
        if (!cancelled) setUsers(data);
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
  }, [canAccess, user]);

  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await api.get<{ checks: HealthCheck[] }>("/admin/health");
      setHealthChecks(data.checks ?? []);
    } catch (e) {
      setHealthError((e as Error).message);
      setHealthChecks([]);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "health" && canAccess) {
      runHealthCheck();
    }
  }, [activeTab, canAccess, runHealthCheck]);

  const loadSimulations = useCallback(async () => {
    setSimulationsLoading(true);
    setSimulationsError(null);
    try {
      const data = await api.get<AdminSimulation[]>("/admin/simulations");
      setSimulations(data ?? []);
    } catch (e) {
      setSimulationsError((e as Error).message);
      setSimulations([]);
    } finally {
      setSimulationsLoading(false);
    }
  }, []);

  const loadDatabaseStats = useCallback(async () => {
    setDatabaseLoading(true);
    setDatabaseError(null);
    try {
      const data = await api.get<DatabaseStats>("/admin/database-stats");
      setDatabaseStats(data);
    } catch (e) {
      setDatabaseError((e as Error).message);
      setDatabaseStats(null);
    } finally {
      setDatabaseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "simulations" && canAccess) {
      loadSimulations();
    }
  }, [activeTab, canAccess, loadSimulations]);

  useEffect(() => {
    if (activeTab === "database" && canAccess) {
      loadDatabaseStats();
    }
  }, [activeTab, canAccess, loadDatabaseStats]);

  const loadDexStatus = useCallback(async () => {
    setDexLoading(true);
    setDexError(null);
    try {
      const data = await api.get<DexStatus>("/admin/dex-status");
      setDexStatus(data ?? null);
    } catch (e) {
      setDexError((e as Error).message);
      setDexStatus(null);
    } finally {
      setDexLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "dex" && canAccess) {
      loadDexStatus();
    }
  }, [activeTab, canAccess, loadDexStatus]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId);
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <p className="text-[var(--text-muted)]">Sign in to access the admin panel.</p>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-8 text-center">
        <h2 className="text-lg font-semibold text-[var(--danger)] mb-2">Access denied</h2>
        <p className="text-[var(--text-muted)]">
          You need admin or developer role to access this panel.
        </p>
      </div>
    );
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "users", label: "User management" },
    { id: "simulations", label: "Simulations" },
    { id: "database", label: "Database" },
    { id: "dex", label: "Pokedex" },
    { id: "health", label: "API health" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-[var(--primary)]">Admin panel</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Users, simulations, database stats, API health. Your role: <span className="text-[var(--text)]">{role}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-[var(--primary)]/20 text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-input)] hover:text-[var(--text)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "users" && (
        <>
          {error && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-[var(--text-muted)] py-4">Loading users…</p>
          ) : (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-input)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr
                      key={u.id}
                      className={cn(
                        "border-t border-[var(--border)]",
                        idx % 2 === 1 && "bg-[var(--bg-input)]/30"
                      )}
                    >
                      <td className="px-4 py-3 text-[var(--text)]">{u.email || "(no email)"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            u.role === "admin" && "bg-[var(--accent)]/30 text-[var(--accent)]",
                            u.role === "developer" && "bg-[var(--primary)]/30 text-[var(--primary)]",
                            u.role === "user" && "bg-[var(--text-muted)]/30 text-[var(--text-muted)]"
                          )}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value as UserRole)
                          }
                          disabled={updating === u.id}
                          aria-label={`Change role for ${u.email}`}
                          className="px-2 py-1 rounded bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm disabled:opacity-50"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="developer">developer</option>
                        </select>
                        {updating === u.id && (
                          <span className="ml-2 text-xs text-[var(--text-muted)]">
                            Saving…
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "health" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-[var(--text-muted)]">
              Check health of backend, Supabase, Smogon, Showdown CDN, PokéAPI, and local dex data.
            </p>
            <button
              type="button"
              onClick={runHealthCheck}
              disabled={healthLoading}
              className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {healthLoading ? "Checking…" : "Run check"}
            </button>
          </div>

          {healthError && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {healthError}
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-input)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                    Integration
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                    Details
                  </th>
                  <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody>
                {healthChecks.map((c, idx) => (
                  <tr
                    key={c.name}
                    className={cn(
                      "border-t border-[var(--border)]",
                      idx % 2 === 1 && "bg-[var(--bg-input)]/30"
                    )}
                  >
                    <td className="px-4 py-3 text-[var(--text)] font-medium">{c.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          c.status === "ok" && "bg-[var(--success)]/30 text-[var(--success)]",
                          c.status === "warn" && "bg-[var(--amber)]/30 text-[var(--amber)]",
                          c.status === "error" && "bg-[var(--danger)]/30 text-[var(--danger)]"
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">{c.message}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                      {c.ms != null ? `${c.ms} ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {healthChecks.length === 0 && !healthLoading && (
              <p className="px-4 py-6 text-center text-[var(--text-muted)] text-sm">
                Click &quot;Run check&quot; to verify integrations.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "simulations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-[var(--text-muted)]">
              All saved simulations across users (matchup, trainer, pokemon).
            </p>
            <button
              type="button"
              onClick={loadSimulations}
              disabled={simulationsLoading}
              className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {simulationsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {simulationsError && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {simulationsError}
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-input)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">User</th>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Created</th>
                  <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {simulations.map((s, idx) => (
                  <React.Fragment key={s.id}>
                    <tr
                      className={cn(
                        "border-t border-[var(--border)]",
                        idx % 2 === 1 && "bg-[var(--bg-input)]/30"
                      )}
                    >
                      <td className="px-4 py-3 text-[var(--text)]">{s.user_email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--primary)]/20 text-[var(--primary)]">
                          {s.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            s.status === "completed" && "bg-[var(--success)]/30 text-[var(--success)]",
                            s.status === "running" && "bg-[var(--amber)]/30 text-[var(--amber)]",
                            (s.status === "failed" || s.status === "cancelled") &&
                              "bg-[var(--danger)]/30 text-[var(--danger)]"
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {s.created_at
                          ? new Date(s.created_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSimulationId(selectedSimulationId === s.id ? null : s.id)
                          }
                          className="px-2 py-1 rounded text-xs font-medium bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors"
                        >
                          {selectedSimulationId === s.id ? "Hide" : "View"}
                        </button>
                      </td>
                    </tr>
                    {selectedSimulationId === s.id && (
                      <tr>
                        <td colSpan={5} className="p-0 bg-[var(--bg-panel)]/50">
                          <div className="p-4 border-t border-[var(--border)]">
                            <SavedSimulationDetail
                              runId={s.id}
                              onClose={() => setSelectedSimulationId(null)}
                              admin
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {simulations.length === 0 && !simulationsLoading && (
              <p className="px-4 py-6 text-center text-[var(--text-muted)] text-sm">
                No simulations saved yet.
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === "database" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-[var(--text-muted)]">
              Row counts for Supabase tables (user_profiles, user_configs, simulation_runs, simulation_results, dex_data).
            </p>
            <button
              type="button"
              onClick={loadDatabaseStats}
              disabled={databaseLoading}
              className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {databaseLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {databaseError && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {databaseError}
            </div>
          )}

          {databaseStats && (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-input)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">Table</th>
                    <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(databaseStats.tables ?? {}).map(([table, count], idx) => (
                    <tr
                      key={table}
                      className={cn(
                        "border-t border-[var(--border)]",
                        idx % 2 === 1 && "bg-[var(--bg-input)]/30"
                      )}
                    >
                      <td className="px-4 py-3 text-[var(--text)] font-mono text-xs">{table}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                        {count >= 0 ? count.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!databaseStats.configured && (
                <p className="px-4 py-3 text-sm text-[var(--amber)]">
                  Supabase not configured. Add SUPABASE_URL and keys to .env.
                </p>
              )}
            </div>
          )}
          {!databaseStats && !databaseLoading && (
            <p className="py-6 text-center text-[var(--text-muted)] text-sm">
              Click &quot;Refresh&quot; to load database stats.
            </p>
          )}
        </div>
      )}

      {activeTab === "dex" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-sm text-[var(--text-muted)]">
              Pokedex data (species, moves, abilities, items, learnsets, natures). API uses database first, falls back to JSON files. Run <code className="px-1.5 py-0.5 rounded bg-[var(--bg-input)] text-xs">Data/UsefulDatasets/fetch_dex_data.py</code> to sync.
            </p>
            <button
              type="button"
              onClick={loadDexStatus}
              disabled={dexLoading}
              className="px-4 py-2 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] hover:bg-[var(--primary)]/30 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {dexLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {dexError && (
            <div className="p-3 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] text-sm">
              {dexError}
            </div>
          )}

          {dexStatus && (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-3 bg-[var(--bg-input)] border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text)]">
                  Source:{" "}
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium",
                      dexStatus.source === "database"
                        ? "bg-[var(--success)]/30 text-[var(--success)]"
                        : "bg-[var(--amber)]/30 text-[var(--amber)]"
                    )}
                  >
                    {dexStatus.source}
                  </span>
                  {!dexStatus.configured && (
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      (Supabase not configured)
                    </span>
                  )}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-input)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                      Data type
                    </th>
                    <th className="px-4 py-3 text-right text-[var(--text-muted)] font-medium">
                      Count
                    </th>
                    <th className="px-4 py-3 text-left text-[var(--text-muted)] font-medium">
                      Last updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dexStatus.types ?? {}).map(([type, info], idx) => (
                    <tr
                      key={type}
                      className={cn(
                        "border-t border-[var(--border)]",
                        idx % 2 === 1 && "bg-[var(--bg-input)]/30"
                      )}
                    >
                      <td className="px-4 py-3 text-[var(--text)] font-mono text-xs">
                        {type}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                        {info.count >= 0 ? info.count.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {info.updated_at
                          ? new Date(info.updated_at).toLocaleString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Object.keys(dexStatus.types ?? {}).length === 0 && (
                <p className="px-4 py-6 text-center text-[var(--text-muted)] text-sm">
                  No dex data found. Run fetch_dex_data.py first.
                </p>
              )}
            </div>
          )}
          {!dexStatus && !dexLoading && (
            <p className="py-6 text-center text-[var(--text-muted)] text-sm">
              Click &quot;Refresh&quot; to load dex status.
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
