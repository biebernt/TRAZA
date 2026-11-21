import { useState, useEffect, useCallback } from "react";
import {
    getServerStatus,
    saveProject,
    updateProject,
    duplicateProject,
    deleteProject,
    getProjects
} from "../services/api";

import UrbanStats from "../components/UrbanStats";
import UrbanToolbar from "../components/UrbanToolbar";
import AreaBar from "../components/AreaBar";
import ScenarioComparison from "../components/ScenarioComparison";

import { useArea } from "../state/areaContext";
import { useAuth } from "../state/authContext";
import { getOwnerKey } from "../utils/ownerKey";
import { bboxCenter } from "../utils/geo";

import { CELL_TYPES } from "../utils/urbanAnalysis";
import "./UrbanStudio.css";

import UrbanMap from "../components/UrbanMap";

const initialMap = Array(100).fill("empty");

const types = CELL_TYPES;

export default function UrbanStudio({ handoff = null, onHandoffConsumed }) {
    // Estados principales
    const [map, setMap] = useState([...initialMap]);
    const [selectedTool, setSelectedTool] = useState("house");

    const [serverStatus, setServerStatus] = useState("Conectando...");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageError, setMessageError] = useState(false);
    const [projectName, setProjectName] = useState("");
    const [features, setFeatures] = useState([]);
    const [mapView, setMapView] = useState(null);
    const [projects, setProjects] = useState([]);
    const [projectsError, setProjectsError] = useState("");
    const [currentProjectId, setCurrentProjectId] = useState(null);
    const [baseline, setBaseline] = useState(null);

    const { area, setArea } = useArea();
    const { token } = useAuth();
    const [ownerKey] = useState(() => getOwnerKey());

    const handleViewChange = useCallback(view => {
        setMapView(view);
    }, []);

    function addMapFeature(feature) {
        if (selectedTool === "empty") {
            setMessageError(true);
            setMessage("Selecciona una herramienta para colocar elementos.");
            return;
        }

        setFeatures((previous) => [...previous, feature]);
        setMessageError(false);
        setMessage("");
    }

    function rejectMapFeature(reason) {
        setMessageError(true);
        setMessage(reason);
    }

    function removeMapFeature(id) {
        setFeatures((previous) =>
            previous.filter((feature) => feature.id !== id)
        );
    }

    function clearMapFeatures() {
        setFeatures([]);
    }

    // Comprobar conexión con el backend y traer los proyectos guardados
    useEffect(() => {
        getServerStatus()
            .then(status => {
                setServerStatus(status.database === "connected" ? "Servidor conectado" : "Base de datos desconectada");
            })
            .catch(() => {
                setServerStatus("Servidor desconectado");
            });
    }, []);

    const refreshProjects = useCallback(async () => {
        try {
            setProjects(await getProjects({ token, ownerKey }));
            setProjectsError("");
        } catch (error) {
            setProjects([]);
            setProjectsError(error.message);
        }
    }, [token, ownerKey]);

    useEffect(() => {
        let active = true;

        getProjects({ token, ownerKey })
            .then(list => {
                if (!active) return;
                setProjects(list);
                setProjectsError("");
            })
            .catch(error => {
                if (!active) return;
                setProjects([]);
                setProjectsError(error.message);
            });

        return () => {
            active = false;
        };
    }, [token, ownerKey]);

    // Editar una celda del mapa
    function editCell(index) {
        setMap(previous =>
            previous.map((cell, i) =>
                i === index ? selectedTool : cell
            )
        );
    }

    // Limpiar el mapa actual
    function clearMap() {
        const confirmed = window.confirm(
            "¿Quieres limpiar el mapa actual? Los cambios sin guardar se perderán."
        );

        if (!confirmed) return;

        setMessageError(false);
        setMap([...initialMap]);
        setFeatures([]);
        setMessage("Mapa y elementos reiniciados correctamente");
    }

    function readProjectFeatures(project) {
        return Array.isArray(project.features)
            ? project.features
                  .filter(
                      feature =>
                          feature &&
                          typeof feature.id === "string" &&
                          Object.hasOwn(types, feature.type) &&
                          Number.isFinite(feature.lat) &&
                          Number.isFinite(feature.lon)
                  )
                  .map(({ id, type, lat, lon }) => ({ id, type, lat, lon }))
            : [];
    }

    function projectPayload(name) {
        return {
            name,
            description: "Proyecto creado en URBI Urban Studio",
            mode: "grid",
            ...(token ? {} : { ownerKey }),
            map,
            features: features.map(({ id, type, lat, lon }) => ({
                id,
                type,
                lat,
                lon
            })),
            area: {
                kind: "viewport",
                name: area.name,
                center: bboxCenter(area.bbox),
                zoom: mapView?.zoom,
                bbox: area.bbox
            }
        };
    }

    function rememberBaseline(name, projectMap, projectFeatures) {
        setBaseline({
            name,
            map: [...projectMap],
            features: [...projectFeatures]
        });
    }

    // Guardar el proyecto: actualiza el abierto o crea uno nuevo.
    async function handleSave(event) {
        event.preventDefault();
        const name = projectName.trim();

        if (!name) {
            setMessageError(true);
            setMessage("Escribe un nombre para tu proyecto.");
            return;
        }

        setMessageError(false);
        setSaving(true);
        setMessage("");

        const updating = Boolean(currentProjectId);

        try {
            const saved = updating
                ? await updateProject(
                      currentProjectId,
                      projectPayload(name),
                      token
                  )
                : await saveProject(projectPayload(name), token);

            setCurrentProjectId(saved._id);
            setProjectName(saved.name);
            rememberBaseline(saved.name, map, features);
            setMessage(
                updating
                    ? "Proyecto actualizado correctamente"
                    : "Proyecto guardado correctamente"
            );
            refreshProjects();
        } catch (error) {
            setMessageError(true);
            setMessage(
                `Error al guardar: ${error.message}`
            );
        } finally {
            setSaving(false);
        }
    }

    // Aplica un proyecto guardado al editor, validando su cuadrícula.
    function applyProject(project, { confirm = true } = {}) {
        if (
            confirm &&
            (map.some(cell => cell !== "empty") || features.length > 0) &&
            !window.confirm("Abrir un proyecto reemplazará el mapa actual. ¿Quieres continuar?")
        ) {
            return;
        }

        setMessageError(false);
        setMessage("");

        try {
            if (
                !Array.isArray(project.map) ||
                project.map.length !== 100 ||
                !project.map.every(cell => Object.hasOwn(types, cell))
            ) {
                throw new Error(
                    "El proyecto guardado contiene un mapa inválido"
                );
            }

            const projectFeatures = readProjectFeatures(project);

            setMap([...project.map]);
            setProjectName(project.name);
            setCurrentProjectId(project._id);
            setFeatures(projectFeatures);
            rememberBaseline(project.name, project.map, projectFeatures);

            if (Array.isArray(project.area?.bbox)) {
                setArea({
                    bbox: project.area.bbox,
                    name: project.area.name || project.name
                });
            }

            setMessage(`Proyecto cargado correctamente: ${project.name}`);
        } catch (error) {
            setMessageError(true);
            setMessage(`Error al cargar: ${error.message}`);
        }
    }

    function handleLoadProject(project) {
        applyProject(project);
    }

    // Abre un proyecto enviado desde «Mis proyectos» o inicia uno en blanco.
    useEffect(() => {
        if (!handoff) return undefined;

        const timer = window.setTimeout(() => {
            if (handoff.type === "open" && handoff.project) {
                applyProject(handoff.project, { confirm: false });
            }

            if (handoff.type === "new") {
                setCurrentProjectId(null);
                setBaseline(null);
                setMap([...initialMap]);
                setFeatures([]);
                setProjectName("");
                setMessageError(false);
                setMessage("El próximo guardado creará un proyecto nuevo.");
            }

            onHandoffConsumed?.();
        }, 0);

        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [handoff]);

    async function handleDuplicate(project) {
        setMessageError(false);
        setLoading(true);
        setMessage("");

        try {
            const copy = await duplicateProject(project._id, token);
            setMessage(`Proyecto duplicado: ${copy.name}`);
            await refreshProjects();
        } catch (error) {
            setMessageError(true);
            setMessage(`Error al duplicar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    function handleNewProject() {
        setCurrentProjectId(null);
        setBaseline(null);
        setMessageError(false);
        setMessage("El próximo guardado creará un proyecto nuevo.");
    }

    async function handleDelete(project) {
        if (
            !window.confirm(
                `¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`
            )
        ) {
            return;
        }

        setMessageError(false);
        setLoading(true);
        setMessage("");

        try {
            await deleteProject(project._id, token);

            if (currentProjectId === project._id) {
                setCurrentProjectId(null);
                setBaseline(null);
            }

            setMessage(`Proyecto eliminado: ${project.name}`);
            await refreshProjects();
        } catch (error) {
            setMessageError(true);
            setMessage(`Error al eliminar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    // Estadísticas rápidas
    const occupied = map.filter(
        cell => cell !== "empty"
    ).length;

    const parks = map.filter(
        cell => cell === "park"
    ).length;

    const businesses = map.filter(
        cell => cell === "business"
    ).length;

    return (
        <div className="urban-studio">
            <div className="content">

                {/* Encabezado */}
                <header>
                    <span className="traza-kicker">DISEÑA Y EXPLORA</span>
                    <h1>URBI Urban Studio</h1>

                    <p>
                        Diseña, modifica y analiza escenarios urbanos
                        mediante nuestro editor interactivo.
                    </p>

                    <p className="urban-system-status" role="status">
                        <strong>Estado del sistema:</strong>{" "}
                        {serverStatus}
                    </p>
                </header>

                {/* Estadísticas principales */}
                <section className="stats">
                    <article>
                        <h3>{occupied}</h3>
                        <p>Espacios ocupados</p>
                    </article>

                    <article>
                        <h3>{parks}</h3>
                        <p>Áreas verdes</p>
                    </article>

                    <article>
                        <h3>{businesses}</h3>
                        <p>Negocios</p>
                    </article>
                </section>

                <AreaBar view={mapView} disabled={saving || loading} />

                <UrbanMap
                    area={area}
                    onViewChange={handleViewChange}
                    features={features}
                    selectedTool={selectedTool}
                    onAddFeature={addMapFeature}
                    onRemoveFeature={removeMapFeature}
                    onClearFeatures={clearMapFeatures}
                    onRejectPlacement={rejectMapFeature}
                />

                {/* Herramientas */}
                <UrbanToolbar
                    selectedTool={selectedTool}
                    onSelectTool={setSelectedTool}
                    onClear={clearMap}
                    disabled={saving || loading}
                />

                {/* Editor urbano */}
                <section className="editor" aria-labelledby="urban-editor-title">
                    <div className="urban-editor-heading"><h2 id="urban-editor-title">Tu escenario urbano</h2><p>Selecciona una herramienta y pulsa una celda para editarla. Cuadrícula de 10 × 10.</p></div>
                    <div className="map">
                        {map.map((cell, index) => (
                            <button
                                key={index}
                                type="button"
                                className={`cell ${cell}`}
                                onClick={() => editCell(index)}
                                disabled={saving || loading}
                                title={`Celda ${index + 1}: ${types[cell].label}`}
                                aria-label={`Celda ${index + 1}: ${types[cell].label}`}
                            >
                                {types[cell].icon}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Análisis urbano */}
            
                <UrbanStats map={map} />

                <ScenarioComparison
                    baseline={baseline}
                    map={map}
                    features={features}
                />

                {/* Gestión de proyectos */}
                <section className="project-actions">
                    <h2>Gestión de proyectos</h2>

                    <form className="urban-project-form" onSubmit={handleSave}>
                        <div className="traza-field"><label htmlFor="urban-project-name">Nombre del proyecto</label><input id="urban-project-name" value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={100} placeholder="Ej. Barrio Las Palmeras" disabled={saving || loading} required /></div>
                        <div className="project-buttons">
                            <button
                                type="submit"
                                className="traza-btn traza-btn-primary"
                                disabled={saving || loading}
                            >
                                {saving
                                    ? "Guardando..."
                                    : currentProjectId
                                      ? "Actualizar proyecto"
                                      : "Guardar proyecto"}
                            </button>

                            {currentProjectId && (
                                <button
                                    type="button"
                                    className="traza-btn traza-btn-secondary"
                                    onClick={handleNewProject}
                                    disabled={saving || loading}
                                >
                                    Guardar como nuevo
                                </button>
                            )}
                        </div>

                    </form>

                    {message && (
                        <p role={messageError ? "alert" : "status"} className={`traza-message ${messageError ? "traza-message-error" : "traza-message-success"}`}>
                            {message}
                        </p>
                    )}

                    <div className="project-list">
                        <div className="project-list-heading">
                            <h3>Proyectos guardados</h3>
                            <button
                                type="button"
                                className="traza-btn traza-btn-secondary"
                                onClick={refreshProjects}
                                disabled={loading || saving}
                            >
                                Actualizar lista
                            </button>
                        </div>

                        {projectsError && (
                            <p className="traza-message traza-message-error" role="alert">
                                {projectsError}
                            </p>
                        )}

                        {!projectsError && projects.length === 0 && (
                            <p className="traza-form-help">
                                Todavía no hay proyectos guardados.
                            </p>
                        )}

                        {projects.length > 0 && (
                            <ul className="project-list-items">
                                {projects.map(project => (
                                    <li
                                        key={project._id}
                                        className={
                                            project._id === currentProjectId
                                                ? "project-item is-current"
                                                : "project-item"
                                        }
                                    >
                                        <div className="project-item-info">
                                            <strong>{project.name}</strong>
                                            <span>
                                                {project.mode === "geo"
                                                    ? "Área geográfica"
                                                    : "Cuadrícula 10 × 10"}
                                                {" · "}
                                                {project.features?.length ?? 0}{" "}
                                                elementos{" · "}
                                                {new Date(project.updatedAt).toLocaleString("es-PA")}
                                            </span>
                                        </div>

                                        <div className="project-item-actions">
                                            <button
                                                type="button"
                                                className="traza-btn traza-btn-secondary"
                                                onClick={() => handleLoadProject(project)}
                                                disabled={loading || saving}
                                            >
                                                Abrir
                                            </button>
                                            <button
                                                type="button"
                                                className="traza-btn traza-btn-secondary"
                                                onClick={() => handleDuplicate(project)}
                                                disabled={loading || saving}
                                            >
                                                Duplicar
                                            </button>
                                            <button
                                                type="button"
                                                className="traza-btn traza-btn-secondary project-item-remove"
                                                onClick={() => handleDelete(project)}
                                                disabled={loading || saving}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

            </div>
        </div>
    );
}