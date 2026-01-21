import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Register() {
  const [username, setU] = useState("");
  const [email, setE] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const cleanUsername = username.trim();
  const cleanEmail = email.trim();
  const passwordValue = password;
  const usernameError =
    cleanUsername.length > 0 &&
    (cleanUsername.length < 3 ||
      cleanUsername.length > 30 ||
      /\s/.test(cleanUsername));
  const emailError =
    cleanEmail.length > 0 &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254);
  const passwordError =
    passwordValue.length > 0 &&
    (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(passwordValue));
  const formError =
    usernameError
      ? "Username must be 3-30 chars, no spaces."
      : emailError
      ? "Email is invalid."
      : passwordError
      ? "Password must be 8-72 chars and include a letter and a number."
      : "";
  const canSubmit = !usernameError && !emailError && !passwordError;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) {
      setError(formError || "Invalid input.");
      return;
    }

    try {
      await api.post("/auth/register", {
        username: cleanUsername,
        email: cleanEmail,
        password,
      });

      navigate("/login");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Chyba pri registrácii");
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420 }}>
        <h2>Registrácia</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Používateľské meno"
            value={username}
            onChange={(e) => setU(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setE(e.target.value)}
          />
          <input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setP(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            Vytvoriť účet
          </button>
        </form>
        {(error || formError) && (
          <p style={{ color: "salmon", marginTop: 8 }}>
            {error || formError}
          </p>
        )}

        <p style={{ marginTop: 14, fontSize: "0.9rem", color: "#9ca3af" }}>
          Už máš účet?{" "}
          <Link to="/login" style={{ textDecoration: "underline" }}>
            Prihlás sa
          </Link>
        </p>
      </div>
    </div>
  );
}


