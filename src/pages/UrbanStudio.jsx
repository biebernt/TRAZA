import { useState, useEffect } from "react";
import {
    getServerStatus,
    saveProject,
    getProjects
} from "../services/api";

import UrbanStats from "../components/UrbanStats";
import UrbanToolbar from "../components/UrbanToolbar";

import { CELL_TYPES } from "../utils/urbanAnalysis";
import "./UrbanStudio.css";

const initialMap = Array(100).fill("empty");

const types = CELL_TYPES;

export default function UrbanStudio() {
    // Estados principales
    const [map, setMap] = useState([...initialMap]);
    const [selectedTool, setSelectedTool] = useState("house");

    const [serverStatus, setServerStatus] = useState("Conectando...");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageError, setMessageError] = useState(false);
    const [projectName, setProjectName] = useState("");

    // Comprobar conexión con el backend
    useEffect(() => {
        getServerStatus()
            .then(status => {
                setServerStatus(status.database === "connected" ? "Servidor conectado" : "Base de datos desconectada");
            })
            .catch(() => {
                setServerStatus("Servidor desconectado");
            });
    }, []);

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
        setMessage("Mapa reiniciado correctamente");
    }

    // Guardar proyecto en MongoDB
    async function handleSave(event) {
        event.preventDefault();
        const name = projectName;

        if (!name.trim()) {
            setMessageError(true);
            setMessage("Escribe un nombre para tu proyecto; no puede contener solo espacios.");
            return;
        }

        setMessageError(false);
        setSaving(true);
        setMessage("");

        try {
            await saveProject({
                name: name.trim(),
                description: "Proyecto creado en TRAZA Urban Studio",
                map
            });

            setMessage("Proyecto guardado correctamente en MongoDB");
        } catch (error) {
            setMessageError(true);
            setMessage(
                `Error al guardar: ${error.message}`
            );
        } finally {
            setSaving(false);
        }
    }

    // Cargar el último proyecto guardado
    async function handleLoad() {
        if (map.some(cell => cell !== "empty") && !window.confirm("Cargar el último proyecto reemplazará el mapa actual. ¿Quieres continuar?")) return;
        setMessageError(false);
        setLoading(true);
        setMessage("");

        try {
            const projects = await getProjects();

            if (!projects.length) {
                setMessage("Todavía no hay proyectos guardados");
                return;
            }

            const latestProject = projects[0];

            if (
                !Array.isArray(latestProject.map) ||
                latestProject.map.length !== 100 ||
                !latestProject.map.every(cell =>
                    Object.hasOwn(types, cell)
                )
            ) {
                throw new Error(
                    "El proyecto guardado contiene un mapa inválido"
                );
            }

            setMap([...latestProject.map]);
            setProjectName(latestProject.name);

            setMessage(
                `Proyecto cargado correctamente: ${latestProject.name}`
            );
        } catch (error) {
            setMessageError(true);
            setMessage(
                `Error al cargar: ${error.message}`
            );
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
                    <h1>TRAZA Urban Studio</h1>

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
                <p className="traza-form-help urban-disclaimer">Indicadores demostrativos basados en reglas de ejemplo, sin validación normativa. No sustituyen una evaluación urbanística profesional.</p>

                {/* Gestión de proyectos */}
                <section className="project-actions">
                    <h2>Gestión de proyectos</h2>

                    <p>
                        Guarda tu diseño urbano o recupera
                        el proyecto más reciente.
                    </p>

                    <form className="urban-project-form" onSubmit={handleSave}>
                        <div className="traza-field"><label htmlFor="urban-project-name">Nombre del proyecto</label><input id="urban-project-name" value={projectName} onChange={event => setProjectName(event.target.value)} maxLength={100} placeholder="Ej. Barrio Las Palmeras" disabled={saving || loading} required /></div>
                    <div className="project-buttons">
                        <button
                            type="submit"
                            className="traza-btn traza-btn-primary"
                            disabled={saving || loading}
                        >
                            {saving ? "Guardando..." : "Guardar proyecto"}
                        </button>

                        <button
                            type="button"
                            className="traza-btn traza-btn-secondary"
                            onClick={handleLoad}
                            disabled={loading || saving}
                        >
                            {loading
                                ? "Cargando..."
                                : "Cargar último proyecto"}
                        </button>
                    </div>

                    </form>
                    <p className="traza-form-help">Los proyectos se guardan en el servidor compartido de este prototipo. Salir de esta sección descarta los cambios sin guardar.</p>
                    {message && (
                        <p role={messageError ? "alert" : "status"} className={`traza-message ${messageError ? "traza-message-error" : "traza-message-success"}`}>
                            {message}
                        </p>
                    )}
                </section>

            </div>
        </div>
    );
}