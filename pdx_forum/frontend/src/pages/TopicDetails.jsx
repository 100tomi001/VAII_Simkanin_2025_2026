import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const isImageIcon = (icon) =>
  typeof icon === "string" &&
  (icon.startsWith("http") || icon.startsWith("blob:") || icon.startsWith("data:"));

const mapPostReactions = (rows) => {
  const map = {};
  (rows || []).forEach((r) => {
    if (!map[r.post_id]) map[r.post_id] = {};
    map[r.post_id][r.reaction_id] = {
      cnt: Number(r.cnt || 0),
      users: Array.isArray(r.users) ? r.users : [],
    };
  });
  return map;
};

const mapTopicReactions = (rows) => {
  const map = {};
  (rows || []).forEach((r) => {
    map[r.reaction_id] = {
      cnt: Number(r.cnt || 0),
      users: Array.isArray(r.users) ? r.users : [],
    };
  })
  return map;
};

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
  const [expandedReplies, setExpandedReplies] = useState({});
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [commentPage, setCommentPage] = useState(1);
  const [commentPageSize, setCommentPageSize] = useState(10);

  const [reactions, setReactions] = useState([]);
  const [postReactions, setPostReactions] = useState({});
  const [topicReactions, setTopicReactions] = useState({});
  const [isTopicFollowed, setIsTopicFollowed] = useState(false);
  const [reportedPostIds, setReportedPostIds] = useState(new Set());
  const [openReactionPicker, setOpenReactionPicker] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [
          topicRes,
          postsRes,
          tagsRes,
          badgesRes,
          reactionsRes,
          postReactRes,
          topicReactRes,
        ] = await Promise.all([
          api.get(`/topics/${topicId}`),
          api.get(`/posts/${topicId}`),
          api.get("/tags"),
          api.get("/badges"),
          api.get("/reactions"),
          api.get(`/reactions/posts/summary?topicId=${topicId}`),
          api.get(`/reactions/topic/${topicId}`),
        ]);

        setTopic(topicRes.data);
        setAllTags(tagsRes.data);
        setBadges(badgesRes.data);
        setReactions(reactionsRes.data);
        setPostReactions(mapPostReactions(postReactRes.data));
        setTopicReactions(mapTopicReactions(topicReactRes.data));

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
    setCommentPage(1);
  }, [commentPageSize, topicId]);

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

  useEffect(() => {
    const loadFollow = async () => {
      if (!user) {
        setIsTopicFollowed(false);
        return;
      }
      try {
        const r = await api.get(`/follows/topics/${topicId}`);
        setIsTopicFollowed(!!r.data?.following);
      } catch (err) {
        console.error(err);
      }
    };
    loadFollow();
  }, [user, topicId]);

  const isModOrAdmin = ["admin", "moderator"].includes(user?.role);
  const canModerateTopic =
    user?.role === "admin" || (user?.role === "moderator" && modPerms?.can_manage_tags);
  const showAudit = user?.role === "admin" || user?.role === "moderator";
  const tagNameById = (id) => allTags.find((t) => t.id === id)?.name || `#${id}`;
  const badgeById = (id) => badges.find((b) => b.id === id);

  useEffect(() => {
    const loadReports = async () => {
      if (!isModOrAdmin) {
        setReportedPostIds(new Set());
        return;
      }
      try {
        const res = await api.get("/reports", { params: { status: "open" } });
        const ids = new Set();
        (res.data || []).forEach((r) => {
          if (Number(r.topic_id) !== topicId) return;
          if (r.target_post_id) ids.add(Number(r.target_post_id));
          if (r.context_post_id) ids.add(Number(r.context_post_id));
        });
        setReportedPostIds(ids);
      } catch (err) {
        console.error(err);
      }
    };

    loadReports();
  }, [isModOrAdmin, topicId]);

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

  const cancelTagEdit = () => {
    const currentTagIds = (topic?.tags || []).map((t) => t.id);
    setSelectedTagIds(currentTagIds);
    setEditingTags(false);
  };

  const toggleSticky = async () => {
    try {
      const res = await api.patch(`/topics/${topicId}/moderation`, {
        is_sticky: !topic?.is_sticky,
      });
      setTopic((prev) => ({ ...prev, is_sticky: res.data.is_sticky }));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLocked = async () => {
    try {
      const res = await api.patch(`/topics/${topicId}/moderation`, {
        is_locked: !topic?.is_locked,
      });
      setTopic((prev) => ({ ...prev, is_locked: res.data.is_locked }));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTopicFollow = async () => {
    if (!user) {
      setPostingError("Login required to follow.");
      return;
    }
    try {
      if (isTopicFollowed) {
        await api.delete(`/follows/topics/${topicId}`);
        setIsTopicFollowed(false);
      } else {
        await api.post(`/follows/topics/${topicId}`);
        setIsTopicFollowed(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const reloadPostReactions = async () => {
    try {
      const r = await api.get(`/reactions/posts/summary?topicId=${topicId}`);
      setPostReactions(mapPostReactions(r.data));
    } catch (err) {
      console.error(err);
    }
  };

  const reloadTopicReactions = async () => {
    try {
      const r = await api.get(`/reactions/topic/${topicId}`);
      setTopicReactions(mapTopicReactions(r.data));
    } catch (err) {
      console.error(err);
    }
  };

  const togglePostReaction = async (postId, reactionId) => {
    if (!user) {
      setPostingError("Login required to react.");
      return;
    }
    setPostReactions((prev) => {
      const next = { ...prev };
      const bucket = { ...(next[postId] || {}) };
      const entry = bucket[reactionId]
        ? { ...bucket[reactionId], users: [...(bucket[reactionId].users || [])] }
        : { cnt: 0, users: [] };
      const idx = entry.users.indexOf(user.id);
      if (idx >= 0) {
        entry.users.splice(idx, 1);
      } else {
        entry.users.push(user.id);
      }
      entry.cnt = entry.users.length;
      if (entry.cnt <= 0) {
        delete bucket[reactionId];
      } else {
        bucket[reactionId] = entry;
      }
      next[postId] = bucket;
      return next;
    });

    try {
      await api.post(`/reactions/post/${postId}`, { reactionId });
    } catch (err) {
      console.error(err);
      reloadPostReactions();
    }
  };

  const toggleTopicReaction = async (reactionId) => {
    if (!user) {
      setPostingError("Login required to react.");
      return;
    }
    setTopicReactions((prev) => {
      const next = { ...prev };
      const entry = next[reactionId]
        ? { ...next[reactionId], users: [...(next[reactionId].users || [])] }
        : { cnt: 0, users: [] };
      const idx = entry.users.indexOf(user.id);
      if (idx >= 0) {
        entry.users.splice(idx, 1);
      } else {
        entry.users.push(user.id);
      }
      entry.cnt = entry.users.length;
      if (entry.cnt <= 0) {
        delete next[reactionId];
      } else {
        next[reactionId] = entry;
      }
      return next;
    });

    try {
      await api.post(`/reactions/topic/${topicId}`, { reactionId });
    } catch (err) {
      console.error(err);
      reloadTopicReactions();
    }
  };

  const handleAddPost = async (e) => {
    e.preventDefault();
    setPostingError("");

    if (!user) {
      setPostingError("Login required to post.");
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
      reloadPostReactions();
    } catch (err) {
      console.error(err);
      setPostingError(err.response?.data?.message || "Failed to create post.");
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
      setPostingError("Failed to delete post.");
    }
  };

  const confirmDeleteTopic = async () => {
    try {
      await api.delete(`/topics/${topicId}`);
      navigate("/forum");
    } catch (err) {
      console.error(err);
      setPostingError("Failed to delete topic.");
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
      setPostingError("Content cannot be empty.");
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
      setPostingError("Failed to update post.");
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

  const totalThreads = thread.length;
  const totalComments = posts.length;
  const totalCommentPages = Math.max(1, Math.ceil(totalThreads / commentPageSize));
  const pagedThread = useMemo(() => {
    const start = (commentPage - 1) * commentPageSize;
    return thread.slice(start, start + commentPageSize);
  }, [thread, commentPage, commentPageSize]);

  useEffect(() => {
    if (commentPage > totalCommentPages) {
      setCommentPage(totalCommentPages);
    }
  }, [commentPage, totalCommentPages]);

  const toggleReplies = (postId) => {
    setExpandedReplies((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const openReport = (target) => {
    if (!user) {
      setPostingError("Login required to report.");
      return;
    }
    setReportMessage("");
    setReportReason("");
    setReportTarget(target);
  };

  const submitReport = async () => {
    if (!user) {
      setPostingError("Login required to report.");
      return;
    }
    const cleanReason = reportReason.trim();
    if (cleanReason.length < 3) {
      setReportMessage("Reason too short.");
      return;
    }
    if (!reportTarget) return;
    const payload = { reason: cleanReason };
    if (reportTarget.type === "post") {
      payload.postId = reportTarget.postId;
    } else if (reportTarget.type === "user") {
      payload.userId = reportTarget.userId;
      if (reportTarget.contextPostId) payload.contextPostId = reportTarget.contextPostId;
    }

    try {
      await api.post("/reports", payload);
      setReportMessage("Report sent.");
      setReportTarget(null);
      setReportReason("");
    } catch (err) {
      console.error(err);
      setReportMessage("Failed to send report.");
    }
  };

  const openReplyForm = (postId) => {
    if (topic.is_locked) {
      setPostingError("Topic is locked.");
      return;
    }
    setReplyToId(postId);
    setNewPost("");
  };

  const cancelReplyForm = () => {
    setReplyToId(null);
    setNewPost("");
  };

  const renderReplyForm = () => (
    <form onSubmit={handleAddPost} style={{ marginTop: 8 }}>
      <textarea
        rows={3}
        value={newPost}
        onChange={(e) => setNewPost(e.target.value)}
        style={{
          background: "var(--input-bg)",
          border: "1px solid var(--card-border)",
          borderRadius: 10,
          padding: "8px 10px",
          color: "var(--text)",
          resize: "vertical",
          width: "100%",
        }}
        placeholder="Write a reply..."
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="submit" className="btn-primary">
          Send
        </button>
        <button type="button" className="btn-secondary" onClick={cancelReplyForm}>
          Cancel
        </button>
      </div>
    </form>
  );

  const renderCommentPagination = () => {
    if (totalCommentPages <= 1) return null;
    return (
      <div className="pagination" style={{ marginTop: 12 }}>
        <button
          className="btn-secondary"
          disabled={commentPage <= 1}
          onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <div className="topic-meta">
          Page {commentPage} / {totalCommentPages}
        </div>
        <button
          className="btn-secondary"
          disabled={commentPage >= totalCommentPages}
          onClick={() => setCommentPage((p) => Math.min(totalCommentPages, p + 1))}
        >
          Next
        </button>
      </div>
    );
  };

  const renderProfileSide = (p) => {
    const showBadges = !p.author_hide_badges && p.badge_ids?.length > 0;
    const joined = p.author_created_at
      ? new Date(p.author_created_at).toLocaleDateString("sk-SK")
      : "N/A";

    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 6px auto",
            borderRadius: 10,
            background: "var(--chip-bg)",
            border: "1px solid var(--card-border)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {p.author_avatar_url ? (
            <img src={p.author_avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 22 }}>
              {p.author_nickname?.[0] || p.author_username?.[0]}
            </span>
          )}
        </div>
        <Link to={`/profile/${p.author_id}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
          {p.author_nickname || p.author_username}
        </Link>
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
          {p.author_role || "user"}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
          Messages: {p.messages_count ?? 0}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Karma: {p.author_karma ?? 0}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Joined: {joined}
        </div>

        {showBadges && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 6 }}>
            {p.badge_ids.map((bid) => {
              const b = badgeById(bid);
              if (!b) return null;
              return (
                <span key={bid} title={b.name} style={{ width: 18, height: 18, borderRadius: 4, overflow: "hidden" }}>
                  {b.icon_url ? <img src={b.icon_url} alt={b.name} style={{ width: "100%", height: "100%" }} /> : "?"}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderReactionButton = (r, summaryMap, onToggle) => {
    const entry = summaryMap?.[r.id];
    const count = entry?.cnt || 0;
    const reacted = !!user && (entry?.users || []).includes(user.id);
    return (
      <button
        key={r.id}
        type="button"
        className={`reaction-btn ${reacted ? "active" : ""}`}
        onClick={() => onToggle(r.id)}
      >
        {r.icon ? (
          isImageIcon(r.icon) ? (
            <img src={r.icon} alt={r.label} />
          ) : (
            <span className="reaction-emoji">{r.icon}</span>
          )
        ) : (
          <span className="reaction-emoji">{(r.label || "+")[0]}</span>
        )}
        {count > 0 && <span className="reaction-count">{count}</span>}
      </button>
    );
  };

  const renderReactionBar = (summaryMap, onToggle, pickerKey) => {
    const likeReaction = reactions.find((r) => r.key === "like");
    const customReactions = reactions.filter((r) => r.key !== "like");
    const shown = [];
    if (likeReaction) shown.push(likeReaction);
    customReactions.forEach((r) => {
      const count = summaryMap?.[r.id]?.cnt || 0;
      if (count > 0) shown.push(r);
    });

    const isPickerOpen = openReactionPicker === pickerKey;

    return (
      <div className="reaction-bar">
        {shown.map((r) => renderReactionButton(r, summaryMap, onToggle))}
        {customReactions.length > 0 && (
          <div className="reaction-picker">
            <button
              type="button"
              className="reaction-btn"
              onClick={() =>
                setOpenReactionPicker((prev) => (prev === pickerKey ? null : pickerKey))
              }
              title="Add reaction"
            >
              +
            </button>
            {isPickerOpen && (
              <div className="reaction-picker-menu">
                {customReactions.map((r) =>
                  renderReactionButton(r, summaryMap, (rid) => {
                    onToggle(rid);
                    setOpenReactionPicker(null);
                  })
                )}
              </div>
            )}
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
      <div
        key={p.id}
        id={`post-${p.id}`}
        style={{
          marginLeft: depth * 22,
          borderLeft: depth ? "2px solid var(--card-border)" : "none",
          paddingLeft: depth ? 12 : 0,
        }}
      >
        <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "stretch" }}>
          <div
            style={{
              width: 160,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--topic-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            {renderProfileSide(p)}
          </div>

          <div
            className={reportedPostIds.has(p.id) ? "reported-outline" : ""}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
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
                title="Delete post"
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
                    background: "var(--input-bg)",
                    border: "1px solid var(--card-border)",
                    borderRadius: 8,
                    padding: "6px 8px",
                    color: "var(--text)",
                    resize: "vertical",
                    width: "100%",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={saveEditPost} className="btn-primary">
                    Save
                  </button>
                  <button type="button" onClick={cancelEditPost} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {p.is_deleted ? (
                  <div style={{ marginBottom: 6, fontStyle: "italic", color: "var(--text-muted)" }}>
                    message deleted
                  </div>
                ) : (
                  <div style={{ marginBottom: 6 }}>{p.content}</div>
                )}

                {renderReactionBar(
                  postReactions[p.id],
                  (rid) => togglePostReaction(p.id, rid),
                  `post-${p.id}`
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => openReplyForm(p.id)}
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
                      Edit
                    </button>
                  )}

                  {!p.is_deleted && user && (
                    <button
                      type="button"
                      onClick={() => openReport({ type: "post", postId: p.id })}
                      className="btn-link"
                      style={{ padding: 0, fontSize: 13 }}
                    >
                      Report post
                    </button>
                  )}
                  {!p.is_deleted && user && (
                    <button
                      type="button"
                      onClick={() =>
                        openReport({ type: "user", userId: p.author_id, contextPostId: p.id })
                      }
                      className="btn-link"
                      style={{ padding: 0, fontSize: 13 }}
                    >
                      Report user
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
                {(reportTarget?.type === "post" && reportTarget.postId === p.id) ||
                (reportTarget?.type === "user" && reportTarget.contextPostId === p.id) ? (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="topic-meta">
                      {reportTarget.type === "post"
                        ? `Reporting post #${p.id}`
                        : `Reporting user ${p.author_nickname || p.author_username}`}
                    </div>
                    <textarea
                      rows={2}
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      placeholder="Reason for report"
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn-secondary" onClick={submitReport}>
                        Send report
                      </button>
                      <button type="button" className="btn-link" onClick={() => setReportTarget(null)}>
                        Cancel
                      </button>
                    </div>
                    {reportMessage && <div className="topic-meta">{reportMessage}</div>}
                  </div>
                ) : null}

                {replyToId === p.id && (
                  <div style={{ marginTop: 8 }}>
                    <div className="topic-meta">Replying to #{p.id}</div>
                    {renderReplyForm()}
                  </div>
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
        <p>Loading topic...</p>
      ) : (
        <>
          <div className="page-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h1 className="page-title">{topic.title}</h1>
                <p className="page-subtitle">
                  author{" "}
                  <Link to={`/profile/${topic.author_id}`}>{topic.author}</Link>{" "}
                  | {new Date(topic.created_at).toLocaleString("sk-SK")}
                </p>
                {topic.category_name && (
                  <div className="topic-meta" style={{ marginTop: 6 }}>
                    Category: {topic.category_name}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {user && (
                  <button onClick={toggleTopicFollow} className="btn-secondary">
                    {isTopicFollowed ? "Unfollow" : "Follow"}
                  </button>
                )}
                {canModerateTopic && (
                  <>
                    <button onClick={toggleSticky} className="btn-secondary">
                      {topic.is_sticky ? "Unpin" : "Pin"}
                    </button>
                    <button onClick={toggleLocked} className="btn-secondary">
                      {topic.is_locked ? "Unlock" : "Lock"}
                    </button>
                  </>
                )}

                {(user?.username === topic.author ||
                  user?.role === "admin" ||
                  (user?.role === "moderator" && modPerms?.can_delete_posts)) && (
                  <button onClick={() => setShowDeleteConfirm(true)} className="btn-secondary">
                    Delete topic
                  </button>
                )}
              </div>
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
                {editingTags ? "Cancel tags" : "Edit tags"}
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
                        background: selectedTagIds.includes(tag.id) ? "var(--accent)" : "var(--chip-bg)",
                        borderColor: selectedTagIds.includes(tag.id) ? "var(--accent)" : "var(--chip-border)",
                        color: selectedTagIds.includes(tag.id) ? "#fff" : "var(--text)",
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                  <button type="button" className="btn-primary" onClick={saveTags}>
                    Save tags
                  </button>
                  <button type="button" className="btn-secondary" onClick={cancelTagEdit}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 520px" }}>
              {initialPost && (
                <div className="card" style={{ marginBottom: 16 }} id={`post-${initialPost.id}`}>
                  <h2>Opening post</h2>

                  <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                    <div
                      style={{
                        width: 160,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "var(--topic-bg)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      {renderProfileSide(initialPost)}
                    </div>

                    <div
                      className={reportedPostIds.has(initialPost.id) ? "reported-outline" : ""}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "var(--input-bg)",
                        border: "1px solid var(--card-border)",
                      }}
                    >
                      <div style={{ marginBottom: 6 }}>
                        <span className="topic-meta">
                          {new Date(initialPost.created_at).toLocaleString("sk-SK")}
                        </span>
                      </div>
                      <div>{initialPost.content}</div>
                      {renderReactionBar(
                        topicReactions,
                        (rid) => toggleTopicReaction(rid),
                        `topic-${topicId}`
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ padding: 0, fontSize: 13 }}
                          onClick={() => openReplyForm(initialPost.id)}
                        >
                          Reply
                        </button>
                        {user && (
                          <button
                            type="button"
                            className="btn-link"
                            style={{ padding: 0, fontSize: 13 }}
                            onClick={() => openReport({ type: "post", postId: initialPost.id })}
                          >
                            Report post
                          </button>
                        )}
                        {user && (
                          <button
                            type="button"
                            className="btn-link"
                            style={{ padding: 0, fontSize: 13 }}
                            onClick={() =>
                              openReport({
                                type: "user",
                                userId: initialPost.author_id,
                                contextPostId: initialPost.id,
                              })
                            }
                          >
                            Report user
                          </button>
                        )}
                      </div>
                      {(reportTarget?.type === "post" && reportTarget.postId === initialPost.id) ||
                      (reportTarget?.type === "user" && reportTarget.contextPostId === initialPost.id) ? (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div className="topic-meta">
                            {reportTarget.type === "post"
                              ? `Reporting post #${initialPost.id}`
                              : `Reporting user ${initialPost.author_nickname || initialPost.author_username}`}
                          </div>
                          <textarea
                            rows={2}
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="Reason for report"
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" className="btn-secondary" onClick={submitReport}>
                              Send report
                            </button>
                            <button type="button" className="btn-link" onClick={() => setReportTarget(null)}>
                              Cancel
                            </button>
                          </div>
                          {reportMessage && <div className="topic-meta">{reportMessage}</div>}
                        </div>
                      ) : null}
                      {replyToId === initialPost.id && (
                        <div style={{ marginTop: 8 }}>
                          <div className="topic-meta">Replying to #{initialPost.id}</div>
                          {renderReplyForm()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <h2>Comments</h2>
                    <div className="topic-meta">
                      {totalComments} comments | {totalThreads} threads
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="topic-meta">Threads per page</span>
                    <select
                      value={commentPageSize}
                      onChange={(e) => setCommentPageSize(Number(e.target.value))}
                    >
                      {[5, 10, 15, 20].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {thread.length === 0 && (
                  <p className="topic-meta">No comments yet.</p>
                )}
                <div style={{ marginTop: 12 }}>
                  {pagedThread.map((p) => renderPost(p))}
                </div>
                {renderCommentPagination()}
              </div>

              <div className="card">
                <h3>Reply</h3>
                {topic.is_locked ? (
                  <p className="topic-meta">Topic is locked.</p>
                ) : replyToId ? (
                  <p className="topic-meta">Reply form is open above.</p>
                ) : (
                  renderReplyForm()
                )}

                {postingError && <p style={{ color: "salmon", marginTop: 8 }}>{postingError}</p>}

                <p style={{ marginTop: 8 }}>
                  <Link to="/forum" className="btn-link">
                    Back to forum
                  </Link>
                </p>
              </div>
            </div>

            {showAudit && (
              <div style={{ flex: "1 1 260px" }} className="card">
                <h3>Tag edit history</h3>
                {tagAudit.length === 0 ? (
                  <p className="topic-meta">Nothing yet.</p>
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
              background: "var(--chip-bg)",
              padding: "24px",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "380px",
              textAlign: "center",
              border: "1px solid #374151",
            }}
          >
            <h2 style={{ marginBottom: 12 }}>Delete topic?</h2>
            <p style={{ marginBottom: 24 }}>
              This will remove the topic and all posts.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                Cancel
              </button>

              <button
                onClick={confirmDeleteTopic}
                className="btn-primary"
                style={{ background: "#ef4444", borderColor: "#ef4444" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}