import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const [canEditWiki, setCanEditWiki] = useState(false);
  const [canManageReactions, setCanManageReactions] = useState(false);
  const profileRef = useRef(null);
  const adminRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  useEffect(() => {
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (adminRef.current && !adminRef.current.contains(e.target)) {
        setAdminOpen(false);
      }
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      if (!user) {
        setNotifCount(0);
        setMsgCount(0);
        setCanEditWiki(false);
        setCanManageReactions(false);
        return;
      }
      try {
        const [n, m, p] = await Promise.all([
          api.get("/notifications/unread-count"),
          api.get("/messages/unread/count/mine"),
          api.get("/moderation/permissions/me")
        ]);
        setNotifCount(n.data?.count || 0);
        setMsgCount(m.data?.count || 0);
        setCanEditWiki(user.role === "admin" || !!p.data?.can_edit_wiki);
        setCanManageReactions(user.role === "admin" || !!p.data?.can_manage_reactions);
      } catch (err) {
        console.error(err);
      }
    };
    loadCounts();
  }, [user]);

  // reaguj na oznacovanie notifikacii ako precitanych (posielame custom event z NotificationsPage)
  useEffect(() => {
    const onNotifRead = (e) => {
      const dec = e?.detail?.count ?? 1;
      setNotifCount((prev) => Math.max(0, prev - dec));
    };
    window.addEventListener("notif-read", onNotifRead);
    return () => window.removeEventListener("notif-read", onNotifRead);
  }, []);

  useEffect(() => {
    const onMsgRead = (e) => {
      const dec = e?.detail?.count ?? 1;
      setMsgCount((prev) => Math.max(0, prev - dec));
    };
    window.addEventListener("msg-read", onMsgRead);
    return () => window.removeEventListener("msg-read", onMsgRead);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/" className="logo">
          PDX Forum
        </Link>

        <select
          className="theme-select"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          aria-label="Theme"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <nav className="nav-links">
          <Link to="/forum">Fórum</Link>
          <Link to="/wiki">Wiki</Link>
        </nav>
      </div>

      <div className="navbar-right">
        {user ? (
          <>
            <div
              ref={profileRef}
              style={{ position: "relative" }}
            >
              <button
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen((v) => !v);
                  setAdminOpen(false);
                }}
              >
                {user.username}
              </button>
              {profileOpen && (
                <div
                  className="menu-panel"
                  style={{
                    position: "absolute",
                    right: 0,
                    marginTop: 6,
                    borderRadius: 10,
                    minWidth: 160,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    zIndex: 20,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to="/profile" className="btn-link">Profil</Link>
                  <Link to="/settings/profile" className="btn-link">Upraviť profil</Link>
                  <button
                    className="btn-link"
                    style={{ textAlign: "left" }}
                    onClick={handleLogout}
                  >
                    Odhlásiť sa
                  </button>
                </div>
              )}
            </div>

            {(user.role === "admin" || user.role === "moderator") && (
              <div ref={adminRef} style={{ position: "relative" }}>
                <button
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdminOpen((v) => !v);
                    setProfileOpen(false);
                  }}
                >
                  Správa
                </button>
                {adminOpen && (
                  <div
                    className="menu-panel"
                    style={{
                      position: "absolute",
                      right: 0,
                      marginTop: 6,
                      borderRadius: 10,
                      minWidth: 180,
                      padding: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      zIndex: 20,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link to="/manage/meta" className="btn-link">Tagy & Badge</Link>
                    {(user.role === "admin" || canManageReactions) && (
                      <Link to="/manage/reactions" className="btn-link">Reakcie</Link>
                    )}
                     {(user.role === "admin" || canEditWiki) && (
                      <Link to="/wiki/new" className="btn-link">Novy clanok</Link>
                    )}
                    <Link to="/moderation" className="btn-link">Moderation</Link>
                    {user.role === "admin" && <Link to="/admin" className="btn-link">Admin panel</Link>}
                  </div>
                )}
              </div>
            )}

            <Link to="/notifications" className="btn-secondary" style={{ position: "relative" }}>
              🔔
              {notifCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "999px",
                  fontSize: 10,
                  padding: "2px 5px"
                }}>{notifCount}</span>
              )}
            </Link>

            <Link to="/messages/1" className="btn-secondary" style={{ position: "relative" }}>
              ✉️
              {msgCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "999px",
                  fontSize: 10,
                  padding: "2px 5px"
                }}>{msgCount}</span>
              )}
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-link">
              Prihlásenie
            </Link>
            <Link to="/register" className="btn-primary">
              Registrácia
            </Link>
          </>
        )}
      </div>
    </header>
  );
}




