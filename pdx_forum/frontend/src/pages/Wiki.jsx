import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Wiki() {
  const { user } = useAuth();
  const [canEditWiki, setCanEditWiki] = useState(false);
  const [categories, setCategories] = useState([]);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [drafts, setDrafts] = useState([]);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [allArticles, setAllArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const searchInputRef = useRef(null);
  const isEditor = user && (user.role === "admin" || canEditWiki);
  const hasSearch = !!query;
  const hasFilters = hasSearch || selectedCategory;
  const selectedCategoryLabel =
    categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory;

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
    const loadMeta = async () => {
      setLoading(true);
      setRecentLoading(true);
      setNewsLoading(true);
      try {
        const [cats, rec, all, newsRes] = await Promise.all([
          api.get("/wiki/categories/list"),
          api.get("/wiki/recent/changes?limit=8"),
          api.get("/wiki", { params: { status: "published" } }),
          api.get("/wiki", { params: { category: "news", status: "published" } }),
        ]);
        setCategories(cats.data || []);
        setRecent(rec.data || []);
        setAllArticles(all.data || []);
        setNews(newsRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setRecentLoading(false);
        setNewsLoading(false);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const loadDrafts = async () => {
      if (!isEditor) return;
      try {
        const res = await api.get("/wiki/drafts");
        setDrafts(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadDrafts();
  }, [isEditor]);

  useEffect(() => {
    const loadResults = async () => {
      if (!hasFilters) {
        setResults([]);
        return;
      }
      setResultsLoading(true);
      try {
        const res = await api.get("/wiki", {
          params: {
            q: query || undefined,
            category: selectedCategory || undefined,
          },
        });
        setResults(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setResultsLoading(false);
      }
    };
    loadResults();
  }, [query, selectedCategory, hasFilters]);

  const updateSearchParams = (nextQuery, nextCategory) => {
    const params = {};
    if (nextQuery) params.q = nextQuery;
    if (nextCategory) params.category = nextCategory;
    setSearchParams(params);
  };

  const onSearchChange = (value) => {
    setQuery(value);
    updateSearchParams(value, selectedCategory);
  };

  const onCategoryClick = (slug) => {
    const next = slug === selectedCategory ? "" : slug;
    setSelectedCategory(next);
    updateSearchParams(query, next);
  };

  const clearSearch = () => {
    setQuery("");
    updateSearchParams("", selectedCategory);
  };

  const clearAllFilters = () => {
    setQuery("");
    setSelectedCategory("");
    updateSearchParams("", "");
  };

  const importantArticles = allArticles.filter((a) => a.category_slug !== "news").slice(0, 8);
  const newsArticles = news.slice(0, 5);

  return (
    <div className="page wiki-shell wiki-home">
      <div className="card wiki-card wiki-sidebar" style={{ height: "fit-content" }}>
        <h3 className="wiki-section-title">Wiki</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Link to="/wiki" className="wiki-link">Main page</Link>
          <Link to="/wiki/recent" className="wiki-link">Recent changes</Link>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="topic-meta" style={{ marginBottom: 6 }}>Categories</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {categories.map((c) => (
              <button
                key={c.id}
                className="wiki-link"
                title={c.description ? `${c.name} - ${c.description}` : `Filter by category: ${c.name}`}
                style={{
                  textAlign: "left",
                  color: selectedCategory === c.slug ? "var(--accent)" : undefined,
                }}
                aria-pressed={selectedCategory === c.slug}
                onClick={() => onCategoryClick(c.slug)}
              >
                {c.name}
              </button>
            ))}
            {categories.length === 0 && <div className="topic-meta">No categories.</div>}
          </div>
        </div>
      </div>

      <div className="card wiki-card wiki-main">
        <div className="page-header" style={{ marginBottom: 8 }}>
          <h1 className="page-title wiki-title">Community Wiki</h1>
          <p className="page-subtitle wiki-subtitle">Guides, mechanics, and modding notes.</p>
        </div>

        <div className="filter-bar">
          <div className="filter-row">
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearchChange(e.target.value);
                if (e.key === "Escape" && query) clearSearch();
              }}
              placeholder="Search wiki..."
              style={{ flex: 1 }}
            />
            {hasSearch && (
              <button className="btn-secondary" onClick={clearSearch}>
                Clear search
              </button>
            )}
            {selectedCategory && (
              <button className="btn-secondary" onClick={() => onCategoryClick(selectedCategory)}>
                Clear category
              </button>
            )}
          </div>
          <div className="filter-hint">Tip: Press / to focus search. Esc clears search.</div>
          {hasFilters && (
            <div className="filter-chips">
              {query && (
                <span className="filter-chip">
                  Search: "{query}"
                  <button type="button" onClick={clearSearch}>x</button>
                </span>
              )}
              {selectedCategory && (
                <span className="filter-chip">
                  Category: {selectedCategoryLabel}
                  <button type="button" onClick={() => onCategoryClick(selectedCategory)}>x</button>
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: "grid", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`wiki-skel-${i}`} className="topic-item wiki-item skeleton-item">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" style={{ width: "45%", marginTop: 8 }} />
                <div className="skeleton skeleton-line" style={{ width: "90%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : hasFilters ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="topic-meta">{results.length} results</div>
            {resultsLoading ? (
              <div className="topic-meta">Loading results...</div>
            ) : (
              results.map((a) => (
                <div key={a.id} className="topic-item wiki-item">
                  <div>
                    <div className="topic-title">
                      <Link to={`/wiki/${a.slug}`}>{highlight(a.title, query)}</Link>
                    </div>
                    <div className="topic-meta">
                      {a.category_name || "Uncategorized"} | {new Date(a.updated_at).toLocaleDateString("sk-SK")}
                    </div>
                    <p style={{ marginTop: 6 }}>{highlight(a.summary, query)}</p>
                  </div>
                </div>
              ))
            )}
            {results.length === 0 && !resultsLoading && (
              <div className="empty-state">
                <div>No articles for current filters.</div>
                <button className="btn-secondary" onClick={clearAllFilters} style={{ marginTop: 8 }}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="wiki-home-sections">
            <section className="wiki-hero">
              <div>
                <h2>About this site</h2>
                <p>
                  This community wiki collects guides, mechanics, and modding tips for Paradox games.
                  Use the search above, browse categories, or jump into the latest news.
                </p>
              </div>
              <div className="wiki-hero-actions">
                {isEditor && (
                  <Link to="/wiki/new" className="btn-secondary">
                    New article
                  </Link>
                )}
              </div>
            </section>

            <section className="wiki-section">
              <div className="wiki-section-head">
                <h2>Important pages</h2>
                <Link to="/wiki?category=guides" className="wiki-link">
                  View all
                </Link>
              </div>
              <div className="wiki-grid">
                {importantArticles.map((a) => (
                  <Link key={a.id} to={`/wiki/${a.slug}`} className="wiki-card-link">
                    <div className="wiki-article-card">
                      <div className="wiki-article-title">{a.title}</div>
                      <div className="topic-meta">{a.category_name || "Uncategorized"}</div>
                      <div className="wiki-article-summary">{a.summary}</div>
                    </div>
                  </Link>
                ))}
                {importantArticles.length === 0 && (
                  <div className="topic-meta">No articles yet.</div>
                )}
              </div>
            </section>

            <section className="wiki-section">
              <div className="wiki-section-head">
                <h2>Browse all articles</h2>
                <Link to="/wiki/recent" className="wiki-link">Recent changes</Link>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {allArticles.slice(0, 10).map((a) => (
                  <div key={a.id} className="topic-item wiki-item">
                    <div className="topic-title">
                      <Link to={`/wiki/${a.slug}`}>{a.title}</Link>
                    </div>
                    <div className="topic-meta">
                      {a.category_name || "Uncategorized"} | {new Date(a.updated_at).toLocaleDateString("sk-SK")}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="card wiki-card wiki-side" style={{ height: "fit-content" }}>
        <h3 className="wiki-section-title">Latest news</h3>
        {newsLoading ? (
          <p className="topic-meta">Loading...</p>
        ) : newsArticles.length === 0 ? (
          <p className="topic-meta">No news yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {newsArticles.map((n) => (
              <Link key={n.id} to={`/wiki/${n.slug}`} className="wiki-card-link">
                <div className="wiki-news-card">
                  {n.cover_image && (
                    <img src={n.cover_image} alt="" />
                  )}
                  <div>
                    <div style={{ fontWeight: 600 }}>{n.title}</div>
                    <div className="topic-meta">
                      {new Date(n.updated_at).toLocaleDateString("sk-SK")}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="wiki-section-title">Recent changes</h3>
            <Link to="/wiki/recent" className="wiki-link">All</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {recentLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`recent-skel-${i}`}>
                  <div className="skeleton skeleton-line" style={{ width: "80%" }} />
                  <div className="skeleton skeleton-line" style={{ width: "60%", marginTop: 6 }} />
                </div>
              ))
            ) : (
              <>
                {recent.map((r, i) => (
                  <div key={`${r.article_id}-${i}`}>
                    <Link to={`/wiki/${r.slug}`} className="wiki-link">{r.title}</Link>
                    <div className="topic-meta">
                      {r.changed_by || "unknown"} | {new Date(r.created_at).toLocaleString("sk-SK")}
                    </div>
                  </div>
                ))}
                {recent.length === 0 && <div className="topic-meta">No recent changes.</div>}
              </>
            )}
          </div>
        </div>

        {isEditor && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="wiki-section-title">Drafts</h3>
              <Link to="/wiki/new" className="wiki-link">New</Link>
            </div>
            {drafts.length === 0 ? (
              <div className="topic-meta">No drafts.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {drafts.map((d) => (
                  <div key={d.id} className="wiki-item" style={{ borderRadius: 8, padding: 8 }}>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    <div className="topic-meta">{new Date(d.updated_at).toLocaleString("sk-SK")}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <Link to={`/wiki/edit/${d.id}`} className="wiki-link">Edit</Link>
                      <Link to={`/wiki/${d.slug}`} className="wiki-link">View</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



