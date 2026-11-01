
import { useState } from "react";
import "./App.css";
import { useEffect } from "react";
import { getServerStatus } from "./services/api";


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
      </main>
    </div>
  );
}
