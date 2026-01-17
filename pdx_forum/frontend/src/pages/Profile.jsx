import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Nie si prihlásený</h2>
          <p>Na zobrazenie profilu sa musíš prihlásiť.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <Link to="/login" className="btn-primary">
              Prihlásiť sa
            </Link>
            <Link to="/register" className="btn-secondary">
              Vytvoriť účet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Profil používateľa</h1>
        <p className="page-subtitle">
          Základné informácie o tvojom účte a aktivite na fóre.
        </p>
      </div>

      <div className="card">
        <h2>{user.username}</h2>
        <div className="profile-info-row">
          <span>Rola:</span>
          <strong>{user.role || "user"}</strong>
        </div>
        {user.email && (
          <div className="profile-info-row">
            <span>Email:</span>
            <strong>{user.email}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
