import { useState } from "react";
import "./Navbar.css";
import trazaLogo from "../resources/t..png";

const navigation = [
  { id: "home", label: "Inicio", symbol: "⌂" },
  { id: "services", label: "Servicios", symbol: "◇" },
  { id: "urban", label: "Urban Studio", symbol: "▦" },
  { id: "intelligence", label: "Location Intelligence", symbol: "◎" },
  { id: "contact", label: "Contacto", symbol: "✉" },
  { id: "admin", label: "Administración", symbol: "⚙" }
];

export default function Navbar({ page, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function selectPage(id) {
    navigate(id);
    setMenuOpen(false);
  }

  return (
    <aside className="traza-navbar">
      <div className="navbar-top">
        <button type="button" className="brand" aria-label="TRAZA, ir al inicio" onClick={() => selectPage("home")}>
          <img className="brand-logo" src={trazaLogo} alt="" width="44" height="44" />
          <span><strong>TRAZA</strong><small>Urban Intelligence</small></span>
        </button>
        <button type="button" className="navbar-toggle" aria-expanded={menuOpen} aria-controls="traza-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? "Cerrar" : "Menú"}<span aria-hidden="true">{menuOpen ? "×" : "☰"}</span></button>
      </div>
      <nav id="traza-navigation" className={menuOpen ? "navbar-navigation is-open" : "navbar-navigation"} aria-label="Navegación principal">
        <span className="navbar-section-label">EXPLORA TRAZA</span>
        {navigation.map(item => (
          <button type="button" key={item.id} className={page === item.id ? "nav-active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => selectPage(item.id)}>
            <span className="navbar-symbol" aria-hidden="true">{item.symbol}</span><span>{item.label}</span>{page === item.id && <span className="navbar-active-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <div className="navbar-footer"><span className="navbar-prototype">PROTOTIPO EDUCATIVO</span><p>Ideas que dan forma<br />al territorio.</p><small>Hecho en Panamá · 2026</small></div>
    </aside>
  );
}
