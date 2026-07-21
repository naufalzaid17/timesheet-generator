"use client";

import { useEffect, useState, useCallback } from "react";
import {
  UserPlus,
  Loader2,
  Check,
  X,
  Trash2,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { User, Role, ProfileChangeRequest } from "@/lib/types";

// Admin console for provisioning accounts (the ONLY registration path) and
// reviewing self-service profile change requests.
export default function UsersPage() {
  const { notify } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [changes, setChanges] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const emptyForm = {
    username: "",
    email: "",
    role: "user" as Role,
    name: "",
    mii_id: "",
    division: "",
    site: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        api<User[]>("/api/admin/users"),
        api<ProfileChangeRequest[]>("/api/admin/profile-changes?status=pending"),
      ]);
      setUsers(u);
      setChanges(c || []);
    } catch (err: any) {
      notify(err.message || "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      notify("User created — a setup email has been sent.", "success");
      setForm(emptyForm);
      load();
    } catch (err: any) {
      notify(err.message || "Create failed", "error");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await api(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      load();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const removeUser = async (u: User) => {
    if (!confirm(`Delete ${u.username}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
      notify("User deleted", "success");
      load();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const review = async (c: ProfileChangeRequest, action: "approve" | "reject") => {
    try {
      await api(`/api/admin/profile-changes/${c.id}/review?action=${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      notify(`Request ${action}d`, "success");
      load();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold">Users</h1>
        <p className="text-sm text-saweria-slate">
          Provision accounts and approve profile changes.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Create user */}
        <div className="card h-fit p-6 lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-saweria-yellow">
              <UserPlus size={18} />
            </div>
            <h2 className="text-lg font-bold">New account</h2>
          </div>
          <form onSubmit={createUser} className="flex flex-col gap-3">
            <input
              className="input"
              placeholder="Username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="MII ID"
                value={form.mii_id}
                onChange={(e) => setForm({ ...form, mii_id: e.target.value })}
              />
              <input
                className="input"
                placeholder="Site"
                value={form.site}
                onChange={(e) => setForm({ ...form, site: e.target.value })}
              />
            </div>
            <input
              className="input"
              placeholder="Division"
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
            />
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn-primary w-full" disabled={creating}>
              {creating ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
              Create & send setup link
            </button>
          </form>
        </div>

        {/* Pending profile changes + user list */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {changes.length > 0 && (
            <div className="card p-6">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList size={18} className="text-saweria-purple" />
                <h2 className="text-lg font-bold">Pending profile changes</h2>
                <span className="chip bg-saweria-yellow text-saweria-ink">{changes.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {changes.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4"
                  >
                    <div className="text-sm">
                      <p className="font-semibold">{c.user?.username || `User #${c.user_id}`}</p>
                      <p className="text-saweria-slate">
                        {[c.name, c.mii_id, c.division, c.site].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => review(c, "approve")}
                        className="btn bg-saweria-mint/15 text-saweria-mint hover:bg-saweria-mint/25"
                      >
                        <Check size={16} /> Approve
                      </button>
                      <button
                        onClick={() => review(c, "reject")}
                        className="btn bg-saweria-coral/15 text-saweria-coral hover:bg-saweria-coral/25"
                      >
                        <X size={16} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-6">
            <h2 className="mb-4 text-lg font-bold">All users</h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-saweria-purple" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-saweria-slate">
                      <th className="pb-2">User</th>
                      <th className="pb-2">Role</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-t border-slate-100">
                        <td className="py-3">
                          <p className="font-semibold">{u.name || u.username}</p>
                          <p className="text-xs text-saweria-slate">{u.email}</p>
                        </td>
                        <td className="py-3">
                          <span
                            className={`chip ${
                              u.role === "admin"
                                ? "bg-saweria-purple/10 text-saweria-purple"
                                : "bg-slate-100 text-saweria-slate"
                            }`}
                          >
                            {u.role === "admin" && <ShieldCheck size={12} />}
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => toggleActive(u)}
                            className={`chip ${
                              u.is_active
                                ? "bg-saweria-mint/15 text-saweria-mint"
                                : "bg-saweria-coral/15 text-saweria-coral"
                            }`}
                          >
                            {u.is_active ? "Active" : "Disabled"}
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => removeUser(u)}
                            className="rounded-xl p-2 text-saweria-slate hover:bg-saweria-coral/10 hover:text-saweria-coral"
                            title="Delete user"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
