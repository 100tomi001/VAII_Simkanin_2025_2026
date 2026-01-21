import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function NotificationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const res = await api.get("/notifications");
        setItems(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load notifications.");
        toast.error("Nepodarilo sa nacitat notifikacie.");
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="card">Login required.</div>
      </div>
    );
  }

  const markReadAndRemove = async (notif, removeAfterClick = true) => {
    const id = notif.id;
    if (removeAfterClick) {
      setItems((prev) => prev.filter((n) => n.id !== id));
    } else {
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    }
    window.dispatchEvent(new CustomEvent("notif-read", { detail: { count: 1 } }));
    try {
      await api.post("/notifications/mark-read", { ids: [id] });
    } catch (err) {
      console.error(err);
      setItems((prev) => {
        if (prev.find((n) => n.id === id)) return prev;
        return removeAfterClick ? [...prev, notif] : prev.map((n) => (n.id === id ? notif : n));
      });
      window.dispatchEvent(new CustomEvent("notif-read", { detail: { count: -1 } }));
    }
  };

  const renderBody = (n) => {
    const t = n.payload || {};
    if (n.type === "comment_reply") {
      const targetHref = t.topicId ? `/topic/${t.topicId}#post-${t.postId || t.parentPostId}` : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>{t.authorNickname || "Someone"}</strong> replied to your comment
            {targetHref && (
              <>
                {" | "}
                <Link to={targetHref} style={{ color: "var(--accent)" }}>
                  open thread
                </Link>
              </>
            )}
          </div>
          {t.snippet && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>"{t.snippet}"</div>
          )}
        </div>
      );
    }

    if (n.type === "followed_topic_post") {
      const targetHref = t.topicId ? `/topic/${t.topicId}#post-${t.postId}` : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            New comment in followed topic{" "}
            {t.topicTitle && <strong>{t.topicTitle}</strong>}
            {targetHref && (
              <>
                {" | "}
                <Link to={targetHref} style={{ color: "var(--accent)" }}>
                  open
                </Link>
              </>
            )}
          </div>
          {t.authorNickname && <div className="topic-meta">by {t.authorNickname}</div>}
          {t.snippet && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>"{t.snippet}"</div>
          )}
        </div>
      );
    }

    if (n.type === "followed_user_post") {
      const targetHref = t.topicId ? `/topic/${t.topicId}#post-${t.postId}` : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>{t.authorNickname || "Followed user"}</strong> posted a comment
            {targetHref && (
              <>
                {" | "}
                <Link to={targetHref} style={{ color: "var(--accent)" }}>
                  open
                </Link>
              </>
            )}
          </div>
          {t.topicTitle && <div className="topic-meta">{t.topicTitle}</div>}
          {t.snippet && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>"{t.snippet}"</div>
          )}
        </div>
      );
    }

    if (n.type === "followed_user_topic") {
      const targetHref = t.topicId ? `/topic/${t.topicId}` : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>{t.authorNickname || "Followed user"}</strong> created a new topic
            {targetHref && (
              <>
                {" | "}
                <Link to={targetHref} style={{ color: "var(--accent)" }}>
                  open
                </Link>
              </>
            )}
          </div>
          {t.topicTitle && <div className="topic-meta">{t.topicTitle}</div>}
        </div>
      );
    }

    if (n.type === "message") {
      const fromLabel = t.fromNickname || t.fromUsername || (t.from ? `User ${t.from}` : "Someone");
      const targetHref = t.from ? `/messages/${t.from}` : "/messages";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            New message from <strong>{fromLabel}</strong>
            {" | "}
            <Link to={targetHref} style={{ color: "var(--accent)" }}>
              open chat
            </Link>
          </div>
          {t.snippet && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>"{t.snippet}"</div>
          )}
        </div>
      );
    }

    if (n.type === "report") {
      const isUserReport = t.type === "user" || (!!t.targetUserId && !t.postId);
      const postId = t.postId || t.contextPostId;
      const targetHref = t.topicId && postId ? `/topic/${t.topicId}#post-${postId}` : null;
      const profileHref = t.targetUserId ? `/profile/${t.targetUserId}` : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            New {isUserReport ? "user" : "post"} report received
            {" | "}
            <Link to="/moderation" style={{ color: "var(--accent)" }}>
              moderation
            </Link>
          </div>
          {profileHref && isUserReport && (
            <div className="topic-meta">
              <Link to={profileHref} style={{ color: "var(--accent)" }}>
                open profile
              </Link>
            </div>
          )}
          {targetHref && (
            <div className="topic-meta">
              <Link to={targetHref} style={{ color: "var(--accent)" }}>
                open post
              </Link>
            </div>
          )}
        </div>
      );
    }

    return (
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
        {JSON.stringify(n.payload, null, 2)}
      </pre>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Notifications</h1>
      </div>
      <div className="card">
        {error && <p style={{ color: "salmon" }}>{error}</p>}
        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div>No notifications.</div>
            <div className="topic-meta" style={{ marginTop: 6 }}>
              You are all caught up.
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <Link to="/forum" className="btn-secondary">Go to forum</Link>
              <Link to="/wiki" className="btn-secondary">Browse wiki</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((n) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                style={{
                  border: n.is_read ? "1px solid var(--card-border)" : "1px solid var(--accent)",
                  borderRadius: 10,
                  padding: 10,
                  background: n.is_read ? "var(--chip-bg)" : "var(--accent-soft)",
                  cursor: "pointer",
                  boxShadow: n.is_read ? "none" : "0 0 0 1px rgba(37,99,235,0.25)",
                }}
                onClick={() => markReadAndRemove(n, false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    markReadAndRemove(n, false);
                  }
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{n.type}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {new Date(n.created_at).toLocaleString("sk-SK")}
                    </div>
                    <button
                      className="btn-link"
                      style={{ color: "#f87171", padding: 0, fontSize: 13 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadAndRemove(n);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {renderBody(n)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
