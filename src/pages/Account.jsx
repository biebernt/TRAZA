import { useEffect, useState } from "react";

import { useAuth } from "../state/authContext";
import { deleteProject, getProjects } from "../services/api";
import "./Account.css";

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString("es-PA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export default function Account({ navigate }) {
  const { user, token, ready, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;

    getProjects({ token })
      .then(data => {
        if (!active) return;
        setProjects(data);
        setError("");
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, reloadKey]);

  function refreshProjects() {
    setLoading(true);
    setReloadKey(key => key + 1);
  }

  async function handleDelete(project) {
    if (
      !window.confirm(
        `¿Eliminar el proyecto "${project.name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setBusyId(project._id);
    setError("");
    setNotice("");

    try {
      await deleteProject(project._id, token);
      setNotice(`Proyecto eliminado: ${project.name}`);
      setReloadKey(key => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function handleLogout() {
    await logout();
    navigate("home");
  }

  if (!ready) {
    return (
      <div className="traza-page traza-container account-page">
        <p role="status" className="traza-message">
          Cargando tu sesión...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="traza-page traza-container account-page">
        <header className="traza-page-header">
          <span className="traza-kicker">ESPACIO PERSONAL</span>
          <h1>Inicia sesión para ver tus proyectos</h1>
          <p>
            Tus proyectos se guardan en tu cuenta. Entra con tu correo para
            retomarlos donde los dejaste.
          </p>
          <button
            type="button"
            className="traza-btn traza-btn-primary"
            onClick={() => navigate("login")}
          >
            Iniciar sesión
          </button>
        </header>
      </div>
    );
  }

  return (
    <div className="traza-page traza-container account-page">
      <header className="traza-page-header account-header">
        <div>
          <span className="traza-kicker">MIS PROYECTOS</span>
          <h1>{user ? user.name : "Tu cuenta URBI"}</h1>
          <p>
            {user?.email} · Cuenta creada el {formatDate(user?.createdAt)}
          </p>
        </div>
        <div className="account-header-actions">
          <button
            type="button"
            className="traza-btn traza-btn-secondary"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="account-summary" aria-label="Resumen de la cuenta">
        <div className="traza-card">
          <span>Proyectos guardados</span>
          <strong>{loading ? "—" : projects.length}</strong>
        </div>
        <div className="traza-card">
          <span>Cuenta</span>
          <strong className="account-summary-text">
            {user?.status === "active" ? "Activa" : "Suspendida"}
          </strong>
        </div>
        <div className="traza-card">
          <span>Último acceso</span>
          <strong className="account-summary-text">
            {formatDate(user?.lastLoginAt)}
          </strong>
        </div>
      </section>

      <div className="account-actions">
        <h2>Mis proyectos</h2>
        <div className="account-actions-buttons">
          <button
            type="button"
            className="traza-btn traza-btn-secondary"
            onClick={refreshProjects}
            disabled={loading}
          >
            Actualizar lista
          </button>
          <button
            type="button"
            className="traza-btn traza-btn-primary"
            onClick={() => navigate("urban", { type: "new" })}
          >
            Crear nuevo proyecto
          </button>
        </div>
      </div>

      <p className="traza-form-help">
        Abre un proyecto para seguir editándolo en Urban Studio. Los cambios que
        guardes quedan en tu cuenta.
      </p>

      {loading && (
        <p role="status" className="traza-message">
          Cargando tus proyectos...
        </p>
      )}

      {error && (
        <p role="alert" className="traza-message traza-message-error">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="traza-message traza-message-success">
          {notice}
        </p>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="traza-card traza-empty">
          <h3>Todavía no has creado proyectos</h3>
          <p>
            Entra a Urban Studio, diseña tu escenario y guárdalo: aparecerá aquí
            asociado a tu cuenta.
          </p>
          <button
            type="button"
            className="traza-btn traza-btn-primary"
            onClick={() => navigate("urban", { type: "new" })}
          >
            Ir a Urban Studio
          </button>
        </div>
      )}

      {projects.length > 0 && (
        <ul className="account-projects">
          {projects.map(project => (
            <li className="traza-card account-project" key={project._id}>
              <div className="account-project-heading">
                <h3>{project.name}</h3>
                <span className="account-badge">
                  {project.mode === "geo" ? "Área geográfica" : "Cuadrícula 10 × 10"}
                </span>
              </div>

              <dl className="account-project-meta">
                <div>
                  <dt>Área</dt>
                  <dd>{project.area?.name || "Sin área registrada"}</dd>
                </div>
                <div>
                  <dt>Elementos</dt>
                  <dd>{project.features?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Creado</dt>
                  <dd>{formatDate(project.createdAt)}</dd>
                </div>
                <div>
                  <dt>Última modificación</dt>
                  <dd>{formatDate(project.updatedAt)}</dd>
                </div>
              </dl>

              {project.description && (
                <p className="account-project-description">
                  {project.description}
                </p>
              )}

              <div className="account-project-actions">
                <button
                  type="button"
                  className="traza-btn traza-btn-primary"
                  onClick={() =>
                    navigate("urban", { type: "open", project })
                  }
                >
                  Abrir en Urban Studio
                </button>
                <button
                  type="button"
                  className="traza-btn traza-btn-secondary account-project-remove"
                  onClick={() => handleDelete(project)}
                  disabled={busyId === project._id}
                >
                  {busyId === project._id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
