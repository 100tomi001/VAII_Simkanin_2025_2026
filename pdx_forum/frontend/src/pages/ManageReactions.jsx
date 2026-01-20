import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const slugify = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const isImageIcon = (icon) =>
  typeof icon === "string" &&
  (icon.startsWith("http") || icon.startsWith("blob:") || icon.startsWith("data:"));

export default function ManageReactions() {
  const { user } = useAuth();
  const toast = useToast();
  const [reactions, setReactions] = useState([]);
  const [newReaction, setNewReaction] = useState({ key: "", label: "", icon: "" });
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const [r, p] = await Promise.all([
          api.get("/reactions"),
          api.get("/moderation/permissions/me"),
        ]);
        setReactions(r.data);
        setCanManage(user.role === "admin" || !!p.data?.can_manage_reactions);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, [user]);

  if (!user || !canManage) {
    return (
      <div className="page">
        <div className="card">Admins and permitted moderators only.</div>
      </div>
    );
  }

  const addReaction = async () => {
    if (!newReaction.label.trim()) return;
    const key = newReaction.key.trim() || slugify(newReaction.label);
    if (!key) return;
    try {
      const res = await api.post("/reactions", {
        key,
        label: newReaction.label.trim(),
        icon: newReaction.icon || null,
      });
      setReactions((prev) => [...prev, res.data]);
      setNewReaction({ key: "", label: "", icon: "" });
      setError("");
      toast.success("Reaction created.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to create reaction.");
      toast.error("Failed to create reaction.");
    }
  };

  const deleteReaction = async (r) => {
    if (r.key === "like") {
      setError("Like reaction cannot be deleted.");
      return;
    }
    if (!window.confirm("Delete reaction?")) return;
    try {
      await api.delete(`/reactions/${r.id}`);
      setReactions((prev) => prev.filter((x) => x.id !== r.id));
      setError("");
      toast.success("Reaction deleted.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to delete reaction.");
      toast.error("Failed to delete reaction.");
    }
  };

  const uploadReactionFile = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      setUploading(true);
      const res = await api.post("/uploads/reaction", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data?.url;
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Upload failed.");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = await uploadReactionFile(file);
    if (url) setNewReaction((p) => ({ ...p, icon: url }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Manage Reactions</h1>
        <p className="page-subtitle">Create and remove custom reactions.</p>
      </div>

      {error && <p style={{ color: "salmon" }}>{error}</p>}

      <div className="card" style={{ display: "grid", gap: 16 }}>
        <div
          className="card"
          style={{ background: "var(--topic-bg)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          title="Drag & drop icon or paste URL"
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={newReaction.label}
              onChange={(e) => setNewReaction((p) => ({ ...p, label: e.target.value }))}
              placeholder="Label"
            />
            <input
              value={newReaction.key}
              onChange={(e) => setNewReaction((p) => ({ ...p, key: e.target.value }))}
              placeholder="Key (optional)"
            />
            <input
              value={newReaction.icon}
              onChange={(e) => setNewReaction((p) => ({ ...p, icon: e.target.value }))}
              placeholder="Icon URL or emoji"
            />
            <button className="btn-primary" type="button" onClick={addReaction}>
              Add
            </button>
          </div>
          {newReaction.icon && (
            <div style={{ marginTop: 8 }}>
              {isImageIcon(newReaction.icon) ? (
                <img src={newReaction.icon} alt="" style={{ width: 28, height: 28 }} />
              ) : (
                <span style={{ fontSize: 20 }}>{newReaction.icon}</span>
              )}
            </div>
          )}
          {uploading && <div className="topic-meta" style={{ marginTop: 6 }}>Uploading...</div>}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {reactions.map((r) => (
            <div
              key={r.id}
              className="reaction-pill"
              title={r.label}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {r.icon ? (
                isImageIcon(r.icon) ? (
                  <img src={r.icon} alt={r.label} style={{ width: 20, height: 20 }} />
                ) : (
                  <span style={{ fontSize: 16 }}>{r.icon}</span>
                )
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: 4, background: "var(--chip-bg)" }} />
              )}
              <span>{r.label}</span>
              <button
                type="button"
                className="btn-link"
                style={{ padding: 0 }}
                onClick={() => deleteReaction(r)}
              >
                x
              </button>
            </div>
          ))}
          {reactions.length === 0 && <p className="topic-meta">No reactions.</p>}
        </div>
      </div>
    </div>
  );
}
