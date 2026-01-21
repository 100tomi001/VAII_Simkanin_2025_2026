import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";

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
  const [perm, setPerm] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [modAction, setModAction] = useState(null);
  const [modReason, setModReason] = useState("");
  const [modMinutes, setModMinutes] = useState("");
  const [modDays, setModDays] = useState("");
  const [modMessage, setModMessage] = useState("");
  const [confirm, setConfirm] = useState(null);
  const closeConfirm = () => setConfirm(null);
  const runConfirm = async () => {
    if (!confirm?.onConfirm) return;
    try {
      await confirm.onConfirm();
    } finally {
      closeConfirm();
    }
  };

  const isOwnProfile = !id || id === String(user?.id);
  const isAdmin = user?.role === "admin";
  const canMakeModerator = isAdmin && !isOwnProfile && profile?.role !== "moderator";
  const canRemoveModerator = isAdmin && !isOwnProfile && profile?.role === "moderator";
  const canBanUsers = user?.role === "admin" || perm?.can_ban_users;

  const loadProfile = async () => {
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

  useEffect(() => {
    loadProfile();
  }, [id]);

  useEffect(() => {
    const loadPerms = async () => {
      if (!user) return;
      try {
        const res = await api.get("/moderation/permissions/me");
        setPerm(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadPerms();
  }, [user]);

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
    setConfirm({
      title: "Make moderator?",
      message: `Make ${profile.username} moderator?`,
      confirmText: "Confirm",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          await api.patch(`/admin/users/${profile.id}/role`, { role: "moderator" });
          const res = await api.get(`/profile/${id || "me"}`);
          setProfile(res.data);
        } catch (err) {
          console.error(err);
        }
      },
    });
  };

  const removeModerator = async () => {
    if (!profile) return;
    setConfirm({
      title: "Remove moderator?",
      message: `Remove moderator ${profile.username}?`,
      confirmText: "Remove",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await api.patch(`/admin/users/${profile.id}/role`, { role: "user" });
          const res = await api.get(`/profile/${id || "me"}`);
          setProfile(res.data);
        } catch (err) {
          console.error(err);
        }
      },
    });
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

  const openReportUser = () => {
    setReportOpen(true);
    setReportReason("");
    setReportMessage("");
  };

  const submitUserReport = async () => {
    if (!profile || !user || isOwnProfile) return;
    const cleanReason = reportReason.trim();
    if (cleanReason.length < 3) {
      setReportMessage("Reason too short.");
      return;
    }
    try {
      await api.post("/reports", { userId: profile.id, reason: cleanReason });
      setReportMessage("Report sent.");
      setReportOpen(false);
      setReportReason("");
    } catch (err) {
      console.error(err);
      setReportMessage("Failed to send report.");
    }
  };

  const startModAction = (action) => {
    setModAction(action);
    setModReason("");
    setModMinutes("");
    setModDays("");
    setModMessage("");
  };

  const cancelModAction = () => {
    setModAction(null);
    setModReason("");
    setModMinutes("");
    setModDays("");
    setModMessage("");
  };

  const submitModAction = async () => {
    if (!profile || !canBanUsers || isOwnProfile) return;
    try {
      if (modAction === "warn") {
        await api.post("/moderation/warn", { userId: profile.id, reason: modReason });
        setModMessage("Warn sent.");
      } else if (modAction === "mute") {
        const minutesNum = Number(modMinutes);
        if (!Number.isInteger(minutesNum) || minutesNum <= 0) {
          setModMessage("Mute minutes must be > 0.");
          return;
        }
        await api.post("/moderation/mute", {
          userId: profile.id,
          reason: modReason,
          minutes: minutesNum,
        });
        setModMessage("User muted.");
      } else if (modAction === "ban") {
        const daysNum = Number(modDays);
        const bannedUntil =
          Number.isInteger(daysNum) && daysNum > 0
            ? new Date(Date.now() + daysNum * 24 * 60 * 60 * 1000).toISOString()
            : null;
        await api.post("/moderation/ban", {
          userId: profile.id,
          reason: modReason,
          bannedUntil,
        });
        setModMessage("User banned.");
      } else if (modAction === "unban") {
        await api.post("/moderation/unban", { userId: profile.id, reason: modReason });
        setModMessage("User unbanned.");
      }
      await loadProfile();
      setModAction(null);
    } catch (err) {
      console.error(err);
      setModMessage("Action failed.");
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
          <div>
            <div className="profile-stat-label">Followers</div>
            <div className="profile-stat-value">{profile.followers_count ?? 0}</div>
          </div>
          <div>
            <div className="profile-stat-label">Following</div>
            <div className="profile-stat-value">{profile.following_count ?? 0}</div>
          </div>
        </div>

        <div className="profile-meta">
          <div>Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString("sk-SK") : "N/A"}</div>
          <div>Last seen: {profile.last_seen ? new Date(profile.last_seen).toLocaleString("sk-SK") : "N/A"}</div>
          {profile.is_banned && (
            <div style={{ color: "#f87171" }}>
              Banned until:{" "}
              {profile.banned_until ? new Date(profile.banned_until).toLocaleString("sk-SK") : "permanent"}
            </div>
          )}
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
              <button className="btn-secondary" onClick={openReportUser}>
                Report user
              </button>
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

        {reportOpen && !isOwnProfile && user && (
          <div style={{ width: "100%", marginTop: 8 }}>
            <div className="topic-meta">Report user</div>
            <textarea
              rows={2}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for report"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn-secondary" type="button" onClick={submitUserReport}>
                Send report
              </button>
              <button className="btn-link" type="button" onClick={() => setReportOpen(false)}>
                Cancel
              </button>
            </div>
            {reportMessage && <div className="topic-meta">{reportMessage}</div>}
          </div>
        )}

        {canBanUsers && !isOwnProfile && (
          <div style={{ width: "100%", marginTop: 10 }}>
            <div className="topic-meta" style={{ marginBottom: 6 }}>Moderation</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-secondary" onClick={() => startModAction("ban")}>
                Ban user
              </button>
              <button className="btn-secondary" onClick={() => startModAction("mute")}>
                Mute user
              </button>
              <button className="btn-secondary" onClick={() => startModAction("warn")}>
                Warn user
              </button>
              {profile.is_banned && (
                <button className="btn-secondary" onClick={() => startModAction("unban")}>
                  Unban
                </button>
              )}
            </div>

            {modAction && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="topic-meta">Action: {modAction}</div>
                <textarea
                  rows={2}
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  placeholder="Reason (optional)"
                />
                {modAction === "mute" && (
                  <input
                    type="number"
                    min="1"
                    value={modMinutes}
                    onChange={(e) => setModMinutes(e.target.value)}
                    placeholder="Minutes"
                  />
                )}
                {modAction === "ban" && (
                  <input
                    type="number"
                    min="0"
                    value={modDays}
                    onChange={(e) => setModDays(e.target.value)}
                    placeholder="Days (0 = permanent)"
                  />
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-secondary" type="button" onClick={submitModAction}>
                    Apply
                  </button>
                  <button className="btn-link" type="button" onClick={cancelModAction}>
                    Cancel
                  </button>
                </div>
                {modMessage && <div className="topic-meta">{modMessage}</div>}
              </div>
            )}
          </div>
        )}

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

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        cancelText="Cancel"
        confirmVariant={confirm?.confirmVariant}
        onCancel={closeConfirm}
        onConfirm={runConfirm}
      />
    </div>
  );
}
