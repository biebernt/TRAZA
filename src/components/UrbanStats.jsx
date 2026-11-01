import { analyzeUrbanMap } from "../utils/urbanAnalysis";

export default function UrbanStats({ map }) {
  const analysis = analyzeUrbanMap(map);

  const indicators = [
    {
      label: "Ocupación del terreno",
      value: `${analysis.occupationPercentage}%`
    },
    {
      label: "Áreas verdes",
      value: `${analysis.greenPercentage}%`
    },
    {
      label: "Viviendas",
      value: analysis.counts.house
    },
    {
      label: "Comercios",
      value: analysis.counts.business
    },
    {
      label: "Escuelas",
      value: analysis.counts.school
    },
    {
      label: "Carreteras",
      value: analysis.counts.road
    }
  ];

  return (
    <section className="urban-stats">
      <h2>Indicadores urbanos</h2>

      <div className="urban-stats-grid">
        {indicators.map(indicator => (
          <article key={indicator.label} className="urban-stat-card">
            <span>{indicator.label}</span>
            <strong>{indicator.value}</strong>
          </article>
        ))}
      </div>

      <div className="urban-recommendations">
        <h3>Observaciones del diseño</h3>

        <ul>
          {analysis.recommendations.map((text, index) => (
            <li key={index}>{text}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}