const services = [
  {
    id: 1,
    name: "Urban Studio",
    category: "Planificación urbana",
    description:
      "Diseña escenarios urbanos y visualiza diferentes propuestas de desarrollo.",
    icon: "🏙️"
  },
  {
    id: 2,
    name: "Location Intelligence",
    category: "Análisis comercial",
    description:
      "Evalúa ubicaciones comerciales mediante indicadores y puntuaciones.",
    icon: "📍"
  },
  {
    id: 3,
    name: "Urban Impact",
    category: "Consultoría urbana",
    description:
      "Servicio propuesto para evaluar el impacto de intervenciones urbanas.",
    icon: "🌱"
  }
];

export default function Services({ navigate }) {
  return (
    <div className="page-container">
      <h1>Nuestros servicios</h1>
      <p>
        Soluciones digitales para empresas,
        emprendedores y gobiernos.
      </p>

      <div className="feature-grid">
        {services.map(service => (
          <article className="service-card" key={service.id}>
            <div className="service-icon">
              {service.icon}
            </div>

            <small>{service.category}</small>
            <h2>{service.name}</h2>
            <p>{service.description}</p>

            <button onClick={() => navigate("contact")}>
              Solicitar información
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}