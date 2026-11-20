import { useArea } from "../state/areaContext";
import {
  MAX_AREA_KM2,
  PILOT_AREA,
  bboxAreaKm2,
  bboxFromView,
  formatBbox,
  formatKm2,
} from "../utils/geo";
import "./AreaBar.css";

export default function AreaBar({ view = null, disabled = false }) {
  const { area, areaKm2, error, setArea, resetArea } = useArea();

  const viewBbox = view ? bboxFromView(view) : null;
  const viewKm2 = viewBbox ? bboxAreaKm2(viewBbox) : 0;
  const canUseView = Boolean(viewBbox);
  const viewTooLarge = canUseView && viewKm2 > MAX_AREA_KM2;
  const isPilot = area.name === PILOT_AREA.name;

  function useCurrentView() {
    if (!viewBbox) return;

    setArea({ bbox: viewBbox, name: "Vista del mapa" });
  }

  return (
    <section className="area-bar" aria-labelledby="area-bar-title">
      <div className="area-bar-summary">
        <span className="traza-kicker">ÁREA DE TRABAJO</span>
        <h2 id="area-bar-title">{area.name}</h2>

        <p className="area-bar-meta" role="status">
          <strong>{formatKm2(areaKm2)}</strong>
          <span aria-hidden="true"> · </span>
          {formatBbox(area.bbox)}
        </p>

        <p className="area-bar-note">
          Límite del prototipo: {MAX_AREA_KM2} km². El área se guarda
          en este navegador y se adjunta al proyecto cuando lo guardas.
        </p>
      </div>

      <div className="area-bar-actions">
        <button
          type="button"
          className="traza-btn traza-btn-primary"
          onClick={useCurrentView}
          disabled={disabled || !canUseView || viewTooLarge}
        >
          Usar la vista actual
        </button>

        <button
          type="button"
          className="traza-btn traza-btn-secondary"
          onClick={resetArea}
          disabled={disabled || isPilot}
        >
          Volver al área piloto
        </button>

        {!canUseView && (
          <p className="area-bar-hint">
            Mueve el mapa para definir un área desde la vista.
          </p>
        )}

        {viewTooLarge && (
          <p className="area-bar-hint">
            La vista ocupa {formatKm2(viewKm2)}; el máximo es{" "}
            {MAX_AREA_KM2} km². Acerca el mapa para definir el área.
          </p>
        )}
      </div>

      {error && (
        <p className="traza-message traza-message-error area-bar-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
