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

      setToken(result.token);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(id, status) {
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
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    try {
      await logoutAdmin(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setToken(null);
      setContacts([]);
      setEmail("");
      setPassword("");
    }
  }

  if (!token) {
    return (
      <div className="page-container">
        <h1>Administración de TRAZA</h1>
        <p>Acceso exclusivo para administradores.</p>

        <form className="contact-form" onSubmit={handleLogin}>
          <h2>Iniciar sesión</h2>

          <label htmlFor="admin-email">Correo</label>
          <input
            id="admin-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <label htmlFor="admin-password">Contraseña</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          {error && <p role="alert">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1>Panel administrativo</h1>

      <button onClick={handleLogout}>
        Cerrar sesión
      </button>

      <h2>Solicitudes recibidas ({contacts.length})</h2>

      {loading && <p>Cargando solicitudes...</p>}
      {error && <p role="alert">{error}</p>}

      {!loading && contacts.length === 0 && (
        <p>No hay solicitudes disponibles.</p>
      )}

      <div className="admin-contacts">
        {contacts.map(contact => (
          <article className="admin-contact" key={contact._id}>
            <h3>{contact.name}</h3>

            <p><strong>Correo:</strong> {contact.email}</p>
            <p>
              <strong>Empresa:</strong>{" "}
              {contact.company || "No indicada"}
            </p>
            <p><strong>Mensaje:</strong> {contact.message}</p>

            <label htmlFor={`status-${contact._id}`}>
              Estado
            </label>

            <select
              id={`status-${contact._id}`}
              value={contact.status}
              onChange={e =>
                changeStatus(contact._id, e.target.value)
              }
            >
              <option value="pending">Pendiente</option>
              <option value="reviewed">Revisada</option>
              <option value="resolved">Resuelta</option>
            </select>
          </article>
        ))}
      </div>
    </div>
  );
}