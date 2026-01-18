import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function NotificationsPage() {
  const { user } = useAuth();
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
        setError("Nepodarilo sa načítať notifikácie.");
      } finally {
        setLoading(false);
      }
    };
    if (user) load();
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="card">Musíš byť prihlásený.</div>
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
    // zníž badge hneď
    window.dispatchEvent(new CustomEvent("notif-read", { detail: { count: 1 } }));
    try {
      await api.post("/notifications/mark-read", { ids: [id] });
    } catch (err) {
      console.error(err);
      // ak zlyhá, vrátime naspäť a badge opravíme späť
      setItems((prev) => {
        if (prev.find((n) => n.id === id)) return prev;
        return removeAfterClick ? [...prev, notif] : prev.map((n) => (n.id === id ? notif : n));
      });
      window.dispatchEvent(new CustomEvent("notif-read", { detail: { count: -1 } }));
    }
  };

  const renderBody = (n) => {
    if (n.type === "comment_reply") {
      const t = n.payload || {};
      const targetHref = t.topicId ? `/topic/${t.topicId}#post-${t.postId || t.parentPostId}` : null;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div>
            <strong>{t.authorNickname || "Niekto"}</strong> odpovedal na tvoj komentár
            {targetHref && (
              <>
                {" · "}
                <Link to={targetHref} style={{ color: "#60a5fa" }}>
                  otvoriť vlákno
                </Link>
              </>
            )}
          </div>
          {t.snippet && (
            <div style={{ fontSize: 13, color: "#cbd5e1" }}>"{t.snippet}"</div>
          )}
        </div>
      );
    }

    // fallback pre iné typy
    return (
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
        {JSON.stringify(n.payload, null, 2)}
      </pre>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Notifikácie</h1>
      </div>
      <div className="card">
        {error && <p style={{ color: "salmon" }}>{error}</p>}
        {loading ? (
          <p>Načítavam...</p>
        ) : items.length === 0 ? (
          <p className="topic-meta">Žiadne notifikácie.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((n) => (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                style={{
                  border: n.is_read ? "1px solid #1f2937" : "1px solid #2563eb",
                  borderRadius: 10,
                  padding: 10,
                  background: n.is_read ? "#0b1220" : "#0f172a",
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
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
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
                      Zmazať
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
