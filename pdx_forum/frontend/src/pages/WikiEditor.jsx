import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ConfirmModal from "../components/ConfirmModal";

const TITLE_MIN = 3;
const TITLE_MAX = 120;
const SUMMARY_MAX = 300;
const COVER_MAX = 500;

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export default function WikiEditor() {
  const { id } = useParams(); // ak id existuje, editujeme; inak create
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [canEditWiki, setCanEditWiki] = useState(false);
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(!!id);
  const [blocks, setBlocks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: "", summary: "", cover_image: "", category_id: null, status: "draft" });
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [slugConflict, setSlugConflict] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
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

  const isEditor = user && (user.role === "admin" || canEditWiki);
  const titleLen = form.title.trim().length;
  const summaryLen = form.summary.length;
  const coverLen = form.cover_image.length;
  const titleValid = titleLen >= TITLE_MIN && titleLen <= TITLE_MAX;
  const summaryValid = summaryLen <= SUMMARY_MAX;
  const coverValid = coverLen <= COVER_MAX;
  const canSave = titleValid && summaryValid && coverValid && !uploading;
  const slugPreview = slugify(form.title);

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

  const loadCategories = async () => {
    try {
      const res = await api.get("/wiki/categories/list");
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadArticle = async (articleId) => {
    if (!articleId) return;
    setLoading(true);
    try {
      const res = await api.get(`/wiki/id/${articleId}`);
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

  const loadHistory = async (articleId) => {
    if (!articleId) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/wiki/${articleId}/history`);
      setHistory(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
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
    loadCategories();
  }, []);

  useEffect(() => {
    if (!id) return;
    loadArticle(id);
    loadHistory(id);
  }, [id]);

  useEffect(() => {
    if (slugConflict) setSlugConflict(null);
  }, [form.title]);

  if (!isEditor) return <div className="page"><p>Wiki editors only.</p></div>;
  if (loading) return <div className="page"><p>Loading...</p></div>;

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

  const moveBlock = (from, to) => {
    if (from === to || from === null || to === null) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleDragStart = (idx, e) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (idx, e) => {
    e.preventDefault();
    if (idx !== dropIndex) setDropIndex(idx);
  };

  const handleDrop = (idx, e) => {
    e.preventDefault();
    moveBlock(dragIndex, idx);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const uploadWikiFile = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      setUploading(true);
      const res = await api.post("/uploads/wiki", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data?.url;
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Upload zlyhal.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageDrop = async (idx, e, opts = {}) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = await uploadWikiFile(file);
    if (!url) return;
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

  const handleSave = async (overrideSlug) => {
    if (!titleValid) {
      toast.error("Title length is invalid.");
      return;
    }
    if (!summaryValid) {
      toast.error("Summary is too long.");
      return;
    }
    if (!coverValid) {
      toast.error("Cover image URL is too long.");
      return;
    }
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    const payload = {
      title: form.title,
      summary: form.summary,
      content: safeBlocks,
      cover_image: form.cover_image,
      category_id: form.category_id,
      status: form.status,
      ...(overrideSlug ? { slug: overrideSlug } : {}),
    };

    const submit = (nextPayload) => {
      if (id) return api.patch(`/wiki/${id}`, nextPayload);
      return api.post("/wiki", nextPayload);
    };

    try {
      setSlugConflict(null);
      await submit(payload);
      toast.success("Clanok ulozeny.");
      navigate("/wiki");
    } catch (err) {
      const status = err?.response?.status;
      const suggested = err?.response?.data?.suggestedSlug;
      if (status === 409 && suggested) {
        setSlugConflict({ suggested });
        return;
      } else {
        console.error(err);
      }
      toast.error("Chyba pri ukladani.");
    }
  };

  const handleRollback = async (historyId) => {
    if (!id) return;
    setConfirm({
      title: "Rollback?",
      message: "Rollback to this version?",
      confirmText: "Rollback",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await api.post(`/wiki/${id}/rollback/${historyId}`);
          toast.success("Rolled back.");
          await loadArticle(id);
          await loadHistory(id);
        } catch (err) {
          console.error(err);
          toast.error("Rollback failed.");
        }
      },
    });
  };

  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
      <div className="card">
        <h1>{id ? "Edit article" : "New article"}</h1>
        <label className="topic-meta">Title</label>
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={TITLE_MAX}
        />
        <div className="field-hint">
          <span>{titleLen}/{TITLE_MAX}</span>
          <span>Slug: {slugPreview || "-"}</span>
        </div>
        {slugConflict?.suggested && (
          <div className="wiki-alert" style={{ marginTop: 8 }}>
            <div>
              Title already exists. Suggested slug:{" "}
              <code>{slugConflict.suggested}</code>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleSave(slugConflict.suggested)}
              >
                Use suggested
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => setSlugConflict(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <label className="topic-meta" style={{ marginTop: 10 }}>Summary</label>
        <textarea
          placeholder="Summary"
          rows={2}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          maxLength={SUMMARY_MAX}
        />
        <div className="field-hint">
          <span>{summaryLen}/{SUMMARY_MAX}</span>
        </div>
        <label className="topic-meta" style={{ marginTop: 10 }}>Cover image URL</label>
        <input
          type="text"
          placeholder="Cover image URL"
          value={form.cover_image}
          onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
          maxLength={COVER_MAX}
        />
        <div className="field-hint">
          <span>{coverLen}/{COVER_MAX}</span>
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            const file = e.dataTransfer?.files?.[0];
            if (!file) return;
            const url = await uploadWikiFile(file);
            if (url) setForm((prev) => ({ ...prev, cover_image: url }));
          }}
          style={{
            border: "1px dashed #374151",
            padding: 8,
            borderRadius: 8,
            marginTop: 6,
            opacity: uploading ? 0.7 : 1,
          }}
        >
          <div className="topic-meta">Drag & drop cover image here</div>
        </div>
        <label className="topic-meta" style={{ marginTop: 10 }}>Category</label>
        <select
          value={form.category_id || ""}
          onChange={(e) =>
            setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="topic-meta" style={{ marginTop: 10 }}>Status</label>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>

        <div style={{ marginTop: 12 }}>
          <h3>Content</h3>
          {blocks.map((b, idx) => (
            <div
              key={idx}
              className={`block-editor ${dropIndex === idx ? "drag-over" : ""}`}
              onDragOver={(e) => handleDragOver(idx, e)}
              onDrop={(e) => handleDrop(idx, e)}
              style={{
                border: "1px solid var(--card-border)",
                padding: 8,
                borderRadius: 8,
                marginBottom: 8,
                background: "var(--topic-bg)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="drag-handle"
                    draggable
                    onDragStart={(e) => handleDragStart(idx, e)}
                    onDragEnd={handleDragEnd}
                    title="Drag to reorder"
                  >
                    ::
                  </span>
                  <strong>{b.type}</strong>
                </div>
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
                  placeholder="Items (one per line)"
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
                    opacity: uploading ? 0.7 : 1,
                  }}
                >
                  <p className="topic-meta" style={{ marginBottom: 6 }}>
                    Drag & drop image here or paste URL
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
                            opacity: uploading ? 0.7 : 1,
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
                            opacity: uploading ? 0.7 : 1,
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
                      opacity: uploading ? 0.7 : 1,
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

        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => handleSave()} disabled={!canSave}>
          Save
        </button>
        {!canSave && (
          <div className="field-hint" style={{ marginTop: 6 }}>
            <span>Title 3-120, summary &lt;= 300, cover &lt;= 500</span>
          </div>
        )}
        {uploading && <div className="topic-meta" style={{ marginTop: 6 }}>Nahravam obrazok...</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

        {id && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>History</h3>
              <span className="topic-meta">{history.length} entries</span>
            </div>
            {historyLoading ? (
              <p className="topic-meta">Loading...</p>
            ) : history.length === 0 ? (
              <p className="topic-meta">No history yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {history.map((h) => (
                  <div key={h.id} className="tag-audit-item">
                    <div style={{ fontWeight: 600 }}>{h.title}</div>
                    <div className="topic-meta">
                      {h.changed_by_name || "unknown"} | {new Date(h.created_at).toLocaleString("sk-SK")}
                    </div>
                    <div className="topic-meta">Status: {h.status}</div>
                    <button className="btn-secondary" type="button" onClick={() => handleRollback(h.id)}>
                      Rollback
                    </button>
                  </div>
                ))}
              </div>
            )}
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









