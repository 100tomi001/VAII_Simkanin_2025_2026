import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import Tag from "../components/Tag";
import { useAuth } from "../context/AuthContext";

const TABS = ["Home", "Trending", "Latest threads", "New posts"];

export default function Forum() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedTags, setSelectedTags] = useState([]);
  const [tagMode, setTagMode] = useState("or");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hubCategories, setHubCategories] = useState([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reportedTopicIds, setReportedTopicIds] = useState(new Set());
  const pageSize = 15;
  const isModOrAdmin = ["admin", "moderator"].includes(user?.role);
  const searchInputRef = useRef(null);
  const hasFilters = query || selectedTags.length > 0 || selectedCategory;
  const selectedCategoryLabel =
    categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory;
  const filterParts = [];
  if (query) filterParts.push(`search "${query}"`);
  if (selectedCategoryLabel) filterParts.push(`category "${selectedCategoryLabel}"`);
  if (selectedTags.length > 0) {
    const modeLabel = tagMode === "and" ? "all" : "any";
    filterParts.push(`tags (${modeLabel}) "${selectedTags.join(", ")}"`);
  }
  const filterSummary = filterParts.join(", ");
  const highlight = (text, q) => {
    const safeText = String(text || "");
    const safeQuery = String(q || "").trim();
    if (!safeQuery || safeQuery.length < 2) return safeText;
    const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = safeText.split(new RegExp(`(${escaped})`, "ig"));
    return parts.map((part, i) =>
      part.toLowerCase() === safeQuery.toLowerCase() ? (
        <mark key={i} className="search-highlight">{part}</mark>
      ) : (
        part
      )
    );
  };

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        e.target?.isContentEditable;
      if (!isTyping && e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const loadMeta = async () => {
      setMetaLoading(true);
      try {
        const [tagsRes, catsRes, hubRes] = await Promise.all([
          api.get("/tags"),
          api.get("/categories"),
          api.get("/categories/hub"),
        ]);
        setTags(tagsRes.data);
        setCategories(catsRes.data);
        setHubCategories(hubRes.data);
      } catch (err) {
        console.error("Load meta error", err);
      } finally {
        setMetaLoading(false);
      }
    };
    loadMeta();
  }, []);

  const sortKey = useMemo(() => {
    if (activeTab === "Trending") return "trending";
    if (activeTab === "Latest threads") return "latest";
    if (activeTab === "New posts") return "new";
    return "home";
  }, [activeTab]);

  useEffect(() => {
    const loadTopics = async () => {
      setLoading(true);
      try {
        const res = await api.get("/topics", {
          params: {
            q: query || undefined,
            tags: selectedTags.length > 0 ? selectedTags.join(",") : undefined,
            tagMode: selectedTags.length > 0 ? tagMode : undefined,
            category: selectedCategory || undefined,
            sort: sortKey,
            page,
            pageSize,
          },
        });
        const data = res.data;
        const items = Array.isArray(data) ? data : data.items || [];
        setTopics(items);
        setTotal(Array.isArray(data) ? items.length : Number(data.total || 0));
      } catch (err) {
        console.error("Load topics error", err);
      } finally {
        setLoading(false);
      }
    };
    loadTopics();
  }, [query, selectedTags, tagMode, selectedCategory, sortKey, page]);

  useEffect(() => {
    const loadReports = async () => {
      if (!isModOrAdmin) {
        setReportedTopicIds(new Set());
        return;
      }
      try {
        const res = await api.get("/reports", { params: { status: "open" } });
        const ids = new Set();
        (res.data || []).forEach((r) => {
          if (r.topic_id) ids.add(Number(r.topic_id));
        });
        setReportedTopicIds(ids);
      } catch (err) {
        console.error("Load reports error", err);
      }
    };
    loadReports();
  }, [isModOrAdmin]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleOpenTopic = (id) => {
    navigate(`/topic/${id}`);
  };

  const handleTagClick = (tagName) => {
    setPage(1);
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleCategoryClick = (slug) => {
    setPage(1);
    setSelectedCategory((prev) => (prev === slug ? "" : slug));
  };

  const handleTab = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const clearFilters = () => {
    setQuery("");
    setSelectedTags([]);
    setSelectedCategory("");
    setPage(1);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Forum</h1>
        <p className="page-subtitle">Community discussions.</p>
      </div>

      <div className="card category-hub">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2>Game Categories</h2>
          {selectedCategory && (
            <button className="btn-secondary" onClick={() => setSelectedCategory("")}>
              Clear category
            </button>
          )}
        </div>
        <div className="category-grid" style={{ marginTop: 12 }}>
          {metaLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={`hub-skel-${i}`} className="category-card skeleton skeleton-card" />
            ))
          ) : (
            <>
              {hubCategories.map((c) => (
                <div
                  key={c.id}
                  className={`category-card ${selectedCategory === c.slug ? "selected" : ""}`}
                  title={`Filter by category: ${c.name}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleCategoryClick(c.slug)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCategoryClick(c.slug);
                    }
                  }}
                >
                  {selectedCategory === c.slug && <span className="category-active">Active</span>}
                  <div className="category-title">{c.name}</div>
                  {c.description && <div className="topic-meta">{c.description}</div>}
                  <div className="topic-meta">{c.topics_count} topics</div>
                  {c.last_topic_id && (
                    <div style={{ marginTop: 6 }}>
                      <Link to={`/topic/${c.last_topic_id}`} className="btn-link" onClick={(e) => e.stopPropagation()}>
                        Last: {c.last_topic_title}
                      </Link>
                      {c.last_activity && (
                        <div className="topic-meta">
                          {new Date(c.last_activity).toLocaleDateString("sk-SK")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {hubCategories.length === 0 && <p className="topic-meta">No categories.</p>}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="forum-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`forum-tab ${activeTab === tab ? "forum-tab-active" : ""}`}
              onClick={() => handleTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
            gap: 12,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <h2>Topics</h2>
            {!loading && <span className="topic-meta">{total} results</span>}
          </div>
          {user && (
            <button className="btn-primary" onClick={() => navigate("/topic/new")}>
              + New topic
            </button>
          )}
        </div>

        <div className="filter-bar">
          <div className="filter-row">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  setQuery("");
                  setPage(1);
                }
              }}
              placeholder="Search topics..."
              style={{ flex: 1 }}
            />
            {hasFilters && (
              <button className="btn-secondary" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
          <div className="filter-hint">Tip: Press / to focus search. Esc clears search.</div>

          {hasFilters && (
            <div className="filter-chips">
              {query && (
                <span className="filter-chip">
                  Search: "{query}"
                  <button type="button" onClick={() => { setQuery(""); setPage(1); }}>x</button>
                </span>
              )}
              {selectedCategory && (
                <span className="filter-chip">
                  Category: {selectedCategoryLabel}
                  <button type="button" onClick={() => { setSelectedCategory(""); setPage(1); }}>x</button>
                </span>
              )}
              {selectedTags.map((tagName) => (
                <span key={tagName} className="filter-chip">
                  Tag: {tagName}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTags((prev) => prev.filter((t) => t !== tagName));
                      setPage(1);
                    }}
                  >
                    x
                  </button>
                </span>
              ))}
              {selectedTags.length > 1 && (
                <span className="filter-chip">
                  Match: {tagMode === "and" ? "all" : "any"}
                </span>
              )}
            </div>
          )}

          <div className="filter-groups">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {metaLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <span key={`cat-skel-${i}`} className="skeleton skeleton-pill" />
                ))
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="tag-pill"
                    title={`Filter by category: ${cat.name}`}
                    aria-pressed={selectedCategory === cat.slug}
                    onClick={() => handleCategoryClick(cat.slug)}
                    style={{
                      background: selectedCategory === cat.slug ? "var(--accent)" : "var(--chip-bg)",
                      borderColor: selectedCategory === cat.slug ? "var(--accent)" : "var(--chip-border)",
                      color: selectedCategory === cat.slug ? "#fff" : "var(--text)",
                    }}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>
            {selectedTags.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="topic-meta">Tag match</span>
                <button
                  type="button"
                  className="tag-pill"
                  aria-pressed={tagMode === "or"}
                  onClick={() => setTagMode("or")}
                  style={{
                    background: tagMode === "or" ? "var(--accent)" : "var(--chip-bg)",
                    borderColor: tagMode === "or" ? "var(--accent)" : "var(--chip-border)",
                    color: tagMode === "or" ? "#fff" : "var(--text)",
                  }}
                >
                  Any
                </button>
                <button
                  type="button"
                  className="tag-pill"
                  aria-pressed={tagMode === "and"}
                  onClick={() => setTagMode("and")}
                  style={{
                    background: tagMode === "and" ? "var(--accent)" : "var(--chip-bg)",
                    borderColor: tagMode === "and" ? "var(--accent)" : "var(--chip-border)",
                    color: tagMode === "and" ? "#fff" : "var(--text)",
                  }}
                >
                  All
                </button>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {metaLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <span key={`tag-skel-${i}`} className="skeleton skeleton-pill" />
                ))
              ) : (
                tags.map((tag) => (
                  <Tag
                    key={tag.id}
                    label={tag.name}
                    title={`Filter by tag: ${tag.name}`}
                    active={selectedTags.includes(tag.name)}
                    onClick={() => handleTagClick(tag.name)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="topics-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`topic-skel-${i}`} className="topic-item skeleton-item">
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-title" />
                  <div className="skeleton skeleton-line" style={{ width: "40%", marginTop: 8 }} />
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <span className="skeleton skeleton-pill" />
                    <span className="skeleton skeleton-pill" />
                    <span className="skeleton skeleton-pill" />
                  </div>
                </div>
                <div style={{ width: 120 }}>
                  <div className="skeleton skeleton-line" style={{ width: "80%" }} />
                  <div className="skeleton skeleton-line" style={{ width: "90%", marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="topics-list">
            {topics.map((t) => {
              const snippet = (t.first_post_content || "").trim();
              const snippetText =
                snippet.length > 140 ? `${snippet.slice(0, 140)}...` : snippet;

              const isReported = isModOrAdmin && reportedTopicIds.has(t.id);

              return (
                <div
                  key={t.id}
                  className={`topic-item ${isReported ? "reported-outline" : ""}`}
                  onClick={() => handleOpenTopic(t.id)}
                >
                <div>
                  <div className="topic-title">
                    {t.is_sticky && <span style={{ marginRight: 6, color: "#fbbf24" }}>PIN</span>}
                    {t.is_locked && <span style={{ marginRight: 6, color: "#f87171" }}>LOCK</span>}
                    {highlight(t.title, query)}
                  </div>
                  <div className="topic-meta">
                    author{" "}
                    <Link to={`/profile/${t.author_id}`} onClick={(e) => e.stopPropagation()} className="author-link">
                      {t.author}
                    </Link>{" "}
                    | {new Date(t.created_at).toLocaleDateString("sk-SK")}
                  </div>
                  {snippetText && <div className="topic-snippet">{snippetText}</div>}
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.category_name && (
                      <span className="tag-pill" style={{ borderColor: "#1d4ed8" }}>
                        {t.category_name}
                      </span>
                    )}
                    {(t.tags || []).map((tg) => (
                      <span key={tg.id} className="tag-pill">
                        {tg.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="topic-meta">
                  {t.replies} replies
                  <br />
                  {t.last_author ? (
                    <>
                      last by{" "}
                      <Link
                        to={`/profile/${t.last_author_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="author-link"
                      >
                        {t.last_author}
                      </Link>
                      <br />
                    </>
                  ) : null}
                  last activity {new Date(t.last_activity).toLocaleDateString("sk-SK")}
                </div>
              </div>
              );
            })}

            {topics.length === 0 && (
              <div className="empty-state">
                <div>{hasFilters ? `No topics for ${filterSummary}.` : "No topics yet."}</div>
                {hasFilters && (
                  <div className="topic-meta" style={{ marginTop: 6 }}>
                    Try clearing filters or changing search.
                  </div>
                )}
                {!hasFilters && user && (
                  <button className="btn-secondary" onClick={() => navigate("/topic/new")} style={{ marginTop: 8 }}>
                    Create the first topic
                  </button>
                )}
                {hasFilters && (
                  <button className="btn-secondary" onClick={clearFilters} style={{ marginTop: 8 }}>
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <div className="topic-meta">
              Page {page} / {totalPages}
            </div>
            <button
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
        {page > 1 && (
          <button
            className="btn-link"
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Back to top
          </button>
        )}
      </div>
    </div>
  );
}

