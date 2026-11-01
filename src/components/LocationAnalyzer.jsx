import { useState } from "react";
import { zones, businessTypes } from "../data/zones";
import { getLocationBreakdown, rankLocations } from "../utils/locationAlgorithm";
import "./LocationAnalyzer.css";

const formatPoints = value => value.toLocaleString("es-PA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export default function LocationAnalyzer() {
  const [business, setBusiness] = useState("cafeteria");
  const results = rankLocations(zones, business);
  const best = results[0];
  const weights = getLocationBreakdown(best, business);
  const strongest = [...weights].sort((a, b) => b.contribution - a.contribution)[0];
  const difference = best.score - results[1].score;

  return (
    <section className="location-analyzer" aria-labelledby="location-title">
      <header className="location-header">
        <span className="location-kicker">COMPARA CON CRITERIO</span>
        <h1 id="location-title">TRAZA Location Intelligence</h1>
        <p>Una ubicación puede ofrecer distintas ventajas según tu negocio. Compara zonas y descubre qué hay detrás de cada puntuación.</p>
        <span className="location-demo">Datos ficticios · Análisis demostrativo</span>
      </header>

      <section className="location-settings traza-card" aria-labelledby="location-settings-title">
        <div><h2 id="location-settings-title">¿Qué negocio tienes en mente?</h2><p>Al cambiar de negocio, se ajusta la importancia de cada criterio.</p></div>
        <div className="location-select"><label htmlFor="business-type">Tipo de negocio</label><select id="business-type" value={business} onChange={event => setBusiness(event.target.value)}>{Object.entries(businessTypes).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}</select></div>
        <div className="location-weights">{weights.map(criterion => <div key={criterion.key}><span>{criterion.label}</span><strong>{Math.round(criterion.weight * 100)}%</strong></div>)}</div>
      </section>

      <div className="location-summary" role="status" aria-live="polite" aria-atomic="true"><span className="location-kicker">MAYOR PUNTUACIÓN · {businessTypes[business].name}</span><h2>{best.name} <span>{best.score}/100</span></h2><p>Obtiene {difference} puntos más que la siguiente zona. Su mayor aporte al total viene de <strong>{strongest.label.toLowerCase()}</strong>: {formatPoints(strongest.contribution)} puntos.</p><p className="location-summary-note">La puntuación expresa una comparación entre estos ejemplos; no es una probabilidad de éxito.</p></div>

      <section aria-labelledby="location-results-title">
        <div className="location-section-heading"><h2 id="location-results-title">Compara las tres zonas</h2><p>Ordenadas de mayor a menor puntuación.</p></div>
        <div className="location-results">{results.map((zone, index) => {
          const breakdown = getLocationBreakdown(zone, business);
          return <article className={`location-card traza-card${index === 0 ? " location-card-best" : ""}`} key={zone.id}>
            <div className="location-card-top"><span>0{index + 1}</span>{index === 0 && <span className="location-best-badge">Mejor puntuación</span>}</div>
            <h3>{zone.name}</h3><div className="location-score"><strong>{zone.score}</strong><span>/100 puntos</span></div>
            <div className="location-score-track" aria-hidden="true"><div style={{ width: `${zone.score}%` }} /></div>
            <dl className="location-metrics">{breakdown.map(criterion => <div key={criterion.key}><dt>{criterion.label}</dt><dd>{criterion.value}<span>/100</span></dd></div>)}</dl>
            <details className="location-breakdown"><summary>Ver cálculo de {zone.name.toLowerCase()}</summary><ul>{breakdown.map(criterion => <li key={criterion.key}><strong>{criterion.label}</strong><span>{criterion.key === "competition" ? `(100 − ${criterion.value})` : criterion.value} × {Math.round(criterion.weight * 100)}% = {formatPoints(criterion.contribution)} puntos</span></li>)}</ul><p>Total: {formatPoints(breakdown.reduce((total, criterion) => total + criterion.contribution, 0))} → <strong>{zone.score}/100</strong> al redondear.</p></details>
          </article>;
        })}</div>
      </section>

      <section className="location-method traza-card" aria-labelledby="location-method-title"><div><span className="location-kicker">UN CÁLCULO TRANSPARENTE</span><h2 id="location-method-title">¿Cómo se obtiene el resultado?</h2></div><div><p>Cada indicador está expresado sobre 100. Multiplicamos su valor por el peso del negocio seleccionado, sumamos los cuatro aportes y redondeamos el total al entero más cercano.</p><p><strong>La competencia funciona al revés:</strong> usamos 100 menos su valor. En este modelo, una competencia menor aporta más puntos. La demanda usa el indicador de población de cada zona como aproximación de ejemplo.</p><p className="location-method-note">Estas ponderaciones son ilustrativas. Los datos no representan ubicaciones reales verificadas de Panamá y el resultado no garantiza rentabilidad. Este módulo utiliza un algoritmo de puntuación, no inteligencia artificial.</p></div></section>
    </section>
  );
}
