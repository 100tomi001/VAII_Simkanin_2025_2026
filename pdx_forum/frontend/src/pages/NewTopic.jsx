import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function NewTopic() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await api.get("/tags");
        setTags(res.data);
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
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !content.trim()) {
      setError("Vypln nazov temy aj obsah prveho prispevku.");
      return;
    }

    try {
      const res = await api.post("/topics", {
        title: title.trim(),
        content: content.trim(),
        tagIds: selectedTagIds,
      });

      const newId = res.data.id;
      navigate(`/topic/${newId}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri vytvarani temy.");
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
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            rows={8}
            placeholder="Uvodny prispevok..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              background: "#020617",
              border: "1px solid #1f2937",
              borderRadius: 10,
              padding: "8px 10px",
              color: "#e5e7eb",
              resize: "vertical",
            }}
          />

          <div style={{ marginTop: 10 }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Tagy</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="tag-pill"
                  style={{
                    background: selectedTagIds.includes(tag.id)
                      ? "#4f46e5"
                      : "#020617",
                    borderColor: selectedTagIds.includes(tag.id)
                      ? "#6366f1"
                      : "#1f2937",
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
