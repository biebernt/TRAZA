import "./Navbar.css";

const navigation = [
  { id: "home", label: "Inicio" },
  { id: "services", label: "Servicios" },
  { id: "urban", label: "Urban Studio" },
  { id: "intelligence", label: "Location Intelligence" },
  { id: "contact", label: "Contacto" },
  { id: "admin", label: "Administración" }
];

export default function Navbar({ page, navigate }) {
  return (
    <aside className="traza-navbar">
      <div className="brand">
        <h1>TRAZA</h1>
        <p>Urban Intelligence</p>
      </div>

      <nav aria-label="Navegación principal">
        {navigation.map(item => (
          <button
            key={item.id}
            className={page === item.id ? "nav-active" : ""}
            onClick={() => navigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="navbar-footer">
        <small>TRAZA © 2026</small>
      </div>
    </aside>
  );
}