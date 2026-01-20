import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export default function WikiArticle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canEditWiki, setCanEditWiki] = useState(false);
  const [search, setSearch] = useState("");
  const hasSearch = !!search.trim();
  const searchInputRef = useRef(null);

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
          api.get(`/wiki/${slug}`),
          api.get("/wiki/categories/list"),
        ]);
        setArticle(res.data);
        setCategories(cats.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const blocks = useMemo(() => {
    if (!article?.content) return [];
    return (article.content || []).map((b, idx) => ({ ...b, _idx: idx }));
  }, [article]);

  const toc = useMemo(() => {
    return blocks.filter((b) => b.type === "heading");
  }, [blocks]);

  const infobox = useMemo(() => {
    return blocks.find((b) => b.type === "infobox") || null;
  }, [blocks]);

  const mainBlocks = useMemo(() => {
    return blocks.filter((b) => b.type !== "infobox");
  }, [blocks]);

  const headingId = (b) => `h-${slugify(b.text)}-${b._idx}`;

  const renderBlock = (b, idx) => {
    switch (b.type) {
      case "heading":
        if (b.level === 1) return <h2 key={idx} id={headingId(b)}>{b.text}</h2>;
        if (b.level === 2) return <h3 key={idx} id={headingId(b)}>{b.text}</h3>;
        return <h4 key={idx} id={headingId(b)}>{b.text}</h4>;
      case "paragraph":
        return <p key={idx}>{b.text}</p>;
      case "list":
        return (
          <ul key={idx}>
            {(b.items || []).map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        );
      case "image":
        return (
          <div key={idx} style={{ margin: "12px 0" }}>
            <img src={b.url} alt={b.alt || ""} style={{ maxWidth: "100%", borderRadius: 8 }} />
            {b.caption && <div className="topic-meta">{b.caption}</div>}
          </div>
        );
      case "quote":
        return <blockquote key={idx}>{b.text}</blockquote>;
      case "code":
        return <pre key={idx} style={{ background: "var(--wiki-head)", padding: 8, borderRadius: 8 }}>{b.text}</pre>;
      case "columns":
        return (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              {b.left?.type === "heading" && (b.left.level === 1 ? <h2>{b.left.text}</h2> : b.left.level === 2 ? <h3>{b.left.text}</h3> : <h4>{b.left.text}</h4>)}
              {b.left?.type === "paragraph" && <p>{b.left.text}</p>}
              {b.left?.type === "list" && <ul>{(b.left.items || []).map((it, i) => <li key={i}>{it}</li>)}</ul>}
              {b.left?.type === "image" && b.left.url && (
                <img src={b.left.url} alt={b.left.alt || ""} style={{ maxWidth: "100%", borderRadius: 8 }} />
              )}
              {b.left?.type === "quote" && <blockquote>{b.left.text}</blockquote>}
              {b.left?.type === "code" && <pre style={{ background: "var(--wiki-head)", padding: 8, borderRadius: 8 }}>{b.left.text}</pre>}
            </div>
            <div>
              {b.right?.type === "heading" && (b.right.level === 1 ? <h2>{b.right.text}</h2> : b.right.level === 2 ? <h3>{b.right.text}</h3> : <h4>{b.right.text}</h4>)}
              {b.right?.type === "paragraph" && <p>{b.right.text}</p>}
              {b.right?.type === "list" && <ul>{(b.right.items || []).map((it, i) => <li key={i}>{it}</li>)}</ul>}
              {b.right?.type === "image" && b.right.url && (
                <img src={b.right.url} alt={b.right.alt || ""} style={{ maxWidth: "100%", borderRadius: 8 }} />
              )}
              {b.right?.type === "quote" && <blockquote>{b.right.text}</blockquote>}
              {b.right?.type === "code" && <pre style={{ background: "var(--wiki-head)", padding: 8, borderRadius: 8 }}>{b.right.text}</pre>}
            </div>
          </div>
        );
      case "infobox":
        return null;
      default:
        return null;
    }
  };

  if (loading) return <div className="page"><p>Loading...</p></div>;
  if (!article) return <div className="page"><p>Article not found.</p></div>;

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
              <Link key={c.id} to={`/wiki?category=${c.slug}`} className="wiki-link">
                {c.name}
              </Link>
            ))}
            {categories.length === 0 && <div className="topic-meta">No categories.</div>}
          </div>
        </div>
      </div>

      <div className="card wiki-card wiki-article">
        <div className="wiki-breadcrumb">
          <Link to="/wiki">Wiki</Link>
          {article.category_name && (
            <>
              <span className="wiki-breadcrumb-sep">/</span>
              <Link to={`/wiki?category=${article.category_slug}`}>{article.category_name}</Link>
            </>
          )}
          <span className="wiki-breadcrumb-sep">/</span>
          <span>{article.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
            disabled={!hasSearch}
            onClick={() => {
              if (search.trim()) navigate(`/wiki?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            Search
          </button>
        </div>
        <div className="filter-hint">Tip: Press / to focus search. Esc clears search.</div>
        <h1 className="page-title wiki-title">{article.title}</h1>
        {article.status !== "published" && (
          <div className="wiki-alert" style={{ marginTop: 6 }}>
            Draft (visible only to editors)
          </div>
        )}
        <p className="topic-meta">
          {article.category_name || "Uncategorized"} | {new Date(article.updated_at).toLocaleString("sk-SK")}
        </p>
        {article.cover_image && (
          <div style={{ margin: "12px 0" }}>
            <img src={article.cover_image} alt="" style={{ width: "100%", borderRadius: 12 }} />
          </div>
        )}

        <div className="wiki-content" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {(mainBlocks || []).map((b, idx) => renderBlock(b, idx))}
        </div>

        {isEditor && (
          <div style={{ marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => navigate(`/wiki/edit/${article.id}`)}>
              Edit
            </button>
          </div>
        )}
      </div>

      <div className="card wiki-card wiki-side" style={{ height: "fit-content" }}>
        {infobox && (
          <div className="wiki-infobox" style={{ marginBottom: 12 }}>
            {infobox.title && <div style={{ fontWeight: 700, marginBottom: 6 }}>{infobox.title}</div>}
            {infobox.image_url && (
              <img src={infobox.image_url} alt="" style={{ width: "100%", borderRadius: 8 }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              {(infobox.items || []).map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{it.label}</span>
                  <span>{it.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <h3 className="wiki-section-title">Contents</h3>
        {toc.length === 0 ? (
          <p className="topic-meta">No headings.</p>
        ) : (
          <div className="wiki-toc">
            <ul style={{ display: "flex", flexDirection: "column", gap: 4, margin: 0, paddingLeft: 18 }}>
              {toc.map((h, i) => (
                <li key={i} style={{ marginLeft: h.level === 2 ? 10 : h.level >= 3 ? 18 : 0 }}>
                  <a href={`#${headingId(h)}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}


