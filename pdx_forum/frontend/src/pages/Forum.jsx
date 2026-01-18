import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import Tag from "../components/Tag";
import { useAuth } from "../context/AuthContext";

const TABS = ["Home", "Trending", "Latest threads", "New posts"];

export default function Forum() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Home");
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [topicsRes, tagsRes, catsRes] = await Promise.all([
          api.get("/topics"),
          api.get("/tags"),
          api.get("/categories"),
        ]);
        setTopics(topicsRes.data);
        setTags(tagsRes.data);
        setCategories(catsRes.data);
      } catch (err) {
        console.error("Load error", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const topicsForTab = useMemo(() => {
    let list = topics.map((t) => ({
      ...t,
      replies: Number(t.replies ?? 0),
      last_activity: t.last_activity || t.created_at,
    }));

    if (selectedTag) {
      list = list.filter((t) =>
        (t.tags || []).some((tg) => tg.name === selectedTag)
      );
    }
    if (selectedCategory) {
      list = list.filter((t) => String(t.category_id) === String(selectedCategory));
    }

    switch (activeTab) {
      case "Trending":
        return list.slice().sort((a, b) => b.replies - a.replies);
      case "Latest threads":
        return list
          .slice()
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
      case "New posts":
        return list
          .slice()
          .sort(
            (a, b) =>
              new Date(b.last_activity).getTime() -
              new Date(a.last_activity).getTime()
          );
      default:
        return list;
    }
  }, [activeTab, selectedTag, selectedCategory, topics]);

  const sortedTopics = useMemo(() => {
    const list = topicsForTab.slice();
    const pinned = list.filter((t) => t.is_sticky);
    const normal = list.filter((t) => !t.is_sticky);
    return [...pinned, ...normal];
  }, [topicsForTab]);

  const handleOpenTopic = (id) => {
    navigate(`/topic/${id}`);
  };

  const handleTagClick = (tagName) => {
    if (selectedTag === tagName) setSelectedTag(null);
    else setSelectedTag(tagName);
  };
  const handleCategoryClick = (catId) => {
    if (selectedCategory === catId) setSelectedCategory(null);
    else setSelectedCategory(catId);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Forum</h1>
        <p className="page-subtitle">Temy nacitane z backendu.</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="forum-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`forum-tab ${activeTab === tab ? "forum-tab-active" : ""}`}
              onClick={() => setActiveTab(tab)}
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
          <h2>Diskusne temy</h2>
          {user && (
            <button
              className="btn-primary"
              onClick={() => navigate("/topic/new")}
            >
              + Nova tema
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="tag-pill"
                onClick={() => handleCategoryClick(cat.id)}
                style={{
                  background: selectedCategory === cat.id ? "var(--accent)" : "var(--chip-bg)",
                  borderColor: selectedCategory === cat.id ? "var(--accent)" : "var(--chip-border)",
                  color: selectedCategory === cat.id ? "#fff" : "var(--text)",
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tags.map((tag) => (
              <Tag
                key={tag.id}
                label={tag.name}
                active={selectedTag === tag.name}
                onClick={() => handleTagClick(tag.name)}
              />
            ))}
          </div>
        </div>

        {loading ? (
          <p>Nacitavam temy...</p>
        ) : (
          <div className="topics-list">
            {sortedTopics.map((t) => (
              <div
                key={t.id}
                className="topic-item"
                onClick={() => handleOpenTopic(t.id)}
              >
                <div>
                  <div className="topic-title">
                    {t.is_sticky && <span style={{ marginRight: 6, color: "#fbbf24" }}>PIN</span>}
                    {t.is_locked && <span style={{ marginRight: 6, color: "#f87171" }}>LOCK</span>}
                    {t.title}
                  </div>
                  <div className="topic-meta">
                    autor{" "}
                    <Link to={`/profile/${t.author_id}`} onClick={(e) => e.stopPropagation()}  className="author-link">
                      {t.author}
                    </Link>{" "}
                    | {new Date(t.created_at).toLocaleDateString("sk-SK")}
                  </div>
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
                  {t.replies} odpovedi
                  <br />
                  posledna aktivita{" "}
                  {new Date(t.last_activity).toLocaleDateString("sk-SK")}
                </div>
              </div>
            ))}

            {topicsForTab.length === 0 && (
              <p className="topic-meta">Zatial ziadne temy.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
