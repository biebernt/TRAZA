import { analyzeUrbanMap } from "../utils/urbanAnalysis";

const percent = value => `${value}%`;

function buildRows(before, after) {
  return [
    {
      label: "Ocupación del terreno",
      before: percent(before.occupationPercentage),
      after: percent(after.occupationPercentage),
      delta: after.occupationPercentage - before.occupationPercentage
    },
    {
      label: "Áreas verdes",
      before: percent(before.greenPercentage),
      after: percent(after.greenPercentage),
      delta: after.greenPercentage - before.greenPercentage
    },
    {
      label: "Viviendas",
      before: before.counts.house,
      after: after.counts.house,
      delta: after.counts.house - before.counts.house
    },
    {
      label: "Comercios",
      before: before.counts.business,
      after: after.counts.business,
      delta: after.counts.business - before.counts.business
    },
    {
      label: "Escuelas",
      before: before.counts.school,
      after: after.counts.school,
      delta: after.counts.school - before.counts.school
    },
    {
      label: "Carreteras",
      before: before.counts.road,
      after: after.counts.road,
      delta: after.counts.road - before.counts.road
    }
  ];
}

// Compara el escenario guardado (antes) con el que está en pantalla (después).
export default function ScenarioComparison({ baseline, map, features = [] }) {
  if (!baseline) {
    return (
      <section className="scenario-compare" aria-labelledby="scenario-compare-title">
        <h2 id="scenario-compare-title">Antes y después</h2>
        <p className="traza-form-help">
          Abre un proyecto guardado o guarda el actual para fijar una
          referencia y comparar los cambios de la cuadrícula.
        </p>
      </section>
    );
  }

  const before = analyzeUrbanMap(baseline.map);
  const after = analyzeUrbanMap(map);
  const rows = buildRows(before, after);
  const baselineFeatures = baseline.features?.length ?? 0;

  return (
    <section className="scenario-compare" aria-labelledby="scenario-compare-title">
      <div className="scenario-compare-heading">
        <div>
          <h2 id="scenario-compare-title">Antes y después</h2>
          <p>
            Referencia: <strong>{baseline.name || "proyecto guardado"}</strong>.
            La columna «después» refleja el escenario que tienes en pantalla.
          </p>
        </div>
        <span className="scenario-compare-count">
          {baselineFeatures} → {features.length} elementos en el mapa
        </span>
      </div>

      <table className="scenario-compare-table">
        <caption className="traza-sr-only">
          Indicadores del escenario guardado y del actual
        </caption>
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col">Antes</th>
            <th scope="col">Después</th>
            <th scope="col">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.before}</td>
              <td>{row.after}</td>
              <td
                className={
                  row.delta === 0
                    ? "scenario-delta is-even"
                    : row.delta > 0
                      ? "scenario-delta is-up"
                      : "scenario-delta is-down"
                }
              >
                {row.delta > 0 ? `+${row.delta}` : row.delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
