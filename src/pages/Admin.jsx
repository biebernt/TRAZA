import { useEffect, useState } from "react";

import {
  loginAdmin,
  logoutAdmin,
  getContacts,
  updateContactStatus,
  getAdminStats,
  getAdminUsers,
  getAdminUser,
  setAdminUserStatus,
  deleteAdminUser,
  createAdminUserReset,
  getAdminProjects,
  getAdminProject
} from "../services/api";
import "./Admin.css";

const TABS = [
  { id: "dashboard", label: "Dashboard", symbol: "◫" },
  { id: "users", label: "Usuarios", symbol: "◉" },
  { id: "projects", label: "Proyectos", symbol: "▦" },
  { id: "contacts", label: "Solicitudes", symbol: "✉" }
];

const CONTACT_STATUSES = {
  pending: "Pendiente",
  reviewed: "Revisada",
  resolved: "Resuelta"
};

const USER_STATUSES = { active: "Activa", suspended: "Suspendida" };

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString("es-PA", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function Dashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getAdminStats(token)
      .then(data => {
        if (active) setStats(data);
      })
      .catch(err => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (error) {
    return (
      <p role="alert" className="traza-message traza-message-error">
        {error}
      </p>
    );
  }

  if (!stats) {
    return (
      <p role="status" className="traza-message">
        Cargando indicadores...
      </p>
    );
  }

  const cards = [
    { label: "Usuarios registrados", value: stats.users.total },
    { label: "Usuarios activos", value: stats.users.active },
    { label: "Cuentas suspendidas", value: stats.users.suspended },
    { label: "Proyectos creados", value: stats.projects.total },
    { label: "Proyectos (últimos 7 días)", value: stats.projects.newLast7Days },
    { label: "Registros (últimos 7 días)", value: stats.users.newLast7Days },
    { label: "Solicitudes de contacto", value: stats.contacts.total },
    { label: "Solicitudes pendientes", value: stats.contacts.pending }
  ];

  return (
    <>
      <div className="admin-section-heading">
        <h2>Resumen general</h2>
        <p className="traza-form-help">
          Datos calculados en tiempo real desde la base de datos ·{" "}
          {formatDate(stats.generatedAt)}
        </p>
      </div>

      <div className="admin-stats">
        {cards.map(card => (
          <div className="traza-card admin-stat" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function UsersSection({ token }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState(false);
  const [keepProjects, setKeepProjects] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [detailKey, setDetailKey] = useState(0);

  useEffect(() => {
    let active = true;

    getAdminUsers(token, { search: query, status })
      .then(data => {
        if (!active) return;
        setUsers(data);
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
  }, [token, query, status, reloadKey]);

  function selectUser(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setResetLink("");
  }

  useEffect(() => {
    let active = true;

    if (!selectedId) return undefined;

    getAdminUser(token, selectedId)
      .then(data => {
        if (active) setDetail(data);
      })
      .catch(err => {
        if (active) setDetailError(err.message);
      });

    return () => {
      active = false;
    };
  }, [token, selectedId, detailKey]);

  async function changeStatus(user, nextStatus) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await setAdminUserStatus(token, user.id, nextStatus);
      setNotice(
        nextStatus === "suspended"
          ? `Cuenta de ${user.name} suspendida.`
          : `Cuenta de ${user.name} reactivada.`
      );
      setReloadKey(key => key + 1);
      setDetailKey(key => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(user) {
    const message = keepProjects
      ? `¿Eliminar la cuenta de ${user.name}? Sus ${user.projectCount} proyectos se conservarán sin propietario.`
      : `¿Eliminar la cuenta de ${user.name} y sus ${user.projectCount} proyectos? Esta acción no se puede deshacer.`;

    if (!window.confirm(message)) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await deleteAdminUser(token, user.id, keepProjects);
      setNotice(`Cuenta de ${user.name} eliminada.`);
      selectUser("");
      setReloadKey(key => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generateReset(user) {
    setBusy(true);
    setError("");
    setNotice("");
    setResetLink("");

    try {
      const result = await createAdminUserReset(token, user.id);
      const url = `${window.location.origin}${window.location.pathname}?reset=${result.token}`;

      setResetLink(url);
      setNotice(
        "Enlace generado. Cópialo y entrégalo al usuario: caduca en una hora y solo sirve una vez."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const selected = users.find(user => user.id === selectedId) || detail?.user;

  return (
    <>
      <div className="admin-section-heading">
        <h2>Gestión de usuarios</h2>
        <p className="traza-form-help">
          Consulta perfiles, revisa sus proyectos y administra el estado de cada
          cuenta.
        </p>
      </div>

      <form
        className="admin-filters"
        onSubmit={event => {
          event.preventDefault();
          setQuery(search.trim());
        }}
      >
        <div className="traza-field">
          <label htmlFor="admin-user-search">Buscar por nombre o correo</label>
          <input
            id="admin-user-search"
            type="search"
            value={search}
            maxLength={120}
            onChange={event => setSearch(event.target.value)}
            placeholder="Ej. Ana o ana@correo.com"
          />
        </div>
        <div className="traza-field">
          <label htmlFor="admin-user-status">Estado</label>
          <select
            id="admin-user-status"
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            <option value="">Todas las cuentas</option>
            {Object.entries(USER_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="traza-btn traza-btn-primary" type="submit" disabled={loading}>
          Buscar
        </button>
      </form>

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
      {resetLink && (
        <div className="traza-card admin-reset-link">
          <p className="traza-form-help">
            Enlace de restablecimiento (un solo uso):
          </p>
          <input readOnly value={resetLink} onFocus={event => event.target.select()} />
        </div>
      )}
      {loading && (
        <p role="status" className="traza-message">
          Cargando usuarios...
        </p>
      )}

      <div className="admin-users-layout">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="traza-sr-only">
              Usuarios registrados en URBI
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Registro</th>
                <th scope="col">Proyectos</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr
                  key={user.id}
                  className={user.id === selectedId ? "is-selected" : ""}
                  onClick={() => selectUser(user.id)}
                >
                  <td>
                    <button
                      type="button"
                      className="admin-row-link"
                      onClick={() => selectUser(user.id)}
                    >
                      {user.name}
                    </button>
                  </td>
                  <td>{user.email}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{user.projectCount}</td>
                  <td>
                    <span className={`admin-badge admin-badge-${user.status}`}>
                      {USER_STATUSES[user.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && users.length === 0 && (
            <p className="traza-form-help">
              No hay usuarios que coincidan con la búsqueda.
            </p>
          )}
        </div>

        <aside className="traza-card admin-detail" aria-live="polite">
          {!selectedId && (
            <p className="traza-form-help">
              Selecciona un usuario para ver su perfil y sus proyectos.
            </p>
          )}

          {detailError && (
            <p role="alert" className="traza-message traza-message-error">
              {detailError}
            </p>
          )}

          {selectedId && !detail && !detailError && (
            <p role="status" className="traza-form-help">
              Cargando perfil...
            </p>
          )}

          {selected && detail && (
            <>
              <h3>{detail.user.name}</h3>
              <p className="admin-detail-email">{detail.user.email}</p>
              <dl className="admin-detail-list">
                <div>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`admin-badge admin-badge-${detail.user.status}`}>
                      {USER_STATUSES[detail.user.status]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Registro</dt>
                  <dd>{formatDate(detail.user.createdAt)}</dd>
                </div>
                <div>
                  <dt>Último acceso</dt>
                  <dd>{formatDate(detail.user.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt>Proyectos</dt>
                  <dd>{detail.user.projectCount}</dd>
                </div>
              </dl>

              <h4>Proyectos de la cuenta</h4>
              {detail.projects.length === 0 && (
                <p className="traza-form-help">Esta cuenta no tiene proyectos.</p>
              )}
              <ul className="admin-mini-list">
                {detail.projects.map(project => (
                  <li key={project.id}>
                    <strong>{project.name}</strong>
                    <span>
                      {project.featureCount} elementos · actualizado{" "}
                      {formatDate(project.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="admin-detail-actions">
                {detail.user.status === "active" ? (
                  <button
                    type="button"
                    className="traza-btn traza-btn-secondary"
                    disabled={busy}
                    onClick={() => changeStatus(detail.user, "suspended")}
                  >
                    Suspender cuenta
                  </button>
                ) : (
                  <button
                    type="button"
                    className="traza-btn traza-btn-secondary"
                    disabled={busy}
                    onClick={() => changeStatus(detail.user, "active")}
                  >
                    Reactivar cuenta
                  </button>
                )}

                <button
                  type="button"
                  className="traza-btn traza-btn-secondary"
                  disabled={busy}
                  onClick={() => generateReset(detail.user)}
                >
                  Generar enlace de contraseña
                </button>

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={keepProjects}
                    onChange={event => setKeepProjects(event.target.checked)}
                  />
                  Conservar proyectos al eliminar
                </label>

                <button
                  type="button"
                  className="traza-btn traza-btn-secondary admin-danger"
                  disabled={busy}
                  onClick={() => removeUser({ ...detail.user, projectCount: detail.user.projectCount })}
                >
                  Eliminar cuenta
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function ProjectsSection({ token }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let active = true;

    getAdminUsers(token)
      .then(data => {
        if (active) setUsers(data);
      })
      .catch(() => {
        if (active) setUsers([]);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    getAdminProjects(token, { search: query, userId })
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
  }, [token, query, userId]);

  function selectProject(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
  }

  useEffect(() => {
    let active = true;

    if (!selectedId) return undefined;

    getAdminProject(token, selectedId)
      .then(data => {
        if (active) setDetail(data);
      })
      .catch(err => {
        if (active) setDetailError(err.message);
      });

    return () => {
      active = false;
    };
  }, [token, selectedId]);

  const project = detail?.project;

  return (
    <>
      <div className="admin-section-heading">
        <h2>Proyectos de la plataforma</h2>
        <p className="traza-form-help">
          Supervisa los proyectos de todas las cuentas y consulta su
          configuración guardada.
        </p>
      </div>

      <form
        className="admin-filters"
        onSubmit={event => {
          event.preventDefault();
          setQuery(search.trim());
        }}
      >
        <div className="traza-field">
          <label htmlFor="admin-project-search">Buscar por nombre</label>
          <input
            id="admin-project-search"
            type="search"
            value={search}
            maxLength={120}
            onChange={event => setSearch(event.target.value)}
            placeholder="Ej. Parque central"
          />
        </div>
        <div className="traza-field">
          <label htmlFor="admin-project-owner">Filtrar por usuario</label>
          <select
            id="admin-project-owner"
            value={userId}
            onChange={event => setUserId(event.target.value)}
          >
            <option value="">Todos los propietarios</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} · {user.email}
              </option>
            ))}
          </select>
        </div>
        <button className="traza-btn traza-btn-primary" type="submit" disabled={loading}>
          Buscar
        </button>
      </form>

      {error && (
        <p role="alert" className="traza-message traza-message-error">
          {error}
        </p>
      )}
      {loading && (
        <p role="status" className="traza-message">
          Cargando proyectos...
        </p>
      )}

      <div className="admin-users-layout">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="traza-sr-only">
              Proyectos guardados en URBI
            </caption>
            <thead>
              <tr>
                <th scope="col">Proyecto</th>
                <th scope="col">Propietario</th>
                <th scope="col">Creado</th>
                <th scope="col">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(item => (
                <tr
                  key={item.id}
                  className={item.id === selectedId ? "is-selected" : ""}
                  onClick={() => selectProject(item.id)}
                >
                  <td>
                    <button
                      type="button"
                      className="admin-row-link"
                      onClick={() => selectProject(item.id)}
                    >
                      {item.name}
                    </button>
                  </td>
                  <td>
                    {item.owner ? (
                      <>
                        <strong>{item.owner.name}</strong>
                        <br />
                        <small>{item.owner.email}</small>
                      </>
                    ) : (
                      <span className="traza-form-help">
                        Proyecto sin cuenta (navegador)
                      </span>
                    )}
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && projects.length === 0 && (
            <p className="traza-form-help">
              No hay proyectos que coincidan con la búsqueda.
            </p>
          )}
        </div>

        <aside className="traza-card admin-detail" aria-live="polite">
          {!selectedId && (
            <p className="traza-form-help">
              Selecciona un proyecto para consultar sus datos y su configuración.
            </p>
          )}

          {detailError && (
            <p role="alert" className="traza-message traza-message-error">
              {detailError}
            </p>
          )}

          {selectedId && !project && !detailError && (
            <p role="status" className="traza-form-help">
              Cargando proyecto...
            </p>
          )}

          {project && (
            <>
              <h3>{project.name}</h3>
              <p className="admin-detail-email">
                {detail.owner
                  ? `${detail.owner.name} · ${detail.owner.email}`
                  : "Proyecto sin cuenta"}
              </p>

              <dl className="admin-detail-list">
                <div>
                  <dt>Tipo</dt>
                  <dd>
                    {project.mode === "geo"
                      ? "Área geográfica"
                      : "Cuadrícula 10 × 10"}
                  </dd>
                </div>
                <div>
                  <dt>Área</dt>
                  <dd>{project.area?.name || "Sin área"}</dd>
                </div>
                <div>
                  <dt>Elementos</dt>
                  <dd>{project.features?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Escenarios</dt>
                  <dd>{project.scenarios?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Análisis</dt>
                  <dd>{project.analysis?.length ?? 0}</dd>
                </div>
                <div>
                  <dt>Creado</dt>
                  <dd>{formatDate(project.createdAt)}</dd>
                </div>
                <div>
                  <dt>Actualizado</dt>
                  <dd>{formatDate(project.updatedAt)}</dd>
                </div>
              </dl>

              <details className="admin-json">
                <summary>Configuración guardada</summary>
                <pre>
                  {JSON.stringify(
                    {
                      area: project.area,
                      features: project.features,
                      interventions: project.interventions,
                      scenarios: project.scenarios,
                      analysis: project.analysis,
                      baseSnapshot: project.baseSnapshot
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function ContactsSection({ token }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState([]);
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      try {
        setLoading(true);
        const data = await getContacts(token);

        if (!cancelled) setContacts(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadContacts();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function changeStatus(id, status) {
    setUpdating(previous => [...previous, id]);
    setNotice("");

    try {
      setError("");

      const updated = await updateContactStatus(id, status, token);

      setContacts(previous =>
        previous.map(contact => (contact._id === id ? updated : contact))
      );
      setNotice("Estado actualizado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(previous => previous.filter(value => value !== id));
    }
  }

  const visibleContacts = contacts.filter(
    contact => filter === "all" || contact.status === filter
  );

  return (
    <>
      <section className="admin-overview" aria-label="Resumen de solicitudes">
        {Object.entries(CONTACT_STATUSES).map(([key, label]) => (
          <div className="traza-card" key={key}>
            <span>{label}s</span>
            <strong>
              {loading
                ? "—"
                : contacts.filter(contact => contact.status === key).length}
            </strong>
          </div>
        ))}
      </section>

      <div className="admin-list-heading">
        <h2>Solicitudes recibidas ({contacts.length})</h2>
        <div className="traza-field">
          <label htmlFor="contact-filter">Filtrar por estado</label>
          <select
            id="contact-filter"
            value={filter}
            onChange={event => setFilter(event.target.value)}
          >
            <option value="all">Todos los estados</option>
            {Object.entries(CONTACT_STATUSES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="traza-form-help">
        Se muestran hasta las 100 solicitudes más recientes.
      </p>

      {loading && (
        <p role="status" className="traza-message">
          Cargando solicitudes...
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

      {!loading && !error && visibleContacts.length === 0 && (
        <div className="traza-card traza-empty">
          <h3>
            {contacts.length === 0
              ? "Todavía no hay solicitudes"
              : "Sin solicitudes en este estado"}
          </h3>
          <p>
            {contacts.length === 0
              ? "Los mensajes enviados desde Contacto aparecerán aquí."
              : "Selecciona otro estado para consultar el resto de mensajes."}
          </p>
        </div>
      )}

      <div className="admin-contacts">
        {visibleContacts.map(contact => (
          <article className="traza-card admin-contact" key={contact._id}>
            <div className="admin-contact-heading">
              <h3>{contact.name}</h3>
              <span className={`admin-status admin-status-${contact.status}`}>
                {CONTACT_STATUSES[contact.status]}
              </span>
            </div>
            <dl>
              <div>
                <dt>Correo</dt>
                <dd>{contact.email}</dd>
              </div>
              <div>
                <dt>Empresa</dt>
                <dd>{contact.company || "No indicada"}</dd>
              </div>
            </dl>
            <p className="admin-contact-message">{contact.message}</p>
            <div className="traza-field">
              <label htmlFor={`status-${contact._id}`}>
                Estado de la solicitud de {contact.name}
              </label>
              <select
                id={`status-${contact._id}`}
                value={contact.status}
                disabled={updating.includes(contact._id)}
                onChange={event => changeStatus(contact._id, event.target.value)}
              >
                {Object.entries(CONTACT_STATUSES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {updating.includes(contact._id) && (
              <p role="status" className="traza-form-help">
                Guardando estado...
              </p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export default function Admin() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const result = await loginAdmin(email, password);

      setToken(result.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logoutAdmin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setToken(null);
      setEmail("");
      setPassword("");
      setTab("dashboard");
      setLoggingOut(false);
    }
  }

  if (!token) {
    return (
      <div className="traza-page traza-container admin-page">
        <header className="traza-page-header">
          <span className="traza-kicker">ESPACIO DE GESTIÓN</span>
          <h1>Administración de URBI</h1>
          <p>
            Consulta las solicitudes recibidas, las cuentas registradas y los
            proyectos de la plataforma.
          </p>
        </header>

        <div className="admin-login-layout">
          <section>
            <span className="traza-kicker">ACCESO RESTRINGIDO</span>
            <h2>
              Todo el seguimiento,
              <br />
              en un mismo lugar.
            </h2>
            <p>
              Este espacio está reservado para administradores con una cuenta
              previamente creada.
            </p>
            <ul>
              <li>Indicadores generales de la plataforma</li>
              <li>Gestión de cuentas y proyectos</li>
              <li>Solicitudes de contacto</li>
              <li>Cierra tu sesión al terminar</li>
            </ul>
            <p className="traza-form-help">
              La sesión dura hasta dos horas. Al salir de esta sección tendrás
              que volver a iniciar sesión.
            </p>
          </section>

          <form
            className="traza-card traza-form"
            onSubmit={handleLogin}
            aria-busy={loading}
          >
            <h2>Iniciar sesión</h2>
            <p className="traza-form-help">
              Utiliza tus credenciales de administración.
            </p>
            <div className="traza-field">
              <label htmlFor="admin-email">Correo</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="traza-field">
              <label htmlFor="admin-password">Contraseña</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                maxLength={1024}
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <button
              className="traza-btn traza-btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
            {error && (
              <p role="alert" className="traza-message traza-message-error">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="traza-page traza-container admin-page">
      <header className="traza-page-header admin-shell-header">
        <div>
          <span className="traza-kicker">CENTRO DE ADMINISTRACIÓN</span>
          <h1>Panel administrativo</h1>
          <p>
            Estadísticas, cuentas, proyectos y solicitudes de contacto de URBI.
          </p>
        </div>
        <button
          type="button"
          className="traza-btn traza-btn-secondary"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
      </header>

      <nav className="admin-tabs" aria-label="Secciones de administración">
        {TABS.map(item => (
          <button
            type="button"
            key={item.id}
            className={tab === item.id ? "is-active" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            <span aria-hidden="true">{item.symbol}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <Dashboard token={token} />}
      {tab === "users" && <UsersSection token={token} />}
      {tab === "projects" && <ProjectsSection token={token} />}
      {tab === "contacts" && <ContactsSection token={token} />}
    </div>
  );
}
