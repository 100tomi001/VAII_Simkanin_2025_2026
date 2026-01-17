import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function TopicDetail() {
  const { id } = useParams();
  const topicId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(true);
  const [postingError, setPostingError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [initialPost, setInitialPost] = useState(null);
  const [replyToId, setReplyToId] = useState(null);

  const [allTags, setAllTags] = useState([]);
  const [editingTags, setEditingTags] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [modPerms, setModPerms] = useState(null);
  const [tagAudit, setTagAudit] = useState([]);
  const [badges, setBadges] = useState([]);
  const [expandedReplies, setExpandedReplies] = useState({}); // postId -> bool

  useEffect(() => {
    const load = async () => {
      try {
        const [topicRes, postsRes, tagsRes, badgesRes] = await Promise.all([
          api.get(`/topics/${topicId}`),
          api.get(`/posts/${topicId}`),
          api.get("/tags"),
          api.get("/badges"),
        ]);

        setTopic(topicRes.data);
        setAllTags(tagsRes.data);
        setBadges(badgesRes.data);

        const currentTagIds = (topicRes.data.tags || []).map((t) => t.id);
        setSelectedTagIds(currentTagIds);

        const allPosts = [...postsRes.data].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        setInitialPost(allPosts[0] || null);
        setPosts(allPosts.slice(1));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [topicId]);

  useEffect(() => {
    const loadPerms = async () => {
      if (!user) return;

      try {
        const permRes = await api.get("/moderation/permissions/me");
        setModPerms(permRes.data);

        if (user.role === "admin" || user.role === "moderator") {
          const auditRes = await api.get(`/moderation/tag-audit?topicId=${topicId}`);
          setTagAudit(auditRes.data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadPerms();
  }, [user, topicId]);

  const isModOrAdmin = ["admin", "moderator"].includes(user?.role);
  const showAudit = user?.role === "admin" || user?.role === "moderator";
  const tagNameById = (id) => allTags.find((t) => t.id === id)?.name || `#${id}`;
  const badgeById = (id) => badges.find((b) => b.id === id);

  const toggleTag = (id) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const saveTags = async () => {
    try {
      await api.patch(`/topics/${topicId}/tags`, { tagIds: selectedTagIds });
      const res = await api.get(`/topics/${topicId}`);
      setTopic(res.data);
      setEditingTags(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPost = async (e) => {
    e.preventDefault();
    setPostingError("");

    if (!user) {
      setPostingError("Na pridanie prispevku sa musis prihlasit.");
      return;
    }
    if (!newPost.trim()) return;

    try {
      await api.post(`/posts/${topicId}`, {
        content: newPost.trim(),
        parent_post_id: replyToId,
      });

      const res = await api.get(`/posts/${topicId}`);
      const allPosts = [...res.data].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      setInitialPost(allPosts[0] || null);
      setPosts(allPosts.slice(1));
      setNewPost("");
      setReplyToId(null);
    } catch (err) {
      console.error(err);
      setPostingError("Nepodarilo sa pridat prispevok.");
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await api.delete(`/posts/${postId}`);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, is_deleted: true, content: null } : p
        )
      );
    } catch (err) {
      console.error(err);
      setPostingError("Nepodarilo sa zmazat prispevok.");
    }
  };

  const confirmDeleteTopic = async () => {
    try {
      await api.delete(`/topics/${topicId}`);
      navigate("/forum");
    } catch (err) {
      console.error(err);
      setPostingError("Nepodarilo sa zmazat temu.");
    }
  };

  const startEditPost = (post) => {
    setEditingPostId(post.id);
    setEditContent(post.content || "");
    setPostingError("");
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditContent("");
  };

  const saveEditPost = async () => {
    if (!editContent.trim()) {
      setPostingError("Obsah prispevku nesmie byt prazdny.");
      return;
    }

    try {
      const res = await api.patch(`/posts/${editingPostId}`, {
        content: editContent.trim(),
      });

      const updated = res.data;
      setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));

      setEditingPostId(null);
      setEditContent("");
    } catch (err) {
      console.error(err);
      setPostingError("Nepodarilo sa upravit prispevok.");
    }
  };

  const thread = useMemo(() => {
    const map = new Map();
    posts.forEach((p) => map.set(p.id, { ...p, children: [] }));
    const roots = [];
    map.forEach((p) => {
      if (p.parent_post_id && map.has(p.parent_post_id)) {
        map.get(p.parent_post_id).children.push(p);
      } else {
        roots.push(p);
      }
    });
    return roots;
  }, [posts]);

  const toggleReplies = (postId) => {
    setExpandedReplies((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const renderProfileSide = (p) => {
    const showBadges = !p.author_hide_badges && p.badge_ids?.length > 0;

    return (
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, margin: "0 auto 6px auto",
          borderRadius: 10, background: "#111827",
          border: "1px solid #1f2937", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {p.author_avatar_url ? (
            <img src={p.author_avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "#9ca3af", fontSize: 22 }}>
              {p.author_nickname?.[0] || p.author_username?.[0]}
            </span>
          )}
        </div>
        <Link to={`/profile/${p.author_id}`} style={{ color: "#22c55e", fontWeight: 600 }}>
          {p.author_nickname || p.author_username}
        </Link>
        <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>
          Messages: {p.messages_count ?? 0}
        </div>

        {showBadges && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 6 }}>
            {p.badge_ids.map((id) => {
              const b = badgeById(id);
              if (!b) return null;
              return (
                <span key={id} title={b.name} style={{ width: 18, height: 18, borderRadius: 4, overflow: "hidden" }}>
                  {b.icon_url ? <img src={b.icon_url} alt={b.name} style={{ width: "100%", height: "100%" }} /> : "★"}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPost = (p, depth = 0) => {
    const canDeletePost =
      user &&
      (user.username === p.author_username ||
        user.role === "admin" ||
        (user.role === "moderator" && modPerms?.can_delete_posts));

    const hasReplies = p.children && p.children.length > 0;
    const isExpanded = !!expandedReplies[p.id];

    return (
      <div key={p.id} style={{ marginLeft: depth * 22, borderLeft: depth ? "2px solid #1f2937" : "none", paddingLeft: depth ? 12 : 0 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "stretch" }}>
          <div
            style={{
              width: 140,
              padding: "10px 12px",
              borderRadius: 12,
              background: "#0b1220",
              border: "1px solid #1f2937",
            }}
          >
            {renderProfileSide(p)}
          </div>

          <div
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              background: "#020617",
              border: "1px solid #1f2937",
              position: "relative",
            }}
          >
            {!p.is_deleted && canDeletePost && (
              <button
                onClick={() => handleDeletePost(p.id)}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 8,
                  border: "none",
                  background: "transparent",
                  color: "#f87171",
                  cursor: "pointer",
                  fontSize: 14,
                }}
                title="Zmazat prispevok"
              >
                x
              </button>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="topic-meta">{new Date(p.created_at).toLocaleString("sk-SK")}</span>
            </div>

            {editingPostId === p.id ? (
              <div>
                <textarea
                  rows={3}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    background: "#020617",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    padding: "6px 8px",
                    color: "#e5e7eb",
                    resize: "vertical",
                    width: "100%",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={saveEditPost} className="btn-primary">
                    Ulozit
                  </button>
                  <button type="button" onClick={cancelEditPost} className="btn-secondary">
                    Zrusit
                  </button>
                </div>
              </div>
            ) : (
              <>
                {p.is_deleted ? (
                  <div style={{ marginBottom: 6, fontStyle: "italic", color: "#94a3b8" }}>
                    message deleted
                  </div>
                ) : (
                  <div style={{ marginBottom: 6 }}>{p.content}</div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => setReplyToId(p.id)}
                    style={{ padding: 0, fontSize: 13 }}
                  >
                    Reply
                  </button>

                  {!p.is_deleted && user?.username === p.author_username && (
                    <button
                      type="button"
                      onClick={() => startEditPost(p)}
                      className="btn-link"
                      style={{ padding: 0, fontSize: 13 }}
                    >
                      Upravit
                    </button>
                  )}
                </div>

                {hasReplies && (
                  <button
                    type="button"
                    className="btn-link"
                    style={{ padding: 0, fontSize: 12, marginTop: 6 }}
                    onClick={() => toggleReplies(p.id)}
                  >
                    {isExpanded ? "Hide replies" : `Show replies (${p.children.length})`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {hasReplies && isExpanded && p.children.map((c) => renderPost(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="page">
      {!topic || loading ? (
        <p>Nacitavam temu...</p>
      ) : (
        <>
          <div className="page-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 className="page-title">{topic.title}</h1>
                <p className="page-subtitle">
                  autor{" "}
                  <Link to={`/profile/${topic.author_id}`}>{topic.author}</Link>{" "}
                  | {new Date(topic.created_at).toLocaleString("sk-SK")}
                </p>
              </div>

              {user?.username === topic.author && (
                <button onClick={() => setShowDeleteConfirm(true)} className="btn-secondary">
                  Zmazat temu
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {(topic.tags || []).map((tg) => (
              <span key={tg.id} className="tag-pill">
                {tg.name}
              </span>
            ))}
          </div>

          {isModOrAdmin && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn-secondary" onClick={() => setEditingTags((v) => !v)}>
                {editingTags ? "Zrusit tagy" : "Upravit tagy"}
              </button>

              {editingTags && (
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {allTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="tag-pill"
                      style={{
                        background: selectedTagIds.includes(tag.id) ? "#4f46e5" : "#020617",
                        borderColor: selectedTagIds.includes(tag.id) ? "#6366f1" : "#1f2937",
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                  <button type="button" className="btn-primary" onClick={saveTags}>
                    Ulozit tagy
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 520px" }}>
              {initialPost && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <h2>Uvodny prispevok</h2>

                  <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                    <div
                      style={{
                        width: 140,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#0b1220",
                        border: "1px solid #1f2937",
                      }}
                    >
                      {renderProfileSide(initialPost)}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#020617",
                        border: "1px solid #1f2937",
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <span className="topic-meta">
                          {new Date(initialPost.created_at).toLocaleString("sk-SK")}
                        </span>
                      </div>
                      <div>{initialPost.content}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <h2>Komentare</h2>
                {thread.length === 0 && (
                  <p className="topic-meta">Zatial ziadne komentare. Bud prvy.</p>
                )}
                <div style={{ marginTop: 12 }}>
                  {thread.map((p) => renderPost(p))}
                </div>
              </div>

              <div className="card">
                <h3>Napíš odpoveď</h3>

                {replyToId && (
                  <div style={{ marginBottom: 8, color: "#93c5fd" }}>
                    Replying to #{replyToId}{" "}
                    <button className="btn-link" onClick={() => setReplyToId(null)}>zrušiť</button>
                  </div>
                )}

                <form onSubmit={handleAddPost}>
                  <textarea
                    rows={4}
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    style={{
                      background: "#020617",
                      border: "1px solid #1f2937",
                      borderRadius: 10,
                      padding: "8px 10px",
                      color: "#e5e7eb",
                      resize: "vertical",
                    }}
                    placeholder="Napis svoj prispevok..."
                  />

                  <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                    Odoslat
                  </button>
                </form>

                {postingError && <p style={{ color: "salmon", marginTop: 8 }}>{postingError}</p>}

                <p style={{ marginTop: 8 }}>
                  <Link to="/forum" className="btn-link">
                    Spat na forum
                  </Link>
                </p>
              </div>
            </div>

            {showAudit && (
              <div style={{ flex: "1 1 260px" }} className="card">
                <h3>Tag edit history</h3>
                {tagAudit.length === 0 ? (
                  <p className="topic-meta">Zatial nic.</p>
                ) : (
                  tagAudit.map((a) => (
                    <div key={a.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>
                        {a.changed_by} | {new Date(a.created_at).toLocaleString("sk-SK")}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        old: {a.old_tag_ids.map(tagNameById).join(", ") || "-"}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        new: {a.new_tag_ids.map(tagNameById).join(", ") || "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#1f2937",
              padding: "24px",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "380px",
              textAlign: "center",
              border: "1px solid #374151",
            }}
          >
            <h2 style={{ marginBottom: 12 }}>Zmazat temu?</h2>
            <p style={{ marginBottom: 24 }}>
              Naozaj chces natrvalo odstranit tuto temu aj so vsetkymi prispevkami?
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                Zrusit
              </button>

              <button
                onClick={confirmDeleteTopic}
                className="btn-primary"
                style={{ background: "#ef4444", borderColor: "#ef4444" }}
              >
                Zmazat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
