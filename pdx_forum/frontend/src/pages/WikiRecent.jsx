import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function WikiRecent() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

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
    const load = async () => {
      try {
        const [res, cats] = await Promise.all([
          api.get("/wiki/recent/changes?limit=50"),
          api.get("/wiki/categories/list"),
        ]);
        setItems(res.data);
        setCategories(cats.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredItems = items.filter((r) => {
    if (authorFilter) {
      const match = String(r.changed_by || "")
        .toLowerCase()
        .includes(authorFilter.trim().toLowerCase());
      if (!match) return false;
    }
    if (categoryFilter && r.category_slug !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title wiki-title">Recent changes</h1>
      </div>

      <div className="card wiki-card">
        <div className="filter-bar">
          <div className="filter-row">
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  navigate(`/wiki?q=${encodeURIComponent(search.trim())}`);
                }
                if (e.key === "Escape" && search) setSearch("");
              }}
              placeholder="Search wiki..."
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              type="button"
              disabled={!search.trim()}
              onClick={() => {
                if (search.trim()) navigate(`/wiki?q=${encodeURIComponent(search.trim())}`);
              }}
            >
              Search
            </button>
          </div>
          <div className="filter-hint">Tip: Press / to focus search. Esc clears search.</div>
          <div className="filter-row" style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder="Filter by author..."
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!loading && (
          <div className="topic-meta">
            {filteredItems.length} of {items.length} changes
          </div>
        )}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`recent-page-skel-${i}`} className="topic-item wiki-item skeleton-item">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" style={{ width: "55%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div>No changes yet.</div>
            <Link to="/wiki" className="btn-secondary" style={{ marginTop: 8, display: "inline-block" }}>
              Browse wiki
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredItems.map((r, i) => (
              <div key={`${r.article_id}-${i}`} className="topic-item wiki-item">
                <div>
                  <div className="topic-title">
                    <Link to={`/wiki/${r.slug}`}>{r.title}</Link>
                  </div>
                  <div className="topic-meta">
                    {r.changed_by || "unknown"} - {new Date(r.created_at).toLocaleString("sk-SK")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
