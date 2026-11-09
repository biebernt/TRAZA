import { useEffect, useState } from "react";

import {
  loginAdmin,
  getContacts,
  updateContactStatus,
  logoutAdmin
} from "../services/api";

export default function Admin() {
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [filter, setFilter] = useState("all");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;

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

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const result = await loginAdmin(email, password);
      setNotice("");
      setFilter("all");

      setToken(result.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(id, status) {
    setUpdating(previous => [...previous, id]);
    setNotice("");
    try {
      setError("");

      const updated = await updateContactStatus(
        id,
        status,
        token
      );

      setContacts(previous =>
        previous.map(contact =>
          contact._id === id ? updated : contact
        )
      );
      setNotice("Estado actualizado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(previous => previous.filter(value => value !== id));
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
      setContacts([]);
      setEmail("");
      setPassword("");
      setLoggingOut(false);
    }
  }

  const statuses = { pending: "Pendiente", reviewed: "Revisada", resolved: "Resuelta" };
  const visibleContacts = contacts.filter(contact => filter === "all" || contact.status === filter);

  if (!token) {
    return (
      <div className="traza-page traza-container admin-page">
        <header className="traza-page-header"><span className="traza-kicker">ESPACIO DE GESTIÓN</span><h1>Administración de URBI</h1><p>Consulta las solicitudes recibidas y da seguimiento a las ideas compartidas con la plataforma.</p></header>
        <div className="admin-login-layout"><section><span className="traza-kicker">ACCESO RESTRINGIDO</span><h2>Todo el seguimiento,<br />en un mismo lugar.</h2><p>Este espacio está reservado para administradores con una cuenta previamente creada.</p><ul><li>Consulta los mensajes de contacto</li><li>Organiza solicitudes por estado</li><li>Cierra tu sesión al terminar</li></ul><p className="traza-form-help">La sesión dura hasta dos horas. Al salir de esta sección tendrás que volver a iniciar sesión.</p></section>
          <form className="traza-card traza-form" onSubmit={handleLogin} aria-busy={loading}>
            <h2>Iniciar sesión</h2><p className="traza-form-help">Utiliza tus credenciales de administración.</p>
            <div className="traza-field"><label htmlFor="admin-email">Correo</label><input id="admin-email" type="email" autoComplete="username" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={loading} required /></div>
            <div className="traza-field"><label htmlFor="admin-password">Contraseña</label><input id="admin-password" type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} disabled={loading} required /></div>
            <button className="traza-btn traza-btn-primary" type="submit" disabled={loading}>{loading ? "Ingresando..." : "Iniciar sesión"}</button>
            {error && <p role="alert" className="traza-message traza-message-error">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="traza-page traza-container admin-page">
      <header className="traza-page-header"><span className="traza-kicker">GESTIÓN DE SOLICITUDES</span><h1>Panel administrativo</h1><p>Revisa los mensajes y actualiza su estado para mantener el seguimiento.</p><button type="button" className="traza-btn traza-btn-secondary" onClick={handleLogout} disabled={loggingOut || updating.length > 0}>{loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}</button></header>
      <section className="admin-overview" aria-label="Resumen de solicitudes">{Object.entries(statuses).map(([key, label]) => <div className="traza-card" key={key}><span>{label}s</span><strong>{loading ? "—" : contacts.filter(contact => contact.status === key).length}</strong></div>)}</section>
      <div className="admin-list-heading"><h2>Solicitudes recibidas ({contacts.length})</h2><div className="traza-field"><label htmlFor="contact-filter">Filtrar por estado</label><select id="contact-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
      <p className="traza-form-help">Se muestran hasta las 100 solicitudes más recientes.</p>
      {loading && <p role="status" className="traza-message">Cargando solicitudes...</p>}
      {error && <p role="alert" className="traza-message traza-message-error">{error}</p>}
      {notice && <p role="status" className="traza-message traza-message-success">{notice}</p>}
      {!loading && !error && visibleContacts.length === 0 && <div className="traza-card traza-empty"><h3>{contacts.length === 0 ? "Todavía no hay solicitudes" : "Sin solicitudes en este estado"}</h3><p>{contacts.length === 0 ? "Los mensajes enviados desde Contacto aparecerán aquí." : "Selecciona otro estado para consultar el resto de mensajes."}</p></div>}
      <div className="admin-contacts">{visibleContacts.map(contact => <article className="traza-card admin-contact" key={contact._id}>
        <div className="admin-contact-heading"><h3>{contact.name}</h3><span className={`admin-status admin-status-${contact.status}`}>{statuses[contact.status]}</span></div>
        <dl><div><dt>Correo</dt><dd>{contact.email}</dd></div><div><dt>Empresa</dt><dd>{contact.company || "No indicada"}</dd></div></dl>
        <p className="admin-contact-message">{contact.message}</p>
        <div className="traza-field"><label htmlFor={`status-${contact._id}`}>Estado de la solicitud de {contact.name}</label><select id={`status-${contact._id}`} value={contact.status} disabled={updating.includes(contact._id) || loggingOut} onChange={e => changeStatus(contact._id, e.target.value)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {updating.includes(contact._id) && <p role="status" className="traza-form-help">Guardando estado...</p>}
      </article>)}</div>
    </div>
  );
}
