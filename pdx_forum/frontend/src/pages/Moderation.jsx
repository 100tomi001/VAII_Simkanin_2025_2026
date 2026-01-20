import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const STATUS_OPTIONS = ["all", "open", "reviewed", "closed"];

export default function Moderation() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState([]);
  const [reportStatus, setReportStatus] = useState("open");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [tagAudit, setTagAudit] = useState([]);
  const [wikiChanges, setWikiChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm] = useState(null);

  const isMod = user?.role === "admin" || user?.role === "moderator";
  const canDeletePosts = user?.role === "admin" || !!perm?.can_delete_posts;
  const canManageTags = user?.role === "admin" || !!perm?.can_manage_tags;

  const loadReports = async (status) => {
    const params = {};
    if (status && status !== "all") params.status = status;
    const res = await api.get("/reports", { params });
    setReports(res.data);
  };

  const loadTagAudit = async () => {
    if (!canManageTags) return;
    const res = await api.get("/tags/audit?limit=40");
    setTagAudit(res.data);
  };

  const loadWikiChanges = async () => {
    const res = await api.get("/wiki/recent/changes?limit=30");
    setWikiChanges(res.data);
  };

  const load = async () => {
    if (!isMod) return;
    setLoading(true);
    try {
      const permRes = await api.get("/moderation/permissions/me");
      setPerm(permRes.data);
      await Promise.all([
        loadReports(reportStatus),
        loadWikiChanges(),
      ]);
      if (user?.role === "admin" || permRes.data?.can_manage_tags) {
        await loadTagAudit();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load moderation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (!isMod) return;
    loadReports(reportStatus).catch((err) => console.error(err));
  }, [reportStatus]);

  if (!isMod) {
    return (
      <div className="page">
        <div className="card">Moderator only.</div>
      </div>
    );
  }

  const isInDateRange = (createdAt) => {
    if (!reportFrom && !reportTo) return true;
    const ts = new Date(createdAt).getTime();
    if (Number.isNaN(ts)) return false;
    if (reportFrom) {
      const fromTs = new Date(`${reportFrom}T00:00:00`).getTime();
      if (ts < fromTs) return false;
    }
    if (reportTo) {
      const toTs = new Date(`${reportTo}T23:59:59`).getTime();
      if (ts > toTs) return false;
    }
    return true;
  };

  const visibleReports = reports.filter((r) => isInDateRange(r.created_at));

  const updateReportStatus = async (id, status) => {
    try {
      const res = await api.patch(`/reports/${id}`, { status });
      const shouldHide = reportStatus !== "all" && status !== reportStatus;
      setReports((prev) =>
        shouldHide
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, status: res.data.status } : r))
      );
      toast.success("Report updated.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update report.");
    }
  };

  const closeAndHideReport = async (id) => {
    try {
      await api.patch(`/reports/${id}`, { status: "closed" });
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report closed.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to close report.");
    }
  };

  const deleteReportedPost = async (postId, reportId) => {
    if (!canDeletePosts) return;
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.delete(`/posts/${postId}`);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, post_deleted: true } : r
        )
      );
      toast.success("Post deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete post.");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Moderation</h1>
        <p className="page-subtitle">Reports and audits.</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className={`btn-secondary ${tab === "reports" ? "btn-primary" : ""}`}
          onClick={() => setTab("reports")}
        >
          Reports
        </button>
        {canManageTags && (
          <button
            className={`btn-secondary ${tab === "tag-audit" ? "btn-primary" : ""}`}
            onClick={() => setTab("tag-audit")}
          >
            Tag audit
          </button>
        )}
        <button
          className={`btn-secondary ${tab === "wiki" ? "btn-primary" : ""}`}
          onClick={() => setTab("wiki")}
        >
          Wiki changes
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : tab === "reports" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="topic-meta">Status</span>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="tag-pill"
                  aria-pressed={reportStatus === s}
                  onClick={() => setReportStatus(s)}
                  style={{
                    background: reportStatus === s ? "var(--accent)" : "var(--chip-bg)",
                    borderColor: reportStatus === s ? "var(--accent)" : "var(--chip-border)",
                    color: reportStatus === s ? "#fff" : "var(--text)",
                  }}
                >
                  {s}
                </button>
              ))}
              <span className="topic-meta">{visibleReports.length} reports</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
              <span className="topic-meta">From</span>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
              />
              <span className="topic-meta">To</span>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
              />
              {(reportFrom || reportTo) && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setReportFrom("");
                    setReportTo("");
                  }}
                >
                  Clear dates
                </button>
              )}
            </div>

            {visibleReports.length === 0 ? (
              <p className="topic-meta" style={{ marginTop: 12 }}>No reports.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {visibleReports.map((r) => {
                  const isPostReport = !!r.target_post_id;
                  const isUserReport = !!r.target_user_id && !r.target_post_id;
                  const linkPostId = r.target_post_id || r.context_post_id;
                  const topicLink = r.topic_id && linkPostId ? `/topic/${r.topic_id}#post-${linkPostId}` : null;
                  const profileLink = r.target_user_id ? `/profile/${r.target_user_id}` : null;
                  const snippet = isPostReport
                    ? r.post_content
                    : r.context_post_content || "";

                  return (
                    <div key={r.id} className="report-card">
                      <div className="report-head">
                        <div>
                          {isPostReport ? (
                            <>
                              <strong>{r.target_username}</strong>{" "}
                              in{" "}
                              {topicLink ? (
                                <Link to={topicLink}>{r.topic_title}</Link>
                              ) : (
                                r.topic_title
                              )}
                            </>
                          ) : (
                            <>
                              User report:{" "}
                              {profileLink ? (
                                <Link to={profileLink}>{r.target_username}</Link>
                              ) : (
                                r.target_username || "unknown"
                              )}
                            </>
                          )}
                        </div>
                        <span className={`report-status report-${r.status}`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="topic-meta">
                        Reported by {r.reporter_username} |{" "}
                        {new Date(r.created_at).toLocaleString("sk-SK")}
                      </div>
                      <div className="report-reason">{r.reason}</div>
                      {snippet && (
                        <div className="topic-meta">
                          Context: {snippet.slice(0, 160)}
                        </div>
                      )}

                      {isUserReport && topicLink && (
                        <div className="topic-meta">
                          Context post:{" "}
                          <Link to={topicLink} className="btn-link">
                            open
                          </Link>
                        </div>
                      )}

                      <div className="report-actions">
                        {topicLink && (
                          <Link to={topicLink} className="btn-link">
                            Open
                          </Link>
                        )}
                        {profileLink && isUserReport && (
                          <Link to={profileLink} className="btn-link">
                            Profile
                          </Link>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => updateReportStatus(r.id, "reviewed")}
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => updateReportStatus(r.id, "closed")}
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => closeAndHideReport(r.id)}
                        >
                          Close + hide
                        </button>
                        {canDeletePosts && isPostReport && !r.post_deleted && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => deleteReportedPost(r.target_post_id, r.id)}
                          >
                            Delete post
                          </button>
                        )}
                        {isPostReport && r.post_deleted && <span className="topic-meta">post deleted</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === "tag-audit" ? (
          tagAudit.length === 0 ? (
            <p className="topic-meta">No tag changes yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tagAudit.map((a) => (
                <div key={a.id} className="tag-audit-item">
                  <div style={{ fontWeight: 600 }}>{a.action}</div>
                  <div className="topic-meta">
                    {a.changed_by || "unknown"} | {new Date(a.created_at).toLocaleString("sk-SK")}
                  </div>
                  <div className="topic-meta">old: {a.old_name || "-"}</div>
                  <div className="topic-meta">new: {a.new_name || "-"}</div>
                </div>
              ))}
            </div>
          )
        ) : (
          wikiChanges.length === 0 ? (
            <p className="topic-meta">No recent changes.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wikiChanges.map((c, i) => (
                <div key={`${c.article_id}-${i}`} className="tag-audit-item">
                  <div style={{ fontWeight: 600 }}>
                    <Link to={`/wiki/${c.slug}`}>{c.title}</Link>
                  </div>
                  <div className="topic-meta">
                    {c.changed_by || "unknown"} | {new Date(c.created_at).toLocaleString("sk-SK")}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}



