import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function WikiEditor() {
  const { id } = useParams(); // ak id existuje, editujeme; inak create
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [blocks, setBlocks] = useState([]);
  const [form, setForm] = useState({ title: "", summary: "", cover_image: "", category_id: null, status: "draft" });

  const isEditor = user && (user.role === "admin" || user.role === "moderator");

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/wiki/${id}`);
        setArticle(res.data);
        setForm({
          title: res.data.title,
          summary: res.data.summary || "",
          cover_image: res.data.cover_image || "",
          category_id: res.data.category_id,
          status: res.data.status,
        });
        setBlocks(res.data.content || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (!isEditor) return <div className="page"><p>Len pre wiki moderátorov/adminov.</p></div>;
  if (loading) return <div className="page"><p>Načítavam...</p></div>;

  const addBlock = (type) => {
    const defaultBlock = { type, text: "", level: 2, items: [], url: "", alt: "", caption: "" };
    setBlocks((prev) => [...prev, defaultBlock]);
  };

  const updateBlock = (idx, patch) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeBlock = (idx) => {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImageDrop = (idx, e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    updateBlock(idx, { url, alt: file.name, caption: file.name });
  };

  const handleSave = async () => {
    try {
      const payload = {
        title: form.title,
        summary: form.summary,
        content: blocks,
        cover_image: form.cover_image,
        category_id: form.category_id,
        status: form.status,
      };
      if (id) {
        await api.patch(`/wiki/${id}`, payload);
      } else {
        await api.post("/wiki", payload);
      }
      navigate("/wiki");
    } catch (err) {
      console.error(err);
      alert("Chyba pri ukladaní");
    }
  };

  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
      <div className="card">
        <h1>{id ? "Upraviť článok" : "Nový článok"}</h1>
        <input
          type="text"
          placeholder="Názov"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          placeholder="Summary"
          rows={2}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
        />
        <input
          type="text"
          placeholder="Cover image URL"
          value={form.cover_image}
          onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
        />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <div style={{ marginTop: 12 }}>
          <h3>Obsah</h3>
          {blocks.map((b, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #1f2937",
                padding: 8,
                borderRadius: 8,
                marginBottom: 8,
                background: "#0b1220",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{b.type}</strong>
                <button className="btn-link" onClick={() => removeBlock(idx)}>x</button>
              </div>

              {b.type === "heading" && (
                <>
                  <input
                    value={b.text}
                    onChange={(e) => updateBlock(idx, { text: e.target.value })}
                    placeholder="Nadpis"
                  />
                  <select
                    value={b.level}
                    onChange={(e) => updateBlock(idx, { level: Number(e.target.value) })}
                  >
                    <option value={1}>H1</option>
                    <option value={2}>H2</option>
                    <option value={3}>H3</option>
                  </select>
                </>
              )}

              {b.type === "paragraph" && (
                <textarea
                  rows={3}
                  value={b.text}
                  onChange={(e) => updateBlock(idx, { text: e.target.value })}
                  placeholder="Text"
                />
              )}

              {b.type === "list" && (
                <textarea
                  rows={3}
                  value={b.items.join("\n")}
                  onChange={(e) => updateBlock(idx, { items: e.target.value.split("\n") })}
                  placeholder="Položky (každý riadok jedna)"
                />
              )}

              {b.type === "image" && (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleImageDrop(idx, e)}
                  style={{
                    border: "1px dashed #374151",
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 6,
                  }}
                >
                  <p className="topic-meta" style={{ marginBottom: 6 }}>
                    Drag & drop obrázok sem alebo vlož URL
                  </p>
                  <input
                    value={b.url}
                    onChange={(e) => updateBlock(idx, { url: e.target.value })}
                    placeholder="Image URL"
                  />
                  <input
                    value={b.caption || ""}
                    onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                    placeholder="Caption"
                  />
                  {b.url && (
                    <div style={{ marginTop: 8 }}>
                      <img src={b.url} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />
                    </div>
                  )}
                </div>
              )}

              {b.type === "quote" && (
                <textarea
                  rows={2}
                  value={b.text}
                  onChange={(e) => updateBlock(idx, { text: e.target.value })}
                  placeholder="Quote text"
                />
              )}

              {b.type === "code" && (
                <textarea
                  rows={4}
                  value={b.text}
                  onChange={(e) => updateBlock(idx, { text: e.target.value })}
                  placeholder="Code"
                />
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={() => addBlock("heading")}>+ Heading</button>
            <button className="btn-secondary" onClick={() => addBlock("paragraph")}>+ Text</button>
            <button className="btn-secondary" onClick={() => addBlock("list")}>+ List</button>
            <button className="btn-secondary" onClick={() => addBlock("quote")}>+ Quote</button>
            <button className="btn-secondary" onClick={() => addBlock("code")}>+ Code</button>
            <button className="btn-secondary" onClick={() => addBlock("image")}>+ Image</button>
          </div>
        </div>

        <button className="btn-primary" style={{ marginTop: 12 }} onClick={handleSave}>
          Uložiť
        </button>
      </div>

      <div className="card">
        <h3>Preview</h3>
        <div>
          <h2>{form.title}</h2>
          <p className="topic-meta">{form.summary}</p>
          {form.cover_image && <img src={form.cover_image} alt="" style={{ width: "100%", borderRadius: 12 }} />}
          {(blocks || []).map((b, idx) => (
            <div key={idx} style={{ marginTop: 8 }}>
              {b.type === "heading" && (b.level === 1 ? <h2>{b.text}</h2> : b.level === 2 ? <h3>{b.text}</h3> : <h4>{b.text}</h4>)}
              {b.type === "paragraph" && <p>{b.text}</p>}
              {b.type === "list" && <ul>{b.items.map((it, i) => <li key={i}>{it}</li>)}</ul>}
              {b.type === "image" && b.url && <img src={b.url} alt="" style={{ maxWidth: "100%" }} />}
              {b.type === "quote" && <blockquote>{b.text}</blockquote>}
              {b.type === "code" && <pre>{b.text}</pre>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
