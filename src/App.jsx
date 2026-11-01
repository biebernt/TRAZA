import { useState } from "react";
import "./App.css";
import { useEffect } from "react";
import { getServerStatus } from "./services/api";
import { saveProject, getProjects } from "./services/api";
import LocationAnalyzer from "./components/LocationAnalyzer";


const initialMap = Array.from({ length: 100 }, () => "empty");

const types = {
  empty: { icon: "", label: "Vacío" },
  road: { icon: "🛣️", label: "Calle" },
  house: { icon: "🏠", label: "Vivienda" },
  business: { icon: "🏪", label: "Negocio" },
  park: { icon: "🌳", label: "Parque" },
  school: { icon: "🏫", label: "Escuela" }
};

export default function App() {
  const [map, setMap] = useState(initialMap);
  const [selected, setSelected] = useState("house");
  const [serverStatus, setServerStatus] = useState("Conectando...");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    const name = window.prompt("Nombre del proyecto urbano:");

    if (!name?.trim()) return;

    setSaving(true);
    setMessage("");

    try {
      await saveProject({
        name: name.trim(),
        description: "Proyecto creado en TRAZA Urban Studio",
        map
      });

      setMessage("Proyecto guardado correctamente");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLoad() {
    try {
      const projects = await getProjects();

      if (projects.length === 0) {
        setMessage("Todavía no hay proyectos guardados");
        return;
      }

      // Por ahora cargamos el proyecto más reciente.
      setMap(projects[0].map);
      setMessage(`Proyecto cargado: ${projects[0].name}`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    getServerStatus()
      .then(() => setServerStatus("Servidor conectado"))
      .catch(() => setServerStatus("Servidor desconectado"));
  }, []);


  function editCell(index) {
    setMap(previous =>
      previous.map((cell, i) => i === index ? selected : cell)
    );
  }

  const occupied = map.filter(cell => cell !== "empty").length;
  const parks = map.filter(cell => cell === "park").length;
  const businesses = map.filter(cell => cell === "business").length;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>TRAZA</h1>
        <p>Urban Planning Platform</p>
        <h3>Herramientas</h3>

        {Object.entries(types).map(([key, value]) => (
          <button
            key={key}
            className={selected === key ? "active" : ""}
            onClick={() => setSelected(key)}
          >
            {value.icon} {value.label}
          </button>
        ))}
      </aside>

      <main className="content">
        <header>
          <h2>Editor de planificación urbana</h2>
          <p>Selecciona una herramienta y modifica la ciudad.</p>
          <p>Estado del sistema: {serverStatus}</p>
        </header>

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

        <section className="editor">
          <div className="map">
            {map.map((cell, index) => (
              <button
                key={index}
                className={`cell ${cell}`}
                onClick={() => editCell(index)}
                title={`Celda ${index + 1}: ${types[cell].label}`}
              >
                {types[cell].icon}
              </button>
            ))}
          </div>
        </section>

        <button
          className="reset"
          onClick={() => setMap([...initialMap])}
        >
          Reiniciar ciudad
        </button>

        <button className="reset" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar proyecto"}
        </button>

        <button className="reset" onClick={handleLoad}>
          Cargar último proyecto
        </button>

        <p role="status">{message}</p>

        <LocationAnalyzer />
      </main>
    </div>
  );
}
