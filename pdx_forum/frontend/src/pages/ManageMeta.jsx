import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function ManageMeta() {
  const { user } = useAuth();
  const [tags, setTags] = useState([]);
  const [badges, setBadges] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [newBadge, setNewBadge] = useState({ name: "", icon_url: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isEditor = user && (user.role === "admin" || user.role === "moderator");

  const load = async () => {
    try {
      const [t, b] = await Promise.all([api.get("/tags"), api.get("/badges")]);
      setTags(t.data);
      setBadges(b.data);
    } catch (err) {
      console.error(err);
      setError("Nepodarilo sa načítať meta dáta.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isEditor) load();
  }, [isEditor]);

  const addTag = async () => {
    if (!newTag.trim()) return;
    try {
      const res = await api.post("/tags", { name: newTag.trim() });
      setTags((prev) => [...prev, res.data]);
      setNewTag("");
      setError("");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message?.toLowerCase() || "";
      if (msg.includes("exists") || msg.includes("duplicate")) {
        setError("Tag už existuje.");
      } else {
        setError(err.response?.data?.message || "Chyba pri vytváraní tagu.");
      }
    }
  };

  const deleteTag = async (id) => {
    if (!window.confirm("Zmazať tag?")) return;
    try {
      await api.delete(`/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri mazaní tagu.");
    }
  };

  const addBadge = async () => {
    if (!newBadge.name.trim()) return;
    try {
      const res = await api.post("/badges", {
        name: newBadge.name.trim(),
        icon_url: newBadge.icon_url || null,
      });
      setBadges((prev) => [...prev, res.data]);
      setNewBadge({ name: "", icon_url: "" });
      setError("");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message?.toLowerCase() || "";
      if (msg.includes("exists") || msg.includes("duplicate")) {
        setError("Badge už existuje.");
      } else {
        setError(err.response?.data?.message || "Chyba pri vytváraní badge.");
      }
    }
  };

  const deleteBadge = async (id) => {
    if (!window.confirm("Zmazať badge?")) return;
    try {
      await api.delete(`/badges/${id}`);
      setBadges((prev) => prev.filter((b) => b.id !== id));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri mazaní badge.");
    }
  };

  const handleBadgeDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setNewBadge((p) => ({ ...p, icon_url: url }));
  };

  if (!isEditor) {
    return (
      <div className="page">
        <div className="card">Len pre adminov/moderátorov.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Správa tagov a badge</h1>
        <p className="page-subtitle">Pridávaj a maž tagy, badge s ikonou.</p>
      </div>

      {error && <p style={{ color: "salmon" }}>{error}</p>}

      {loading ? (
        <p>Načítavam...</p>
      ) : (
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <h3>Tagy</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Názov tagu"
              />
              <button className="btn-primary" type="button" onClick={addTag}>
                Pridať
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map((t) => (
                <div key={t.id} className="tag-pill" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {t.name}
                  <button
                    type="button"
                    className="btn-link"
                    style={{ padding: 0 }}
                    onClick={() => deleteTag(t.id)}
                  >
                    x
                  </button>
                </div>
              ))}
              {tags.length === 0 && <p className="topic-meta">Žiadne tagy.</p>}
            </div>
          </div>

          <div>
            <h3>Badge</h3>
            <div
              style={{
                border: "1px dashed #374151",
                padding: 10,
                borderRadius: 10,
                marginBottom: 10,
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleBadgeDrop}
              title="Drag & drop ikonku alebo vlož URL"
            >
              <input
                value={newBadge.name}
                onChange={(e) => setNewBadge((p) => ({ ...p, name: e.target.value }))}
                placeholder="Názov badge"
              />
              <input
                value={newBadge.icon_url}
                onChange={(e) => setNewBadge((p) => ({ ...p, icon_url: e.target.value }))}
                placeholder="Ikona URL alebo drag&drop"
              />
              {newBadge.icon_url && (
                <div style={{ marginTop: 6 }}>
                  <img src={newBadge.icon_url} alt="" style={{ width: 32, height: 32, borderRadius: 6 }} />
                </div>
              )}
              <button className="btn-primary" type="button" style={{ marginTop: 8 }} onClick={addBadge}>
                Pridať badge
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {badges.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid #1f2937",
                    borderRadius: 10,
                    padding: "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  title={b.name}
                >
                  {b.icon_url ? (
                    <img src={b.icon_url} alt={b.name} style={{ width: 24, height: 24, borderRadius: 6 }} />
                  ) : (
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "#111827" }} />
                  )}
                  <span>{b.name}</span>
                  <button
                    type="button"
                    className="btn-link"
                    style={{ padding: 0 }}
                    onClick={() => deleteBadge(b.id)}
                  >
                    x
                  </button>
                </div>
              ))}
              {badges.length === 0 && <p className="topic-meta">Žiadne badge.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
