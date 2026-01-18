import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function MessagesPage() {
  const { user } = useAuth();
  const { userId } = useParams(); // ak je zadané, otvorí sa vlákno
  const navigate = useNavigate();
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  const loadThreads = async () => {
    try {
      const res = await api.get("/messages");
      setThreads(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadThread = async (uid) => {
    setLoading(true);
    try {
      const res = await api.get(`/messages/${uid}`);
      setMessages(res.data);
      // označ ako prečítané
      await api.post(`/messages/${uid}/read`);
      // zníž badge o počet správ od partnera v tomto vlákne
      const unreadFromOther = res.data.filter(
        (m) => m.sender_id === Number(uid) && m.is_read === false
      ).length;
      if (unreadFromOther > 0) {
        window.dispatchEvent(new CustomEvent("msg-read", { detail: { count: unreadFromOther } }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadThreads();
  }, [user]);

  useEffect(() => {
    if (user && userId) loadThread(userId);
    else setMessages([]);
  }, [user, userId]);

  useEffect(() => {
    // scroll na koniec pri novej správe
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !userId) return;
    const payload = { recipientId: Number(userId), content: text.trim() };
    try {
      const res = await api.post("/messages", payload);
      setMessages((prev) => [...prev, res.data]);
      setText("");
      // upd sidebar posledné vlákno
      setThreads((prev) => {
        const filtered = prev.filter((t) => t.other_id !== Number(userId));
        return [
          {
            other_id: Number(userId),
            other_nickname: res.data.recipient_nickname,
            other_username: res.data.recipient_username,
            last_message_at: res.data.created_at,
          },
          ...filtered,
        ];
      });
    } catch (err) {
      console.error(err);
    }
  };

  const currentPartner = useMemo(() => {
    if (!userId) return null;
    return threads.find((t) => String(t.other_id) === String(userId));
  }, [threads, userId]);

  if (!user)
    return (
      <div className="page">
        <div className="card">Musíš byť prihlásený.</div>
      </div>
    );

  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12 }}>
      <div className="card" style={{ minHeight: 400 }}>
        <h3>Konverzácie</h3>
        {threads.length === 0 && <p className="topic-meta">Žiadne konverzácie.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {threads.map((t) => (
            <button
              key={t.other_id}
              className="btn-secondary"
              style={{
                justifyContent: "space-between",
                display: "flex",
                alignItems: "center",
                borderColor: String(t.other_id) === String(userId) ? "#6366f1" : undefined,
                background: String(t.other_id) === String(userId) ? "#111827" : undefined,
              }}
              onClick={() => navigate(`/messages/${t.other_id}`)}
            >
              <span>{t.other_nickname || t.other_username || `User ${t.other_id}`}</span>
              <span className="topic-meta">
                {new Date(t.last_message_at).toLocaleString("sk-SK")}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 400 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Správy</h3>
          {currentPartner && (
            <Link className="btn-link" to={`/profile/${currentPartner.other_id}`}>
              Otvoriť profil
            </Link>
          )}
        </div>
        {userId ? (
          loading ? (
            <p>Načítavam...</p>
          ) : (
            <>
              <div
                ref={listRef}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 260,
                  maxHeight: "60vh",
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender_id === user.id ? "flex-end" : "flex-start",
                      background: m.sender_id === user.id ? "#1e3a8a" : "#0b1220",
                      padding: "8px 10px",
                      borderRadius: 10,
                      maxWidth: "72%",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9ca3af",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>{m.sender_nickname || m.sender_username || `User ${m.sender_id}`}</span>
                      <span>{new Date(m.created_at).toLocaleString("sk-SK")}</span>
                    </div>
                    <div>{m.content}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input
                  style={{ flex: 1 }}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Napíš správu..."
                />
                <button className="btn-primary" type="button" onClick={send}>
                  Poslať
                </button>
              </div>
            </>
          )
        ) : (
          <p className="topic-meta">Vyber používateľa vľavo.</p>
        )}
      </div>
    </div>
  );
}
