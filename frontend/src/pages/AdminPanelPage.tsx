import { useEffect, useState } from "react";
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

export function AdminPanelPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-[var(--primary)]">Admin panel</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage user roles. Your role: <span className="text-[var(--text)]">{role}</span>
        </p>
      </div>

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
    </motion.div>
  );
}
