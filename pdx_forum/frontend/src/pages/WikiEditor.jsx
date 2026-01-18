import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function WikiEditor() {
  const { id } = useParams(); // ak id existuje, editujeme; inak create
  const navigate = useNavigate();
  const { user } = useAuth();
  const [canEditWiki, setCanEditWiki] = useState(false);
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [blocks, setBlocks] = useState([]);
  const [form, setForm] = useState({ title: "", summary: "", cover_image: "", category_id: null, status: "draft" });

  const isEditor = user && (user.role === "admin" || canEditWiki);

  const normalizeBlocks = (content) => {
    if (!content) return [];
    if (Array.isArray(content)) return content;
    if (typeof content === "string") {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.blocks)) return parsed.blocks;
        return [];
      } catch (err) {
        return [];
      }
    }
    if (typeof content === "object") {
      if (Array.isArray(content.blocks)) return content.blocks;
      return [];
    }
    return [];
  };

    useEffect(() => {
    const loadPerms = async () => {
      if (!user) {
        setCanEditWiki(false);
        return;
      }
      if (user.role === "admin") {
        setCanEditWiki(true);
        return;
      }
      try {
        const res = await api.get("/moderation/permissions/me");
        setCanEditWiki(!!res.data?.can_edit_wiki);
      } catch (err) {
        console.error(err);
        setCanEditWiki(false);
      }
    };
    loadPerms();
  }, [user]);
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const res = await api.get(`/wiki/id/${id}`);
        setArticle(res.data);
        setForm({
          title: res.data.title,
          summary: res.data.summary || "",
          cover_image: res.data.cover_image || "",
          category_id: res.data.category_id,
          status: res.data.status,
        });
        setBlocks(normalizeBlocks(res.data.content));
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

  const createDefaultBlock = (type) => {
    if (type === "columns") {
      return {
        type: "columns",
        left: { type: "paragraph", text: "" },
        right: { type: "image", url: "", alt: "", caption: "" },
      };
    }
    if (type === "infobox") {
      return {
        type: "infobox",
        title: "",
        image_url: "",
        items: [{ label: "", value: "" }],
      };
    }
    return { type, text: "", level: 2, items: [], url: "", alt: "", caption: "" };
  };

  const addBlock = (type) => {
    setBlocks((prev) => [...prev, createDefaultBlock(type)]);
  };

  const updateBlock = (idx, patch) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const removeBlock = (idx) => {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImageDrop = (idx, e, opts = {}) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (opts.side) {
      updateBlock(idx, {
        [opts.side]: { ...(blocks[idx]?.[opts.side] || {}), url, alt: file.name, caption: file.name, type: "image" },
      });
    } else if (opts.field) {
      updateBlock(idx, { [opts.field]: url });
    } else {
      updateBlock(idx, { url, alt: file.name, caption: file.name });
    }
  };

  const handleSave = async () => {
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    const payload = {
      title: form.title,
      summary: form.summary,
      content: safeBlocks,
      cover_image: form.cover_image,
      category_id: form.category_id,
      status: form.status,
    };

    const submit = (nextPayload) => {
      if (id) return api.patch(`/wiki/${id}`, nextPayload);
      return api.post("/wiki", nextPayload);
    };

    try {
      await submit(payload);
      navigate("/wiki");
    } catch (err) {
      const status = err?.response?.status;
      const suggested = err?.response?.data?.suggestedSlug;
      if (status === 409 && suggested) {
        const ok = window.confirm(
          `Nazov uz existuje. Pouzit alternativu "${suggested}"?`
        );
        if (!ok) return;
        try {
          await submit({ ...payload, slug: suggested });
          navigate("/wiki");
          return;
        } catch (innerErr) {
          console.error(innerErr);
        }
      } else {
        console.error(err);
      }
      alert("Chyba pri ukladani");
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
                border: "1px solid var(--card-border)",
                padding: 8,
                borderRadius: 8,
                marginBottom: 8,
                background: "var(--topic-bg)",
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
                  value={Array.isArray(b.items) ? b.items.join("\n") : ""}
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

              {b.type === "columns" && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 8 }}>
                      <div className="topic-meta" style={{ marginBottom: 6 }}>Left</div>
                      <select
                        value={b.left?.type || "paragraph"}
                        onChange={(e) =>
                          updateBlock(idx, { left: { type: e.target.value, text: "", url: "", alt: "", caption: "" } })
                        }
                      >
                        <option value="paragraph">Text</option>
                        <option value="image">Image</option>
                      </select>
                      {b.left?.type === "paragraph" && (
                        <textarea
                          rows={3}
                          value={b.left?.text || ""}
                          onChange={(e) => updateBlock(idx, { left: { ...b.left, text: e.target.value } })}
                          placeholder="Text"
                        />
                      )}
                      {b.left?.type === "image" && (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleImageDrop(idx, e, { side: "left" })}
                          style={{
                            border: "1px dashed #374151",
                            padding: 8,
                            borderRadius: 8,
                            marginTop: 6,
                          }}
                        >
                          <input
                            value={b.left?.url || ""}
                            onChange={(e) => updateBlock(idx, { left: { ...b.left, url: e.target.value } })}
                            placeholder="Image URL"
                          />
                          <input
                            value={b.left?.caption || ""}
                            onChange={(e) => updateBlock(idx, { left: { ...b.left, caption: e.target.value } })}
                            placeholder="Caption"
                          />
                          {b.left?.url && (
                            <div style={{ marginTop: 8 }}>
                              <img src={b.left.url} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 8 }}>
                      <div className="topic-meta" style={{ marginBottom: 6 }}>Right</div>
                      <select
                        value={b.right?.type || "paragraph"}
                        onChange={(e) =>
                          updateBlock(idx, { right: { type: e.target.value, text: "", url: "", alt: "", caption: "" } })
                        }
                      >
                        <option value="paragraph">Text</option>
                        <option value="image">Image</option>
                      </select>
                      {b.right?.type === "paragraph" && (
                        <textarea
                          rows={3}
                          value={b.right?.text || ""}
                          onChange={(e) => updateBlock(idx, { right: { ...b.right, text: e.target.value } })}
                          placeholder="Text"
                        />
                      )}
                      {b.right?.type === "image" && (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleImageDrop(idx, e, { side: "right" })}
                          style={{
                            border: "1px dashed #374151",
                            padding: 8,
                            borderRadius: 8,
                            marginTop: 6,
                          }}
                        >
                          <input
                            value={b.right?.url || ""}
                            onChange={(e) => updateBlock(idx, { right: { ...b.right, url: e.target.value } })}
                            placeholder="Image URL"
                          />
                          <input
                            value={b.right?.caption || ""}
                            onChange={(e) => updateBlock(idx, { right: { ...b.right, caption: e.target.value } })}
                            placeholder="Caption"
                          />
                          {b.right?.url && (
                            <div style={{ marginTop: 8 }}>
                              <img src={b.right.url} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {b.type === "infobox" && (
                <div style={{ marginTop: 6 }}>
                  <input
                    value={b.title || ""}
                    onChange={(e) => updateBlock(idx, { title: e.target.value })}
                    placeholder="Infobox title"
                  />
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleImageDrop(idx, e, { field: "image_url" })}
                    style={{
                      border: "1px dashed #374151",
                      padding: 8,
                      borderRadius: 8,
                      marginTop: 6,
                    }}
                  >
                    <input
                      value={b.image_url || ""}
                      onChange={(e) => updateBlock(idx, { image_url: e.target.value })}
                      placeholder="Image URL"
                    />
                    {b.image_url && (
                      <div style={{ marginTop: 8 }}>
                        <img src={b.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {(b.items || []).map((it, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
                        <input
                          value={it.label}
                          onChange={(e) => {
                            const items = [...(b.items || [])];
                            items[i] = { ...items[i], label: e.target.value };
                            updateBlock(idx, { items });
                          }}
                          placeholder="Label"
                        />
                        <input
                          value={it.value}
                          onChange={(e) => {
                            const items = [...(b.items || [])];
                            items[i] = { ...items[i], value: e.target.value };
                            updateBlock(idx, { items });
                          }}
                          placeholder="Value"
                        />
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => {
                            const items = (b.items || []).filter((_, ii) => ii !== i);
                            updateBlock(idx, { items });
                          }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => updateBlock(idx, { items: [...(b.items || []), { label: "", value: "" }] })}
                    >
                      + Add row
                    </button>
                  </div>
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
            <button className="btn-secondary" onClick={() => addBlock("columns")}>+ Columns</button>
            <button className="btn-secondary" onClick={() => addBlock("infobox")}>+ Infobox</button>
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
              {b.type === "list" && <ul>{(b.items || []).map((it, i) => <li key={i}>{it}</li>)}</ul>}
              {b.type === "image" && b.url && <img src={b.url} alt="" style={{ maxWidth: "100%" }} />}
              {b.type === "quote" && <blockquote>{b.text}</blockquote>}
              {b.type === "code" && <pre>{b.text}</pre>}
              {b.type === "columns" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    {b.left?.type === "paragraph" && <p>{b.left.text}</p>}
                    {b.left?.type === "image" && b.left?.url && (
                      <img src={b.left.url} alt="" style={{ maxWidth: "100%" }} />
                    )}
                  </div>
                  <div>
                    {b.right?.type === "paragraph" && <p>{b.right.text}</p>}
                    {b.right?.type === "image" && b.right?.url && (
                      <img src={b.right.url} alt="" style={{ maxWidth: "100%" }} />
                    )}
                  </div>
                </div>
              )}
              {b.type === "infobox" && (
                <div style={{ border: "1px solid var(--card-border)", borderRadius: 8, padding: 8 }}>
                  {b.title && <div style={{ fontWeight: 600, marginBottom: 6 }}>{b.title}</div>}
                  {b.image_url && (
                    <img src={b.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 6 }} />
                  )}
                  {(b.items || []).map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{it.label}</span>
                      <span>{it.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}





