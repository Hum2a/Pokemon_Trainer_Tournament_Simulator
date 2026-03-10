import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";
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

type AdminTab = "users" | "health";

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
          Manage user roles, check API health. Your role: <span className="text-[var(--text)]">{role}</span>
        </p>
      </div>

      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
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
    </motion.div>
  );
}
