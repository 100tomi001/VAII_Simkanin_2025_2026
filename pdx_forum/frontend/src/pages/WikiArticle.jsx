import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function WikiArticle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  const isEditor = user && (user.role === "admin" || user.role === "moderator");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/wiki/${slug}`);
        setArticle(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  const toc = useMemo(() => {
    if (!article?.content) return [];
    // očakávame content ako array blokov {type: "heading", level: 1/2/3, text: "..."}
    return (article.content || []).filter((b) => b.type === "heading");
  }, [article]);

  const renderBlock = (b, idx) => {
    switch (b.type) {
      case "heading":
        if (b.level === 1) return <h2 key={idx} id={`h-${idx}`}>{b.text}</h2>;
        if (b.level === 2) return <h3 key={idx} id={`h-${idx}`}>{b.text}</h3>;
        return <h4 key={idx} id={`h-${idx}`}>{b.text}</h4>;
      case "paragraph":
        return <p key={idx}>{b.text}</p>;
      case "list":
        return (
          <ul key={idx}>
            {b.items.map((it, i) => <li key={i}>{it}</li>)}
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
        return <pre key={idx} style={{ background: "#0b1220", padding: 8, borderRadius: 8 }}>{b.text}</pre>;
      default:
        return null;
    }
  };

  if (loading) return <div className="page"><p>Načítavam...</p></div>;
  if (!article) return <div className="page"><p>Článok sa nenašiel.</p></div>;

  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
      <div className="card">
        <h1 className="page-title">{article.title}</h1>
        <p className="topic-meta">{article.category_name || "Uncategorized"} | {new Date(article.updated_at).toLocaleString("sk-SK")}</p>
        {article.cover_image && (
          <div style={{ margin: "12px 0" }}>
            <img src={article.cover_image} alt="" style={{ width: "100%", borderRadius: 12 }} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {(article.content || []).map((b, idx) => renderBlock(b, idx))}
        </div>

        {isEditor && (
          <div style={{ marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => navigate(`/wiki/edit/${article.id}`)}>
              Upraviť
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Obsah</h3>
        {toc.length === 0 ? (
          <p className="topic-meta">Žiadne nadpisy.</p>
        ) : (
          <ul style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {toc.map((h, i) => (
              <li key={i}>
                <a href={`#h-${i}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
