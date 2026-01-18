import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Wiki() {
  const { user } = useAuth();
  const [canEditWiki, setCanEditWiki] = useState(false);
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recent, setRecent] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const isEditor = user && (user.role === "admin" || canEditWiki);

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
      try {
        const [cats, rec] = await Promise.all([
          api.get("/wiki/categories/list"),
          api.get("/wiki/recent/changes?limit=10"),
        ]);
        setCategories(cats.data);
        setRecent(rec.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const loadDrafts = async () => {
      if (!isEditor) return;
      try {
        const res = await api.get("/wiki/drafts");
        setDrafts(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    loadDrafts();
  }, [isEditor]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/wiki", {
          params: {
            q: query || undefined,
            category: selectedCategory || undefined,
          },
        });
        setArticles(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [query, selectedCategory]);

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

  const publishDraft = async (draftId) => {
    try {
      await api.patch(`/wiki/${draftId}`, { status: "published" });
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      const res = await api.get("/wiki", {
        params: {
          q: query || undefined,
          category: selectedCategory || undefined,
        },
      });
      setArticles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const removeDraft = async (draftId) => {
    try {
      await api.delete(`/wiki/${draftId}`);
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page wiki-shell">
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
                style={{
                  textAlign: "left",
                  color: selectedCategory === c.slug ? "var(--accent)" : undefined,
                }}
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
          <h1 className="page-title wiki-title">Wiki</h1>
          <p className="page-subtitle wiki-subtitle">Articles and guides.</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={query}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search wiki..."
            style={{ flex: 1 }}
          />
          {selectedCategory && (
            <button className="btn-secondary" onClick={() => onCategoryClick(selectedCategory)}>
              Clear category
            </button>
          )}
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {articles.map((a) => (
              <div key={a.id} className="topic-item wiki-item">
                <div>
                  <div className="topic-title">
                    <Link to={`/wiki/${a.slug}`}>{a.title}</Link>
                  </div>
                  <div className="topic-meta">
                    {a.category_name || "Uncategorized"} | {new Date(a.updated_at).toLocaleDateString("sk-SK")}
                  </div>
                  <p style={{ marginTop: 6 }}>{a.summary}</p>
                </div>
              </div>
            ))}
            {articles.length === 0 && <p className="topic-meta">No articles.</p>}
          </div>
        )}
      </div>

      <div className="card wiki-card wiki-side" style={{ height: "fit-content" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="wiki-section-title">Recent changes</h3>
          <Link to="/wiki/recent" className="wiki-link">All</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {recent.map((r, i) => (
            <div key={`${r.article_id}-${i}`}>
              <Link to={`/wiki/${r.slug}`} className="wiki-link">{r.title}</Link>
              <div className="topic-meta">
                {r.changed_by || "unknown"} - {new Date(r.created_at).toLocaleString("sk-SK")}
              </div>
            </div>
          ))}
          {recent.length === 0 && <div className="topic-meta">No recent changes.</div>}
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
                      <button className="btn-link" onClick={() => publishDraft(d.id)}>Publish</button>
                      <button className="btn-link" onClick={() => removeDraft(d.id)}>Remove</button>
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
