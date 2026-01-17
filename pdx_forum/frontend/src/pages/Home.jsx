import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Vitaj na PDX fóre</h1>
        <p className="page-subtitle">
          Komunitná platforma pre hry Paradox Interactive – stratégie, návody,
          modifikácie a diskusie.
        </p>
      </div>

      <div className="card">
        <h2>Začni diskusiou</h2>
        <p>
          Prejdi do fóra, nájdi hru, ktorá ťa zaujíma, a zapoj sa do diskusií
          alebo vytvor vlastnú tému.
        </p>
        <Link
          to="/forum"
          className="btn-primary"
          style={{ display: "inline-block", marginTop: 10 }}
        >
          Otvoriť fórum
        </Link>
      </div>
    </div>
  );
}
