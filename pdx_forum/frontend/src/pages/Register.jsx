import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function Register() {
  const [username, setU] = useState("");
  const [email, setE] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", {
        username,
        email,
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
          <button type="submit" className="btn-primary">
            Vytvoriť účet
          </button>
        </form>
        {error && <p style={{ color: "salmon", marginTop: 8 }}>{error}</p>}

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
