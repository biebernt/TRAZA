import { CELL_TYPES } from "../utils/urbanAnalysis";

export default function UrbanToolbar({
  selectedTool,
  onSelectTool,
  onClear
}) {
  return (
    <section className="urban-toolbar">
      <h2>Herramientas de construcción</h2>

      <div className="urban-tools">
        {Object.entries(CELL_TYPES).map(([type, config]) => (
          <button
            key={type}
            type="button"
            className={
              selectedTool === type
                ? "urban-tool active"
                : "urban-tool"
            }
            aria-pressed={selectedTool === type}
            onClick={() => onSelectTool(type)}
          >
            <span
              className="urban-tool-color"
              style={{ background: config.color }}
            />
            {config.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="urban-clear-button"
        onClick={onClear}
      >
        Limpiar mapa
      </button>
    </section>
  );
}