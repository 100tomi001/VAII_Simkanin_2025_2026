import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function ProfileView() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = !id || id === String(user?.id);
  const isAdmin = user?.role === "admin";
  const canMakeModerator = isAdmin && !isOwnProfile && profile?.role !== "moderator";
  const canRemoveModerator = isAdmin && !isOwnProfile && profile?.role === "moderator";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/profile/${id || "me"}`);
        setProfile(res.data);
        const b = await api.get("/badges");
        setBadges(b.data.filter((bg) => res.data.badge_ids?.includes(bg.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const makeModerator = async () => {
    if (!profile) return;
    const ok = window.confirm(`Chceš zmeniť ${profile.username} na moderátora?`);
    if (!ok) return;

    try {
      await api.patch(`/admin/users/${profile.id}/role`, { role: "moderator" });
      const res = await api.get(`/profile/${id || "me"}`);
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const removeModerator = async () => {
    if (!profile) return;
    const ok = window.confirm(`Chceš odstrániť moderátora ${profile.username}?`);
    if (!ok) return;

    try {
      await api.patch(`/admin/users/${profile.id}/role`, { role: "user" });
      const res = await api.get(`/profile/${id || "me"}`);
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="page"><p>Načítavam profil...</p></div>;
  if (!profile) return <div className="page"><p>Profil sa nenašiel.</p></div>;

  return (
    <div className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 16 }}>
        <div style={{ background: "#0b162b", height: 140 }} />
        <div style={{ padding: 16, marginTop: -50, display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div style={{
            width: 96, height: 96, borderRadius: 12, background: "#111827",
            border: "2px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden"
          }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 32, color: "#9ca3af" }}>{profile.nickname?.[0] || profile.username?.[0]}</span>
            )}
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{profile.nickname || profile.username}</div>
              <div style={{ color: "#9ca3af" }}>{profile.username} · role: {profile.role}</div>
              <div style={{ marginTop: 4, color: "#9ca3af" }}>
                Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString("sk-SK") : "N/A"} ·
                Last seen: {profile.last_seen ? new Date(profile.last_seen).toLocaleString("sk-SK") : "N/A"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {isOwnProfile && (
                <Link to="/settings/profile" className="btn-secondary">
                  Upraviť profil
                </Link>
              )}
              {canMakeModerator && (
                <button className="btn-secondary" onClick={makeModerator}>
                  Make moderator
                </button>
              )}
              {canRemoveModerator && (
                <button className="btn-secondary" onClick={removeModerator}>
                  Remove moderator
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, padding: "16px 16px 8px 16px", color: "#e5e7eb" }}>
          <div><div style={{ color: "#9ca3af", fontSize: 13 }}>Messages</div><div style={{ fontSize: 20, fontWeight: 600 }}>{profile.posts_count ?? 0}</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 13 }}>Featured content</div><div style={{ fontSize: 20, fontWeight: 600 }}>{profile.featured_count ?? 0}</div></div>
          <div><div style={{ color: "#9ca3af", fontSize: 13 }}>Reaction score</div><div style={{ fontSize: 20, fontWeight: 600 }}>{profile.reaction_score ?? 0}</div></div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 16, borderBottom: "1px solid #1f2937", marginBottom: 12 }}>
            {["Profile posts", "Latest activity", "Postings", "Featured content", "About"].map((tab) => (
              <div key={tab} style={{ padding: "8px 0", borderBottom: "2px solid #10b981", color: "#e5e7eb" }}>
                {tab}
              </div>
            ))}
          </div>

          <div className="card" style={{ background: "#0b1220" }}>
            <div style={{ marginBottom: 8, color: "#9ca3af" }}>Update your status...</div>
            <div style={{ minHeight: 80, border: "1px solid #1f2937", borderRadius: 12 }} />
          </div>
        </div>
      </div>

      {!profile.hide_badges && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Badges</h3>
          {badges.length === 0 ? (
            <p className="topic-meta">Žiadne badge.</p>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {badges.map((b) => (
                <div key={b.id} className="tag-pill" style={{ padding: "6px 10px" }}>
                  {b.icon_url && <img src={b.icon_url} alt="" style={{ width: 16, height: 16, marginRight: 6 }} />}
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
