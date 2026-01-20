import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function NewTopic() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const TITLE_MAX = 120;
  const CONTENT_MAX = 5000;
  const TAG_MAX = 10;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    const loadTags = async () => {
      try {
        const [t, c] = await Promise.all([api.get("/tags"), api.get("/categories")]);
        setTags(t.data);
        setCategories(c.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadTags();
  }, []);

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Na vytvorenie temy sa musis prihlasit</h2>
          <p>Pre vytvorenie novej diskusie je potrebny ucet.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <Link to="/login" className="btn-primary">
              Prihlasit sa
            </Link>
            <Link to="/register" className="btn-secondary">
              Registracia
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const toggleTag = (id) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= TAG_MAX) {
        setError(`Max ${TAG_MAX} tagov.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !content.trim() || !categoryId) {
      setError("Vypln nazov, obsah a kategoriu temy.");
      return;
    }

    try {
      const res = await api.post("/topics", {
        title: title.trim(),
        content: content.trim(),
        tagIds: selectedTagIds,
        category_id: Number(categoryId),
      });

      const newId = res.data.id;
      toast.success("Tema vytvorena.");
      navigate(`/topic/${newId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri vytvarani temy.");
      toast.error("Nepodarilo sa vytvorit temu.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Nova tema</h1>
        <p className="page-subtitle">Vytvor novu diskusiu.</p>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nazov temy"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError("");
            }}
          />
          <div className="topic-meta" style={{ marginTop: 4 }}>
            {title.length}/{TITLE_MAX}
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={{ marginTop: 8 }}
          >
            <option value="">Vyber hru/kategoriu</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <textarea
            rows={8}
            placeholder="Uvodny prispevok..."
            value={content}
            maxLength={CONTENT_MAX}
            onChange={(e) => {
              setContent(e.target.value);
              if (error) setError("");
            }}
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              borderRadius: 10,
              padding: "8px 10px",
              color: "#e5e7eb",
              resize: "vertical",
            }}
          />
          <div className="topic-meta" style={{ marginTop: 4 }}>
            {content.length}/{CONTENT_MAX}
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Tagy</div>
            <div className="topic-meta" style={{ marginBottom: 6 }}>
              {selectedTagIds.length}/{TAG_MAX} selected
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="tag-pill"
                  style={{
                    background: selectedTagIds.includes(tag.id)
                      ? "var(--accent)"
                      : "var(--chip-bg)",
                    borderColor: selectedTagIds.includes(tag.id)
                      ? "var(--accent)"
                      : "var(--chip-border)",
                    color: selectedTagIds.includes(tag.id) ? "#fff" : "var(--text)",
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: 12 }}>
            Vytvorit temu
          </button>
        </form>

        {error && <p style={{ color: "salmon", marginTop: 8 }}>{error}</p>}

        <p style={{ marginTop: 10 }}>
          <Link to="/forum" className="btn-link">
            Spat na forum
          </Link>
        </p>
      </div>
    </div>
  );
}
