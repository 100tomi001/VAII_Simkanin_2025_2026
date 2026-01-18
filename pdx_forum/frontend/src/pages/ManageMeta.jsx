import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function ManageMeta() {
  const { user } = useAuth();
  const [tags, setTags] = useState([]);
  const [badges, setBadges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [newBadge, setNewBadge] = useState({ name: "", icon_url: "" });
  const [newCategory, setNewCategory] = useState({ name: "", description: "", sort_order: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isEditor = user && (user.role === "admin" || user.role === "moderator");

  const load = async () => {
    try {
      const [t, b, c] = await Promise.all([
        api.get("/tags"),
        api.get("/badges"),
        api.get("/categories"),
      ]);
      setTags(t.data);
      setBadges(b.data);
      setCategories(c.data);
    } catch (err) {
      console.error(err);
      setError("Nepodarilo sa nacitat meta data.");
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
        setError("Tag uz existuje.");
      } else {
        setError(err.response?.data?.message || "Chyba pri vytvarani tagu.");
      }
    }
  };

  const deleteTag = async (id) => {
    if (!window.confirm("Zmazat tag?")) return;
    try {
      await api.delete(`/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri mazani tagu.");
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
        setError("Badge uz existuje.");
      } else {
        setError(err.response?.data?.message || "Chyba pri vytvarani badge.");
      }
    }
  };

  const deleteBadge = async (id) => {
    if (!window.confirm("Zmazat badge?")) return;
    try {
      await api.delete(`/badges/${id}`);
      setBadges((prev) => prev.filter((b) => b.id !== id));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri mazani badge.");
    }
  };

  const handleBadgeDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setNewBadge((p) => ({ ...p, icon_url: url }));
  };

  const addCategory = async () => {
    if (!newCategory.name.trim()) return;
    try {
      const res = await api.post("/categories", {
        name: newCategory.name.trim(),
        description: newCategory.description,
        sort_order: Number(newCategory.sort_order) || 0,
      });
      setCategories((prev) => [...prev, res.data]);
      setNewCategory({ name: "", description: "", sort_order: 0 });
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri vytvarani kategorie.");
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm("Zmazat kategoriu?")) return;
    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri mazani kategorie.");
    }
  };

  if (!isEditor) {
    return (
      <div className="page">
        <div className="card">Len pre adminov/moderatorov.</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Sprava tagov, badge a kategorii</h1>
        <p className="page-subtitle">Pridavaj a maz meta data.</p>
      </div>

      {error && <p style={{ color: "salmon" }}>{error}</p>}

      {loading ? (
        <p>Nacitavam...</p>
      ) : (
        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <h3>Tagy</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Nazov tagu"
              />
              <button className="btn-primary" type="button" onClick={addTag}>
                Pridat
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
              {tags.length === 0 && <p className="topic-meta">Ziadne tagy.</p>}
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
              title="Drag & drop ikonku alebo vloz URL"
            >
              <input
                value={newBadge.name}
                onChange={(e) => setNewBadge((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nazov badge"
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
                Pridat badge
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {badges.map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid var(--card-border)",
                    borderRadius: 10,
                    padding: "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--chip-bg)",
                  }}
                  title={b.name}
                >
                  {b.icon_url ? (
                    <img src={b.icon_url} alt={b.name} style={{ width: 24, height: 24, borderRadius: 6 }} />
                  ) : (
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--chip-bg)" }} />
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
              {badges.length === 0 && <p className="topic-meta">Ziadne badge.</p>}
            </div>
          </div>

          <div>
            <h3>Kategorie (hry)</h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <input
                value={newCategory.name}
                onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nazov kategorie"
              />
              <input
                value={newCategory.description}
                onChange={(e) => setNewCategory((p) => ({ ...p, description: e.target.value }))}
                placeholder="Popis"
              />
              <input
                value={newCategory.sort_order}
                onChange={(e) => setNewCategory((p) => ({ ...p, sort_order: e.target.value }))}
                placeholder="Order"
                style={{ width: 90 }}
              />
              <button className="btn-primary" type="button" onClick={addCategory}>
                Pridat
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {categories.map((c) => (
                <div key={c.id} className="tag-pill" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{c.name}</span>
                  <button
                    type="button"
                    className="btn-link"
                    style={{ padding: 0 }}
                    onClick={() => deleteCategory(c.id)}
                  >
                    x
                  </button>
                </div>
              ))}
              {categories.length === 0 && <p className="topic-meta">Ziadne kategorie.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
