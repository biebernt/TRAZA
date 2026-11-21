import { useEffect, useRef, useState } from "react";
import { zones, businessTypes } from "../data/zones";
import { getLocationBreakdown, rankLocations } from "../utils/locationAlgorithm";
import { analyzeArea } from "../utils/areaInsights";
import { getAreaInventory } from "../services/api";
import { useArea } from "../state/areaContext";
import { bboxAreaKm2, formatKm2 } from "../utils/geo";
import AreaBar from "./AreaBar";
import "./LocationAnalyzer.css";

const formatPoints = value => value.toLocaleString("es-PA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateLabel = value => new Date(value).toLocaleString("es-PA");

function AreaInsights({ business }) {
  const { area } = useArea();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  const result = data ? analyzeArea(data, business) : null;

  async function loadInventory() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");

    try {
      setData(await getAreaInventory(area.bbox, request.signal));
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return (
    <section className="location-area traza-card" aria-labelledby="location-area-title">
      <div className="location-area-heading">
        <div>
          <span className="location-kicker">ÁREA DE TRABAJO</span>
          <h2 id="location-area-title">Qué ofrece {area.name}</h2>
        </div>
        <button
          type="button"
          className="traza-btn traza-btn-primary"
          onClick={loadInventory}
          disabled={loading}
        >
          {loading ? "Consultando área..." : data ? "Volver a consultar" : "Analizar el área"}
        </button>
      </div>

      {loading && (
        <p className="traza-message" role="status">
          Consultando OpenStreetMap. La respuesta puede tardar hasta 45 segundos.
        </p>
      )}

      {error && (
        <p className="traza-message traza-message-error" role="alert">
          {error}
          {data ? " Se mantienen los resultados anteriores." : " No se obtuvo inventario; esto no significa que el área esté vacía."}
        </p>
      )}

      {result && (
        <>
          <div className="location-area-summary">
            <div className="location-score">
              <strong>{result.score}</strong>
              <span>/100 puntos · {businessTypes[business].name}</span>
            </div>
            <div className="location-score-track" aria-hidden="true">
              <div style={{ width: `${result.score}%` }} />
            </div>
            <p>
              {result.summary.totalFeatures.toLocaleString("es-PA")} elementos
              mapeados en {formatKm2(result.summary.areaKm2)}:{" "}
              {result.summary.buildings.toLocaleString("es-PA")} edificios,{" "}
              {result.summary.streetCount} vías y{" "}
              {result.summary.communityPlaces} comercios o servicios.
            </p>
          </div>

          <dl className="location-area-metrics">
            {result.breakdown.map(criterion => (
              <div key={criterion.key}>
                <dt>{criterion.label}</dt>
                <dd>
                  <strong>{criterion.value}<span>/100</span></strong>
                  <span className="location-area-raw">{result.raw[criterion.key]}</span>
                  <span className="location-area-rule">{result.rules[criterion.key]}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="location-area-source">
            <p>
              Fuente: {data.source} · Consulta: {dateLabel(data.fetchedAt)}
              {data.osmTimestamp && ` · Base OSM: ${dateLabel(data.osmTimestamp)}`}
            </p>
            <p>
              {data.cache?.stale
                ? "Datos anteriores: no se pudieron actualizar. Reintenta más tarde."
                : "La consulta se conserva en caché durante una hora por área."}
            </p>
          </div>

          
        </>
      )}
    </section>
  );
}

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
        <h1 id="location-title">URBI Location Intelligence</h1>
        <p>Una ubicación puede ofrecer distintas ventajas según tu negocio. Compara zonas y descubre qué hay detrás de cada puntuación.</p>
      </header>

      <AreaBar allowView={false} />

      <section className="location-settings traza-card" aria-labelledby="location-settings-title">
        <div><h2 id="location-settings-title">¿Qué negocio tienes en mente?</h2></div>
        <div className="location-select"><label htmlFor="business-type">Tipo de negocio</label><select id="business-type" value={business} onChange={event => setBusiness(event.target.value)}>{Object.entries(businessTypes).map(([key, item]) => <option key={key} value={key}>{item.name}</option>)}</select></div>
        <div className="location-weights">{weights.map(criterion => <div key={criterion.key}><span>{criterion.label}</span><strong>{Math.round(criterion.weight * 100)}%</strong></div>)}</div>
      </section>

      <AreaInsights business={business} />

      <div className="location-summary" role="status" aria-live="polite" aria-atomic="true"><span className="location-kicker">MAYOR PUNTUACIÓN · {businessTypes[business].name}</span><h2>{best.name} <span>{best.score}/100</span></h2></div>
      <section aria-labelledby="location-results-title">
        <div className="location-section-heading"><h2 id="location-results-title">Compara las tres zonas de ejemplo</h2></div>
        <div className="location-results">{results.map((zone, index) => {
          const breakdown = getLocationBreakdown(zone, business);
          return <article className={`location-card traza-card${index === 0 ? " location-card-best" : ""}`} key={zone.id}>
            <div className="location-card-top"><span>0{index + 1}</span>{index === 0 && <span className="location-best-badge">Mejor puntuación</span>}</div>
            <h3>{zone.name}</h3><div className="location-score"><strong>{zone.score}</strong><span>/100 puntos</span></div>
            <div className="location-score-track" aria-hidden="true"><div style={{ width: `${zone.score}%` }} /></div>
            <dl className="location-metrics">{breakdown.map(criterion => <div key={criterion.key}><dt>{criterion.label}</dt><dd>{criterion.value}<span>/100</span></dd></div>)}</dl>
          </article>;
        })}</div>
      </section>
    </section>
  );
}
