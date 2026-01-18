import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function WikiRecent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p className="topic-meta">No changes yet.</p>
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
