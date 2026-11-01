import { useState } from "react";
import { zones, businessTypes } from "../data/zones";
import { rankLocations } from "../utils/locationAlgorithm";
import "./LocationAnalyzer.css";

export default function LocationAnalyzer() {
  const [business, setBusiness] = useState("cafeteria");

  const results = rankLocations(zones, business);
  const best = results[0];

  return (
    <section className="location-analyzer">
      <div className="analyzer-heading">
        <h2>TRAZA Location Intelligence</h2>
        <p>
          Descubre ubicaciones potencialmente convenientes
          para establecer tu negocio.
        </p>
      </div>

      <label htmlFor="business-type">
        Selecciona el tipo de negocio
      </label>

      <select
        id="business-type"
        value={business}
        onChange={(event) => setBusiness(event.target.value)}
      >
        {Object.entries(businessTypes).map(([key, item]) => (
          <option key={key} value={key}>
            {item.name}
          </option>
        ))}
      </select>

      <div className="location-results">
        {results.map((zone, index) => (
          <article className="location-card" key={zone.id}>
            <div className="location-card-heading">
              <h3>{zone.name}</h3>
              <strong>{zone.score}/100</strong>
            </div>

            <div className="score-track">
              <div
                className="score-fill"
                style={{ width: `${zone.score}%` }}
              />
            </div>

            <p>Demanda: {zone.population}/100</p>
            <p>Accesibilidad: {zone.access}/100</p>
            <p>Competencia: {zone.competition}/100</p>
            <p>Servicios: {zone.services}/100</p>

            {index === 0 && (
              <span className="recommended">
                Mejor puntuación
              </span>
            )}
          </article>
        ))}
      </div>

      <div className="recommendation">
        <h3>Recomendación de TRAZA</h3>
        <p>
          Para una {businessTypes[business].name.toLowerCase()},
          la ubicación con mayor puntuación es
          {" "}<strong>{best.name}</strong>,
          con {best.score} puntos de 100.
        </p>
        <small>
          Análisis demostrativo basado en datos ficticios.
          No garantiza rentabilidad comercial.
        </small>
      </div>
    </section>
  );
}