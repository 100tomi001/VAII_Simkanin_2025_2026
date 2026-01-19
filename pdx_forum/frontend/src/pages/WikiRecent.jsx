import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function WikiRecent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
        const res = await api.get("/wiki/recent/changes?limit=50");
        setItems(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
          <div className="filter-hint">Tip: Press “/” to focus search. Esc clears search.</div>
        </div>
        {!loading && <div className="topic-meta">{items.length} changes</div>}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`recent-page-skel-${i}`} className="topic-item wiki-item skeleton-item">
                <div className="skeleton skeleton-title" />
                <div className="skeleton skeleton-line" style={{ width: "55%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div>No changes yet.</div>
            <Link to="/wiki" className="btn-secondary" style={{ marginTop: 8, display: "inline-block" }}>
              Browse wiki
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((r, i) => (
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
