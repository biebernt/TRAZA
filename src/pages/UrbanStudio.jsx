import { useState, useEffect } from "react";
import {
    getServerStatus,
    saveProject,
    getProjects
} from "../services/api";

import UrbanStats from "../components/UrbanStats";
import UrbanToolbar from "../components/UrbanToolbar";

import "../App.css";

const initialMap = Array(100).fill("empty");

const types = {
    empty: { icon: "", label: "Vacío" },
    road: { icon: "🛣️", label: "Calle" },
    house: { icon: "🏠", label: "Vivienda" },
    business: { icon: "🏪", label: "Negocio" },
    park: { icon: "🌳", label: "Parque" },
    school: { icon: "🏫", label: "Escuela" }
};

export default function UrbanStudio() {
    // Estados principales
    const [map, setMap] = useState([...initialMap]);
    const [selectedTool, setSelectedTool] = useState("house");

    const [serverStatus, setServerStatus] = useState("Conectando...");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Comprobar conexión con el backend
    useEffect(() => {
        getServerStatus()
            .then(() => {
                setServerStatus("Servidor conectado");
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

        setMap([...initialMap]);
        setMessage("Mapa reiniciado correctamente");
    }

    // Guardar proyecto en MongoDB
    async function handleSave() {
        const name = window.prompt(
            "Introduce el nombre de tu proyecto urbano:"
        );

        if (!name || !name.trim()) return;

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
            setMessage(
                `Error al guardar: ${error.message}`
            );
        } finally {
            setSaving(false);
        }
    }

    // Cargar el último proyecto guardado
    async function handleLoad() {
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

            setMessage(
                `Proyecto cargado correctamente: ${latestProject.name}`
            );
        } catch (error) {
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
            <main className="content">

                {/* Encabezado */}
                <header>
                    <h2>TRAZA Urban Studio</h2>

                    <p>
                        Diseña, modifica y analiza escenarios urbanos
                        mediante nuestro editor interactivo.
                    </p>

                    <p>
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
                />

                {/* Editor urbano */}
                <section className="editor">
                    <div className="map">
                        {map.map((cell, index) => (
                            <button
                                key={index}
                                type="button"
                                className={`cell ${cell}`}
                                onClick={() => editCell(index)}
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

                {/* Gestión de proyectos */}
                <section className="project-actions">
                    <h2>Gestión de proyectos</h2>

                    <p>
                        Guarda tu diseño urbano o recupera
                        el proyecto más reciente.
                    </p>

                    <div className="project-buttons">
                        <button
                            type="button"
                            className="reset"
                            onClick={handleSave}
                            disabled={saving || loading}
                        >
                            {saving ? "Guardando..." : "Guardar proyecto"}
                        </button>

                        <button
                            type="button"
                            className="reset"
                            onClick={handleLoad}
                            disabled={loading || saving}
                        >
                            {loading
                                ? "Cargando..."
                                : "Cargar último proyecto"}
                        </button>
                    </div>

                    {message && (
                        <p role="status" className="project-message">
                            {message}
                        </p>
                    )}
                </section>

            </main>
        </div>
    );
}