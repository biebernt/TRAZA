export default function Home({ navigate }) {
  return (
    <div className="home-page">
      <div className="hero">
        <span className="eyebrow">
          URBAN INTELLIGENCE PLATFORM
        </span>

        <h1>
          Ciudades más inteligentes.
          <br />
          Decisiones más estratégicas.
        </h1>

        <p>
          TRAZA transforma la planificación urbana
          mediante herramientas digitales que permiten
          diseñar ciudades, analizar ubicaciones
          comerciales y evaluar oportunidades de desarrollo.
        </p>

        <div className="hero-actions">
          <button onClick={() => navigate("urban")}>
            Explorar Urban Studio
          </button>

          <button
            className="secondary-button"
            onClick={() => navigate("intelligence")}
          >
            Analizar ubicaciones
          </button>
        </div>
      </div>

      <section className="home-features">
        <h2>Una plataforma. Múltiples posibilidades.</h2>

        <div className="feature-grid">
          <article>
            <h3>Planificación urbana</h3>
            <p>
              Diseña y modifica escenarios urbanos
              desde un editor interactivo.
            </p>
          </article>

          <article>
            <h3>Inteligencia comercial</h3>
            <p>
              Compara ubicaciones mediante indicadores
              de demanda, competencia y accesibilidad.
            </p>
          </article>

          <article>
            <h3>Desarrollo sostenible</h3>
            <p>
              Explora propuestas que consideren
              servicios, infraestructura y áreas verdes.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}