import { useState } from "react";

import { useAuth } from "../state/authContext";
import { resetPassword, requestPasswordReset } from "../services/api";
import "./Auth.css";

const TITLES = {
  login: {
    kicker: "TU CUENTA URBI",
    title: "Vuelve a tus proyectos.",
    intro:
      "Inicia sesión para continuar donde lo dejaste y mantener tus proyectos guardados en tu cuenta.",
    heading: "Iniciar sesión"
  },
  register: {
    kicker: "CREA TU CUENTA",
    title: "Tu espacio para planificar.",
    intro:
      "Guarda tus proyectos en la nube, recupéralos desde cualquier visita y sigue trabajando sin perder la configuración.",
    heading: "Crear cuenta"
  },
  forgot: {
    kicker: "RECUPERAR ACCESO",
    title: "Recupera tu contraseña.",
    intro:
      "Indica el correo con el que te registraste. Te daremos un enlace de un solo uso para elegir una nueva contraseña.",
    heading: "Restablecer contraseña"
  },
  reset: {
    kicker: "NUEVA CONTRASEÑA",
    title: "Elige una contraseña nueva.",
    intro:
      "Al guardarla se cerrarán las sesiones abiertas y podrás entrar con la nueva contraseña.",
    heading: "Cambiar contraseña"
  }
};

export default function Auth({ mode = "login", navigate, resetToken = "" }) {
  const [view, setView] = useState(mode);
  const [token, setToken] = useState(resetToken);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const { login, register, user } = useAuth();

  const copy = TITLES[view] || TITLES.login;

  function go(next) {
    setView(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (view === "login") {
        await login(email.trim(), password);
        navigate("account");
        return;
      }

      if (view === "register") {
        if (password !== confirmPassword) {
          throw new Error("Las contraseñas no coinciden");
        }

        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword
        });
        navigate("account");
        return;
      }

      if (view === "forgot") {
        const result = await requestPasswordReset(email.trim());

        setNotice(result.message);

        if (result.resetToken) {
          setToken(result.resetToken);
          setNotice(
            `${result.message} Como el servicio de correo no está configurado en este entorno, el enlace se genera aquí abajo.`
          );
        }

        return;
      }

      if (view === "reset") {
        const result = await resetPassword(token, password);

        setNotice(result.message);
        setPassword("");
        setConfirmPassword("");
        return;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="traza-page traza-container auth-page">
      <header className="traza-page-header">
        <span className="traza-kicker">ESPACIO PERSONAL</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>

      <div className="auth-layout">
        <section className="auth-aside">
          <span className="traza-kicker">MIS PROYECTOS</span>
          <h2>Tus escenarios, siempre disponibles.</h2>
          <ul>
            <li>Guarda cada proyecto en tu cuenta</li>
            <li>Retómalo con su área y sus elementos</li>
            <li>Accede desde tu computadora o tu teléfono</li>
          </ul>
          <p className="traza-form-help">
            Tu cuenta es independiente del acceso administrativo de URBI. Cada
            persona ve únicamente sus propios proyectos.
          </p>

          {user && (
            <p className="traza-message traza-message-success" role="status">
              Sesión iniciada como {user.name}.{" "}
              <button
                type="button"
                className="auth-inline-link"
                onClick={() => navigate("account")}
              >
                Ir a Mis proyectos
              </button>
            </p>
          )}
        </section>

        <form className="traza-card traza-form auth-form" onSubmit={handleSubmit} aria-busy={loading}>
          <h2>{copy.heading}</h2>

          {view === "register" && (
            <div className="traza-field">
              <label htmlFor="auth-name">Nombre completo</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                maxLength={120}
                value={name}
                onChange={event => setName(event.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          {view !== "reset" && (
            <div className="traza-field">
              <label htmlFor="auth-email">Correo electrónico</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          {view !== "forgot" && (
            <div className="traza-field">
              <label htmlFor="auth-password">
                {view === "reset" ? "Contraseña nueva" : "Contraseña"}{" "}
                <span>(mínimo 8 caracteres)</span>
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={
                  view === "login" ? "current-password" : "new-password"
                }
                maxLength={1024}
                minLength={view === "login" ? undefined : 8}
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          {(view === "register" || view === "reset") && (
            <div className="traza-field">
              <label htmlFor="auth-confirm">Confirmar contraseña</label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                maxLength={1024}
                minLength={8}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          {view === "reset" && !token && (
            <p className="traza-message traza-message-error" role="alert">
              No hay un enlace de recuperación válido. Solicita uno nuevo desde
              «Olvidé mi contraseña».
            </p>
          )}

          <button
            className="traza-btn traza-btn-primary"
            type="submit"
            disabled={
              loading ||
              (view === "reset" && (!token || password !== confirmPassword))
            }
          >
            {loading
              ? "Procesando..."
              : view === "login"
                ? "Entrar"
                : view === "register"
                  ? "Crear mi cuenta"
                  : view === "forgot"
                    ? "Enviar instrucciones"
                    : "Guardar contraseña"}
          </button>

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

          {view === "forgot" && token && (
            <button
              type="button"
              className="traza-btn traza-btn-secondary"
              onClick={() => go("reset")}
            >
              Continuar con la contraseña nueva
            </button>
          )}

          <nav className="auth-links" aria-label="Opciones de acceso">
            {view === "login" && (
              <>
                <button type="button" onClick={() => go("register")}>
                  Crear una cuenta
                </button>
                <button type="button" onClick={() => go("forgot")}>
                  Olvidé mi contraseña
                </button>
              </>
            )}

            {view === "register" && (
              <button type="button" onClick={() => go("login")}>
                Ya tengo cuenta, iniciar sesión
              </button>
            )}

            {view === "forgot" && (
              <button type="button" onClick={() => go("login")}>
                Volver al inicio de sesión
              </button>
            )}

            {view === "reset" && (
              <button type="button" onClick={() => go("login")}>
                Ir al inicio de sesión
              </button>
            )}
          </nav>
        </form>
      </div>
    </div>
  );
}
