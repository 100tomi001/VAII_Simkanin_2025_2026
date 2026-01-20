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
  const [unbanTarget, setUnbanTarget] = useState(null);
  const PERMS = [
    { key: "can_manage_tags", label: "Tagy" },
    { key: "can_delete_posts", label: "Mazanie" },
    { key: "can_ban_users", label: "Bany" },
    { key: "can_edit_wiki", label: "Wiki" },
    { key: "can_manage_reactions", label: "Reakcie" },
  ];

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
          can_edit_wiki: !!u.can_edit_wiki,
          can_manage_reactions: !!u.can_manage_reactions,
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
    const p = permDraft[userId] || {};
    await api.patch(`/admin/users/${userId}/permissions`, {
      can_manage_tags: !!p.can_manage_tags,
      can_delete_posts: !!p.can_delete_posts,
      can_ban_users: !!p.can_ban_users,
      can_edit_wiki: !!p.can_edit_wiki,
      can_manage_reactions: !!p.can_manage_reactions,
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

  const unbanUser = (u) => {
    setUnbanTarget(u);
  };

  const confirmUnban = async () => {
    if (!unbanTarget) return;
    try {
      await api.post("/moderation/unban", {
        userId: unbanTarget.id,
        reason: "admin unban",
      });
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setUnbanTarget(null);
    }
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
            <div style={{ overflowX: "auto" }}>
              <table className="mod-table">
                <thead>
                  <tr>
                    <th>Moderator</th>
                    {PERMS.map((p) => (
                      <th key={p.key}>{p.label}</th>
                    ))}
                    <th>Akcie</th>
                  </tr>
                </thead>
                <tbody>
                  {moderators.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.username}</div>
                        <div className="topic-meta">
                          {u.email} | id {u.id}
                        </div>
                      </td>
                      {PERMS.map((p) => (
                        <td key={p.key}>
                          <input
                            type="checkbox"
                            checked={!!permDraft[u.id]?.[p.key]}
                            onChange={() => togglePerm(u.id, p.key)}
                          />
                        </td>
                      ))}
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button className="btn-secondary" onClick={() => savePerms(u.id)}>
                            Ulozit
                          </button>
                          <select
                            value={u.role}
                            onChange={(e) => updateRole(u.id, e.target.value)}
                            style={{ background: "var(--input-bg)", color: "var(--text)" }}
                          >
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  border: "1px solid var(--card-border)",
                  borderRadius: 12,
                  padding: 12,
                  background: "var(--topic-bg)",
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
                    style={{ background: "var(--input-bg)", color: "var(--text)" }}
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

      {unbanTarget && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--chip-bg)",
              padding: "24px",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "380px",
              textAlign: "center",
              border: "1px solid #374151",
            }}
          >
            <h2 style={{ marginBottom: 12 }}>Odblokovat uzivatela?</h2>
            <p style={{ marginBottom: 24 }}>
              {unbanTarget.username} (id {unbanTarget.id})
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setUnbanTarget(null)} className="btn-secondary">
                Zrusit
              </button>

              <button
                onClick={confirmUnban}
                className="btn-primary"
                style={{ background: "#10b981", borderColor: "#10b981" }}
              >
                Unban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
