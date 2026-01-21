import { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function ProfileEdit() {
  const { user } = useAuth();
  const toast = useToast();
  const NICK_MAX = 30;
  const ABOUT_MAX = 500;
  const AVATAR_MAX = 500;
  const [form, setForm] = useState({
    nickname: "",
    avatar_url: "",
    hide_badges: false,
    about: "",
  });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [badges, setBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [message, setMessage] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const cleanNickname = form.nickname.trim();
  const canSaveProfile =
    cleanNickname.length >= 2 &&
    cleanNickname.length <= NICK_MAX &&
    form.about.length <= ABOUT_MAX &&
    form.avatar_url.length <= AVATAR_MAX;

  useEffect(() => {
    const load = async () => {
      try {
        const me = await api.get("/profile/me");
        setForm({
          nickname: me.data.nickname || me.data.username,
          avatar_url: me.data.avatar_url || "",
          hide_badges: !!me.data.hide_badges,
          about: me.data.about || "",
        });
        const b = await api.get("/badges");
        setBadges(b.data);
        setMyBadges(me.data.badge_ids || []);
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const saveProfile = async () => {
    setMessage("");
    try {
      await api.patch("/profile/me", {
        nickname: form.nickname,
        avatar_url: form.avatar_url,
        hide_badges: form.hide_badges,
        about: form.about,
      });
      setMessage("Profil ulozeny.");
      toast.success("Profil ulozeny.");
    } catch (err) {
      console.error(err);
      setMessage("Chyba pri ukladani profilu.");
      toast.error("Nepodarilo sa ulozit profil.");
    }
  };

  const changePassword = async () => {
    setMessage("");
    try {
      await api.post("/profile/change-password", passwords);
      setMessage("Heslo zmenene.");
      setPasswords({ currentPassword: "", newPassword: "" });
      toast.success("Heslo zmenene.");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.message || "Chyba pri zmene hesla.");
      toast.error("Nepodarilo sa zmenit heslo.");
    }
  };

  const toggleBadge = async (id) => {
    setMessage("");
    const has = myBadges.includes(id);
    try {
      if (has) {
        await api.delete(`/badges/assign/${id}`);
        setMyBadges((prev) => prev.filter((b) => b !== id));
      } else {
        await api.post("/badges/assign", { badgeId: id });
        setMyBadges((prev) => [...prev, id]);
      }
    } catch (err) {
      console.error(err);
      setMessage("Chyba pri zmene badge.");
      toast.error("Nepodarilo sa zmenit badge.");
    }
  };

  const uploadAvatar = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      setAvatarUploading(true);
      const res = await api.post("/uploads/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data?.url;
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Upload zlyhal.");
      return null;
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const url = await uploadAvatar(file);
    if (url) setForm((prev) => ({ ...prev, avatar_url: url }));
  };

  if (!user) {
    return (
      <div className="page">
        <div className="card">Musis byt prihlaseny.</div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="card" style={{ borderRadius: 16, padding: 20 }}>
        <h2>Upravit profil</h2>
        <div className="profile-edit-grid">
          <div>
            <label className="topic-meta">Username</label>
            <div style={{ background: "var(--chip-bg)", padding: 10, borderRadius: 10 }}>{user.username}</div>
          </div>
          <div>
            <label className="topic-meta">Nickname</label>
            <input
              value={form.nickname}
              onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
              placeholder="Zobrazovane meno"
              maxLength={NICK_MAX}
            />
            <div className="field-hint">
              <span>2-30 chars</span>
              <span>{form.nickname.length}/{NICK_MAX}</span>
            </div>
          </div>
          <div>
            <label className="topic-meta">Avatar URL</label>
            <input
              value={form.avatar_url}
              onChange={(e) => setForm((p) => ({ ...p, avatar_url: e.target.value }))}
              placeholder="https://..."
              maxLength={AVATAR_MAX}
            />
            <div className="field-hint">
              <span>{form.avatar_url.length}/{AVATAR_MAX}</span>
            </div>
          </div>
          <div>
            <label className="topic-meta">Nahlad avataru</label>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 12,
                background: "var(--chip-bg)",
                border: "1px solid var(--chip-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                opacity: avatarUploading ? 0.7 : 1,
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleAvatarDrop}
              title="Drag & drop obrazok alebo vloz URL vyssie"
            >
              {form.avatar_url ? (
                <img src={form.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "#9ca3af", fontSize: 28 }}>
                  {form.nickname?.[0] || user.username?.[0]}
                </span>
              )}
            </div>
            {avatarUploading && <div className="topic-meta" style={{ marginTop: 6 }}>Nahravam...</div>}
          </div>
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={form.hide_badges}
            onChange={(e) => setForm((p) => ({ ...p, hide_badges: e.target.checked }))}
          />
          Skryt badges na profile a v komentaroch
        </label>

        <div style={{ marginTop: 12 }}>
          <label className="topic-meta">About</label>
          <textarea
            rows={4}
            value={form.about}
            onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))}
            placeholder="Kratky popis o tebe"
            maxLength={ABOUT_MAX}
          />
          <div className="field-hint">
            <span>{form.about.length}/{ABOUT_MAX}</span>
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ marginTop: 12 }}
          onClick={saveProfile}
          disabled={!canSaveProfile}
        >
          Ulozit profil
        </button>

        <h3 style={{ marginTop: 20 }}>Zmena hesla</h3>
        <div className="profile-password-grid">
          <input
            type="password"
            placeholder="Aktualne heslo"
            value={passwords.currentPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Nove heslo"
            value={passwords.newPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
          />
        </div>
        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={changePassword}>
          Zmenit heslo
        </button>

        <h3 style={{ marginTop: 20 }}>Badges</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {badges.map((b) => {
            const active = myBadges.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBadge(b.id)}
                className="tag-pill"
                style={{
                  background: active ? "var(--accent)" : "var(--chip-bg)",
                  borderColor: active ? "var(--accent)" : "var(--chip-border)",
                  color: active ? "#fff" : "var(--text)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {b.icon_url && <img src={b.icon_url} alt={b.name} style={{ width: 16, height: 16 }} />}
                {b.name}
              </button>
            );
          })}
        </div>

        {message && <p style={{ marginTop: 10, color: "#10b981" }}>{message}</p>}
      </div>
    </div>
  );
}
