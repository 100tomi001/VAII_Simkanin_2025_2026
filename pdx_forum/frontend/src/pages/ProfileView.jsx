import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { key: "posts", label: "Profile posts" },
  { key: "activity", label: "Latest activity" },
  { key: "topics", label: "Postings" },
  { key: "about", label: "About" },
];

export default function ProfileView() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [tabData, setTabData] = useState({ posts: [], topics: [], activity: [] });
  const [tabLoading, setTabLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

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

  useEffect(() => {
    const loadFollow = async () => {
      if (!user || isOwnProfile || !profile) return;
      try {
        const r = await api.get(`/follows/users/${profile.id}`);
        setIsFollowing(!!r.data?.following);
      } catch (err) {
        console.error(err);
      }
    };
    loadFollow();
  }, [user, profile, isOwnProfile]);

  useEffect(() => {
    const loadTab = async () => {
      if (!profile) return;
      setTabLoading(true);
      try {
        if (activeTab === "posts") {
          const r = await api.get(`/profile/${profile.id}/posts`);
          setTabData((p) => ({ ...p, posts: r.data }));
        } else if (activeTab === "topics") {
          const r = await api.get(`/profile/${profile.id}/topics`);
          setTabData((p) => ({ ...p, topics: r.data }));
        } else if (activeTab === "activity") {
          const r = await api.get(`/profile/${profile.id}/activity`);
          setTabData((p) => ({ ...p, activity: r.data }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setTabLoading(false);
      }
    };
    loadTab();
  }, [activeTab, profile]);

  const makeModerator = async () => {
    if (!profile) return;
    const ok = window.confirm(`Make ${profile.username} moderator?`);
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
    const ok = window.confirm(`Remove moderator ${profile.username}?`);
    if (!ok) return;

    try {
      await api.patch(`/admin/users/${profile.id}/role`, { role: "user" });
      const res = await api.get(`/profile/${id || "me"}`);
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFollow = async () => {
    if (!profile || !user || isOwnProfile) return;
    try {
      if (isFollowing) {
        await api.delete(`/follows/users/${profile.id}`);
        setIsFollowing(false);
      } else {
        await api.post(`/follows/users/${profile.id}`);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activityLabel = (a) => {
    if (a.type === "reaction") {
      return `Reaction: ${a.reaction_label || "like"}`;
    }
    return "Comment";
  };

  if (loading) return <div className="page"><p>Loading profile...</p></div>;
  if (!profile) return <div className="page"><p>Profile not found.</p></div>;

  return (
    <div className="page profile-layout">
      <div className="card profile-sidebar">
        <div className="profile-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span>{profile.nickname?.[0] || profile.username?.[0]}</span>
          )}
        </div>
        <div className="profile-name">{profile.nickname || profile.username}</div>
        <div className="profile-role">{profile.role}</div>

        <div className="profile-stats">
          <div>
            <div className="profile-stat-label">Messages</div>
            <div className="profile-stat-value">{profile.posts_count ?? 0}</div>
          </div>
          <div>
            <div className="profile-stat-label">Topics</div>
            <div className="profile-stat-value">{profile.topics_count ?? 0}</div>
          </div>
          <div>
            <div className="profile-stat-label">Karma</div>
            <div className="profile-stat-value">{profile.reaction_score ?? 0}</div>
          </div>
          <div>
            <div className="profile-stat-label">Badges</div>
            <div className="profile-stat-value">{badges.length}</div>
          </div>
        </div>

        <div className="profile-meta">
          <div>Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString("sk-SK") : "N/A"}</div>
          <div>Last seen: {profile.last_seen ? new Date(profile.last_seen).toLocaleString("sk-SK") : "N/A"}</div>
        </div>

        <div className="profile-actions">
          {isOwnProfile && (
            <Link to="/settings/profile" className="btn-secondary">
              Edit profile
            </Link>
          )}
          {!isOwnProfile && user && (
            <>
              <button className="btn-secondary" onClick={toggleFollow}>
                {isFollowing ? "Unfollow" : "Follow"}
              </button>
              <Link to={`/messages/${profile.id}`} className="btn-secondary">
                Message
              </Link>
            </>
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

        {!profile.hide_badges && (
          <div className="profile-badges">
            {badges.map((b) => (
              <div key={b.id} title={b.name} className="profile-badge">
                {b.icon_url ? <img src={b.icon_url} alt={b.name} /> : <span>?</span>}
              </div>
            ))}
            {badges.length === 0 && <div className="topic-meta">No badges.</div>}
          </div>
        )}
      </div>

      <div className="card profile-main">
        <div className="profile-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className="btn-link"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 0",
                borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                color: "var(--text)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {tabLoading ? (
          <p>Loading...</p>
        ) : activeTab === "posts" ? (
          tabData.posts.length === 0 ? (
            <p className="topic-meta">No posts yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tabData.posts.map((p) => (
                <div key={p.id} className="card" style={{ background: "var(--topic-bg)" }}>
                  <Link to={`/topic/${p.topic_id}#post-${p.id}`} className="btn-link">
                    {p.topic_title}
                  </Link>
                  <div className="topic-meta">{new Date(p.created_at).toLocaleString("sk-SK")}</div>
                  <div>{p.content}</div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "topics" ? (
          tabData.topics.length === 0 ? (
            <p className="topic-meta">No topics yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tabData.topics.map((t) => (
                <div key={t.id} className="card" style={{ background: "var(--topic-bg)" }}>
                  <Link to={`/topic/${t.id}`} className="btn-link">
                    {t.title}
                  </Link>
                  <div className="topic-meta">
                    {new Date(t.created_at).toLocaleString("sk-SK")} | replies {t.replies}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "activity" ? (
          tabData.activity.length === 0 ? (
            <p className="topic-meta">No activity yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tabData.activity.map((a, idx) => (
                <div key={`${a.type}-${a.post_id}-${idx}`} className="card" style={{ background: "var(--topic-bg)" }}>
                  <Link to={a.post_id ? `/topic/${a.topic_id}#post-${a.post_id}` : `/topic/${a.topic_id}`} className="btn-link">
                    {a.topic_title}
                  </Link>
                  <div className="topic-meta">
                    {activityLabel(a)} | {new Date(a.created_at).toLocaleString("sk-SK")}
                  </div>
                  {a.content && <div>{a.content}</div>}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="card" style={{ background: "var(--topic-bg)" }}>
            {profile.about ? <p>{profile.about}</p> : <p className="topic-meta">No description yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
