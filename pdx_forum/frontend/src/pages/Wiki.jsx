import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function Wiki() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/wiki");
        setArticles(res.data);
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
        <h1 className="page-title">Wiki</h1>
        <p className="page-subtitle">Prehľad článkov.</p>
      </div>

      {loading ? (
        <p>Načítavam...</p>
      ) : (
        <div className="card" style={{ display: "grid", gap: 12 }}>
          {articles.map((a) => (
            <div key={a.id} className="topic-item" onClick={() => {}}>
              <div>
                <div className="topic-title">
                  <Link to={`/wiki/${a.slug}`}>{a.title}</Link>
                </div>
                <div className="topic-meta">
                  {a.category_name || "Uncategorized"} |{" "}
                  {new Date(a.updated_at).toLocaleDateString("sk-SK")}
                </div>
                <p style={{ marginTop: 6 }}>{a.summary}</p>
              </div>
            </div>
          ))}
          {articles.length === 0 && <p className="topic-meta">Žiadne články.</p>}
        </div>
      )}
    </div>
  );
}
