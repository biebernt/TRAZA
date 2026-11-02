import "./Home.css";

const previewMap = Array.from({ length: 64 }, (_, index) => {
  const row = Math.floor(index / 8);
  const column = index % 8;
  if (row === 3 || column === 4) return "road";
  if ((row < 3 && column > 4) || (row > 4 && column < 2)) return "park";
  if (row === 4 && column === 5) return "school";
  if (row === 4 || column === 3) return "business";
  if ((row + column) % 4 === 0) return "empty";
  return "house";
});

export default function Home({ navigate }) {
  return (
    <div className="home-page traza-container">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <span className="home-kicker">UNA MEJOR CIUDAD EMPIEZA CON UN MEJOR DISEÑO</span>
          <h1 id="home-title">Cada gran idea<br />empieza con una <em>buena ubicación.</em></h1>
          <p>Diseña escenarios urbanos y compara ubicaciones comerciales. Dale forma a tus ideas y comprende el territorio antes de dar el siguiente paso.</p>
          <div className="home-actions">
            <button type="button" className="traza-btn traza-btn-primary" onClick={() => navigate("urban")}>Abrir Urban Studio</button>
            <button type="button" className="traza-btn traza-btn-secondary" onClick={() => navigate("intelligence")}>Comparar ubicaciones</button>
          </div>
          <span className="home-hero-note">Herramientas visuales para explorar mejores decisiones.</span>
        </div>
        <div className="home-preview" aria-label="Ilustración de un escenario urbano de ejemplo">
          <div className="home-preview-heading"><span>EXPLORACIÓN TERRITORIAL</span><span className="home-preview-dot" aria-hidden="true" /></div>
          <div className="home-preview-map" aria-hidden="true">{previewMap.map((type, index) => <span key={index} className={`home-tile home-tile-${type}`} />)}</div>
          <div className="home-preview-caption"><strong>Un espacio, muchas posibilidades.</strong><span>Urban Studio</span></div>
          <div className="home-map-legend" aria-hidden="true"><span>Vivienda</span><span>Áreas verdes</span><span>Comercio</span></div>
        </div>
      </section>

      <section className="home-tools" aria-labelledby="home-tools-title">
        <div className="home-section-heading"><div><span className="home-kicker">TU PUNTO DE PARTIDA</span><h2 id="home-tools-title">Dos herramientas. Nuevas perspectivas.</h2></div><p>Para emprendedores, empresas y personas que quieren explorar cómo se organiza una ciudad.</p></div>
        <div className="home-tool-grid">
          <article className="traza-card home-tool-card">
            <span className="home-module-number">01 / DISEÑA</span><h3>Urban Studio</h3><p>Construye un escenario a tu manera. Distribuye viviendas, calles, comercios, parques y escuelas en un editor visual.</p>
            <ul><li>Cuadrícula interactiva de 10 × 10</li><li>Indicadores y observaciones del diseño</li><li>Guardado y carga de proyectos</li></ul>
            <button type="button" className="home-text-button" onClick={() => navigate("urban")}>Empezar un diseño</button>
          </article>
          <article className="traza-card home-tool-card">
            <span className="home-module-number">02 / COMPARA</span><h3>Location Intelligence</h3><p>Explora qué ubicación obtiene la mejor puntuación para tu negocio según demanda, accesibilidad, competencia y servicios.</p>
            <ul><li>Tres tipos de negocios para explorar</li><li>Comparación de zonas y puntuaciones</li><li>Resultados con datos de ejemplo</li></ul>
            <button type="button" className="home-text-button" onClick={() => navigate("intelligence")}>Explorar ubicaciones </button>
          </article>
        </div>
      </section>

      <section className="home-process traza-card" aria-labelledby="home-process-title">
        <div><span className="home-kicker">DE LA IDEA AL ESCENARIO</span><h2 id="home-process-title">Empieza con una pregunta.</h2><p>¿Cómo distribuirías un barrio? ¿Dónde abrirías tu próximo negocio?</p></div>
        <ol><li><strong>Elige una herramienta</strong><span>Diseña un entorno o compara zonas.</span></li><li><strong>Explora alternativas</strong><span>Cambia el diseño o el tipo de negocio.</span></li><li><strong>Interpreta los resultados</strong><span>Revisa indicadores y encuentra oportunidades.</span></li></ol>
      </section>
      <footer className="home-footer"><p><strong>Exploración con propósito.</strong> TRAZA es un prototipo educativo de Jóvenes creaTIvos 2026, Panamá. Los análisis comerciales utilizan datos ficticios y las observaciones urbanas se basan en reglas de ejemplo; no sustituyen estudios profesionales.</p><button type="button" className="home-text-button" onClick={() => navigate("contact")}>Hablemos de tu idea <span className="home-link-arrow" aria-hidden="true" /></button></footer>
    </div>
  );
}
