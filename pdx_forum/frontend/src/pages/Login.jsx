import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [usernameOrEmail, setU] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState("");
  const cleanLogin = usernameOrEmail.trim();
  const passwordValue = password;
  const loginError =
    cleanLogin.length > 0 &&
    (cleanLogin.length < 2 || cleanLogin.length > 254);
  const passwordError = cleanLogin.length > 0 && passwordValue.length === 0;
  const formError = loginError
    ? "Username or email length is invalid."
    : passwordError
    ? "Password is required."
    : "";
  const canSubmit =
    !loginError && !passwordError && cleanLogin.length > 0 && passwordValue.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) {
      setError(formError || "Invalid input.");
      return;
    }

    try {
      const res = await api.post("/auth/login", {
        usernameOrEmail: cleanLogin,
        password: passwordValue,
      });

      login(res.data.user, res.data.token);
      navigate("/forum");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri prihlasovaní");
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420 }}>
        <h2>Prihlásenie</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Používateľské meno alebo email"
            value={usernameOrEmail}
            onChange={(e) => setU(e.target.value)}
          />
          <input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setP(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            Prihlásiť sa
          </button>
        </form>
        {(error || formError) && (
          <p style={{ color: "salmon", marginTop: 8 }}>
            {error || formError}
          </p>
        )}

        <p style={{ marginTop: 14, fontSize: "0.9rem", color: "#9ca3af" }}>
          Nemáš účet?{" "}
          <Link to="/register" style={{ textDecoration: "underline" }}>
            Registruj sa
          </Link>
        </p>
      </div>
    </div>
  );
}

