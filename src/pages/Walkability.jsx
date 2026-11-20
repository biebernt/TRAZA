import { useEffect, useRef, useState } from "react";
import { getWalkingPlaces } from "../services/api";
import { useArea } from "../state/areaContext";
import { bboxAreaKm2, formatKm2 } from "../utils/geo";
import AreaBar from "../components/AreaBar";
import "./Walkability.css";

const categories = { education: "Educación", health: "Salud", food: "Alimentos", parks: "Parques" };
const dateLabel = value => new Date(value).toLocaleString("es-PA");

export default function Walkability() {
  const { area, areaKm2 } = useArea();
  const [loaded, setLoaded] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("all");
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  // Cada consulta recuerda el área con la que se hizo: al cambiar de área los
  // resultados anteriores dejan de mostrarse sin necesidad de efectos.
  const data = loaded && loaded.revision === area.revision ? loaded.result : null;
  const error = failure && failure.revision === area.revision ? failure.message : "";

  async function loadPlaces() {
    controller.current?.abort();
    const request = new AbortController();
    const revision = area.revision;
    controller.current = request;
    setLoading(true);
    setFailure(null);

    try {
      const result = await getWalkingPlaces(area.bbox, request.signal);
      setLoaded({ result, revision });
    } catch (err) {
      if (err.name !== "AbortError") setFailure({ message: err.message, revision });
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  const visible = data?.places.filter(place => category === "all" || category === place.category) || [];

  return (
    <div className="traza-page traza-container walking-page">
      <header className="traza-page-header"><span className="traza-kicker">ÁREA DE TRABAJO</span><h1>Un barrio más cerca de ti.</h1><p>Conoce los servicios registrados en el área que estás analizando.</p><span className="walking-pilot-label">Inventario de servicios · {area.name}</span></header>
      <AreaBar allowView={false} />
      <section className="traza-card walking-query" aria-labelledby="walking-query-title"><div><span className="traza-kicker">DATOS DEL TERRITORIO</span><h2 id="walking-query-title">¿Qué servicios están registrados en {area.name}?</h2><p>Consulta educación, salud, alimentos y parques dentro del área seleccionada ({formatKm2(areaKm2 ?? bboxAreaKm2(area.bbox))}). Describe lo mapeado en OpenStreetMap, no una delimitación oficial ni tiempos de caminata.</p></div><button className="traza-btn traza-btn-primary" type="button" disabled={loading} onClick={loadPlaces}>{loading ? "Consultando datos..." : data ? "Volver a consultar" : "Consultar servicios"}</button></section>
      <p className="traza-message walking-scope"><strong>Distancia geográfica, todavía sin tiempos de caminata.</strong> Esta consulta identifica lugares dentro del área; no confirma que estén a 5 o 10 minutos a pie ni que la cobertura de OpenStreetMap esté completa.</p>
      {loading && <p className="traza-message" role="status">Consultando OpenStreetMap. La respuesta puede tardar hasta 25 segundos.</p>}
      {error && <p className="traza-message traza-message-error" role="alert">{error}{data ? " Se mantienen los resultados de la consulta anterior." : " No se obtuvo un inventario; esto no significa que no existan servicios."}</p>}
      {data && <>
        <div className="walking-source"><p>Fuente: {data.source} · Consulta: {dateLabel(data.fetchedAt)}{data.osmTimestamp && ` · Base OSM: ${dateLabel(data.osmTimestamp)}`}</p><p>{data.cache.stale ? "Datos anteriores: no se pudieron actualizar. Reintenta más tarde." : "La consulta se conserva en caché durante 30 minutos para reducir solicitudes al proveedor."}</p></div>
        {data.cache.stale && <p role="status" className="traza-message">Mostrando la última consulta disponible, sin actualización confirmada.</p>}
        <section className="walking-counts" aria-label="Servicios registrados por categoría">{Object.entries(categories).map(([key, label]) => <div className="traza-card" key={key}><span>{label}</span><strong>{data.places.filter(place => place.category === key).length}</strong></div>)}</section>
        <div className="walking-results-heading"><h2>Servicios registrados ({visible.length})</h2><div className="traza-field"><label htmlFor="walking-category">Filtrar por categoría</label><select id="walking-category" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas las categorías</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div></div>
        {visible.length === 0 ? <div className="traza-card traza-empty"><h3>Sin resultados registrados en esta consulta</h3><p>Los datos pueden estar incompletos. Prueba otra categoría; un resultado vacío no demuestra ausencia de servicios.</p></div> : <div className="walking-results">{visible.map(place => <article className="traza-card walking-place" key={place.id}><span className="traza-kicker">{categories[place.category]}</span><h3>{place.name}</h3><p>{place.locationType === "geometry-center" ? "Ubicación aproximada: centro de la geometría, no una entrada peatonal verificada." : "Punto registrado en OpenStreetMap; acceso peatonal no verificado."}</p><a href={place.osmUrl} target="_blank" rel="noreferrer">Ver lugar en OpenStreetMap <span className="traza-sr-only">(abre otra pestaña)</span></a></article>)}</div>}
        <p className="traza-form-help">{data.attribution} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Licencia y atribución de OpenStreetMap</a>. Los registros pueden incluir zonas privadas o establecimientos que hayan cambiado.</p>
      </>}
    </div>
  );
}
