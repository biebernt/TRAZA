import "./Services.css";

const tools = [
  {
    id: "urban",
    number: "01",
    name: "Urban Studio",
    category: "PLANIFICACIÓN URBANA",
    description: "De una idea a un escenario que puedes explorar. Distribuye espacios y descubre cómo cambia el equilibrio de tu diseño.",
    features: ["Editor visual de 10 × 10 celdas", "Viviendas, calles, comercios, parques y escuelas", "Indicadores y observaciones basadas en reglas", "Guardado y carga del último proyecto"],
    audience: "Para explorar la distribución de un barrio o ensayar una propuesta urbana.",
    action: "Abrir Urban Studio"
  },
  {
    id: "intelligence",
    number: "02",
    name: "Location Intelligence",
    category: "ANÁLISIS COMERCIAL",
    description: "Una nueva perspectiva para tu negocio. Compara zonas de ejemplo según los factores que influyen en su puntuación.",
    features: ["Cafeterías, farmacias y supermercados", "Comparación de tres zonas ficticias", "Demanda, accesibilidad, competencia y servicios", "Clasificación con puntuaciones sobre 100"],
    audience: "Para emprendedores y empresas que quieren comprender criterios de ubicación.",
    action: "Comparar ubicaciones"
  }
];

export default function Services({ navigate }) {
  return (
    <div className="services-page traza-container">
      <header className="services-header">
        <span className="services-kicker">HERRAMIENTAS CON PROPÓSITO</span>
        <h1>Tu próxima decisión,<br /><em>con una perspectiva más amplia.</em></h1>
        <p>Explora el territorio desde dos enfoques: cómo organizar un entorno urbano y qué factores considerar al elegir una ubicación comercial.</p>
        <div className="services-header-note"><span aria-hidden="true" />Dos herramientas disponibles en este prototipo educativo</div>
      </header>

      <section className="services-tools" aria-labelledby="services-tools-title">
        <div className="services-section-heading"><h2 id="services-tools-title">Elige por dónde empezar</h2><p>Diseña un escenario o compara alternativas.</p></div>
        <div className="services-grid">
          {tools.map(tool => (
            <article className="services-tool traza-card" key={tool.id} aria-labelledby={`service-${tool.id}`}>
              <div className="services-tool-top"><span className="services-number" aria-hidden="true">{tool.number}</span><span className="services-badge">Disponible</span></div>
              <span className="services-kicker">{tool.category}</span>
              <h3 id={`service-${tool.id}`}>{tool.name}</h3>
              <p>{tool.description}</p>
              <ul>{tool.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
              <div className="services-audience"><strong>¿Para qué usarlo?</strong><p>{tool.audience}</p></div>
              <button type="button" className="traza-btn traza-btn-primary" onClick={() => navigate(tool.id)}>{tool.action}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="services-future traza-card" aria-labelledby="urban-impact-title">
        <div className="services-future-intro"><span className="services-badge services-badge-future">Propuesta futura · No disponible</span><h2 id="urban-impact-title">Urban Impact</h2><span className="services-kicker">EVALUACIÓN DE INTERVENCIONES URBANAS</span></div>
        <div><p>Una línea de trabajo propuesta para explorar el impacto de cambios en el entorno urbano y apoyar la comparación de escenarios.</p><p className="services-future-note">Esta capacidad todavía no está implementada. Puedes compartirnos qué necesitarías evaluar.</p><button type="button" className="traza-btn traza-btn-secondary" onClick={() => navigate("contact")}>Consultar sobre Urban Impact</button></div>
      </section>

      <footer className="services-footer"><p><strong>Explora con contexto.</strong> Las puntuaciones comerciales usan datos ficticios y las observaciones urbanas se basan en reglas de ejemplo. No sustituyen estudios profesionales ni garantizan resultados comerciales. Guardar y cargar proyectos requiere conexión con el servidor.</p><button type="button" className="traza-btn traza-btn-secondary" onClick={() => navigate("contact")}>Cuéntanos tu idea</button></footer>
    </div>
  );
}
