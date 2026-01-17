import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [banDays, setBanDays] = useState({});
  const [banReason, setBanReason] = useState({});
  const [permDraft, setPermDraft] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("mods"); // "mods" | "bans"

  const isAdmin = user?.role === "admin";

  const load = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);

      const draft = {};
      res.data.forEach((u) => {
        draft[u.id] = {
          can_manage_tags: !!u.can_manage_tags,
          can_delete_posts: !!u.can_delete_posts,
          can_ban_users: !!u.can_ban_users,
        };
      });
      setPermDraft(draft);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="card">
          <h2>Admin only</h2>
        </div>
      </div>
    );
  }

  const updateRole = async (id, role) => {
    const ok = window.confirm(`Zmenit rolu na ${role}?`);
    if (!ok) return;
    await api.patch(`/admin/users/${id}/role`, { role });
    load();
  };

  const togglePerm = (userId, field) => {
    setPermDraft((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: !prev[userId]?.[field] },
    }));
  };

  const savePerms = async (userId) => {
    const ok = window.confirm("Ulozit prava moderatora?");
    if (!ok) return;

    const p = permDraft[userId] || {};
    await api.patch(`/admin/users/${userId}/permissions`, {
      can_manage_tags: !!p.can_manage_tags,
      can_delete_posts: !!p.can_delete_posts,
      can_ban_users: !!p.can_ban_users,
    });
    load();
  };

  const banUser = async (u) => {
    const ok = window.confirm(`Zabanovat ${u.username}?`);
    if (!ok) return;

    const days = Number(banDays[u.id] || 0);
    const until =
      days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;

    await api.post("/moderation/ban", {
      userId: u.id,
      reason: banReason[u.id] || "",
      bannedUntil: until,
    });

    setBanDays((prev) => ({ ...prev, [u.id]: "" }));
    setBanReason((prev) => ({ ...prev, [u.id]: "" }));
    load();
  };

  const unbanUser = async (u) => {
    const ok = window.confirm(`Odblokovat ${u.username}?`);
    if (!ok) return;

    await api.post("/moderation/unban", { userId: u.id, reason: "admin unban" });
    load();
  };

  const moderators = users.filter((u) => u.role === "moderator");
  const bannedUsers = users.filter((u) => u.is_banned);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-subtitle">Sprava moderatorov, prav a banov.</p>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button
          className={`btn-secondary ${tab === "mods" ? "btn-primary" : ""}`}
          onClick={() => setTab("mods")}
        >
          MOD
        </button>
        <button
          className={`btn-secondary ${tab === "bans" ? "btn-primary" : ""}`}
          onClick={() => setTab("bans")}
        >
          BAN
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : tab === "mods" ? (
          moderators.length === 0 ? (
            <p className="topic-meta">Ziadni moderatori.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {moderators.map((u) => (
                <div
                  key={u.id}
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: 12,
                    padding: 12,
                    background: "#0b1220",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {u.username} (id {u.id})
                      </div>
                      <div className="topic-meta">
                        {u.email} | role: {u.role} | banned: {u.is_banned ? "yes" : "no"}
                      </div>
                    </div>

                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      style={{ background: "#020617", color: "#e5e7eb" }}
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                    {["can_manage_tags", "can_delete_posts", "can_ban_users"].map((field) => (
                      <label key={field}>
                        <input
                          type="checkbox"
                          checked={!!permDraft[u.id]?.[field]}
                          onChange={() => togglePerm(u.id, field)}
                        />
                        {" "}{field}
                      </label>
                    ))}
                    <button className="btn-secondary" onClick={() => savePerms(u.id)}>
                      Ulozit prava
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : bannedUsers.length === 0 ? (
          <p className="topic-meta">Ziadni bannuti pouzivatelia.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {bannedUsers.map((u) => (
              <div
                key={u.id}
                style={{
                  border: "1px solid #1f2937",
                  borderRadius: 12,
                  padding: 12,
                  background: "#0b1220",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {u.username} (id {u.id})
                    </div>
                    <div className="topic-meta">
                      {u.email} | role: {u.role} | banned: {u.is_banned ? "yes" : "no"}
                    </div>
                  </div>

                  <select
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                    style={{ background: "#020617", color: "#e5e7eb" }}
                  >
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="number"
                    placeholder="ban days (0=perma)"
                    value={banDays[u.id] || ""}
                    onChange={(e) =>
                      setBanDays((prev) => ({ ...prev, [u.id]: e.target.value }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="reason"
                    value={banReason[u.id] || ""}
                    onChange={(e) =>
                      setBanReason((prev) => ({ ...prev, [u.id]: e.target.value }))
                    }
                  />
                  <button className="btn-secondary" onClick={() => banUser(u)}>
                    Ban
                  </button>
                  <button className="btn-secondary" onClick={() => unbanUser(u)}>
                    Unban
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
