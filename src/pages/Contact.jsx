import { useRef, useState } from "react";
import { sendContact } from "../services/api";

const initialForm = { name: "", email: "", company: "", message: "" };

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
    setFeedback("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (!form.name.trim() || !form.message.trim()) {
      setSuccess(false);
      setFeedback("Escribe tu nombre y mensaje; no pueden contener solo espacios.");
      return;
    }
    submitting.current = true;
    setLoading(true);
    setFeedback("");
    setSuccess(false);
    try {
      await sendContact(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])));
      setFeedback("Tu solicitud fue enviada correctamente. Gracias por compartir tu idea.");
      setSuccess(true);
      setForm(initialForm);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="traza-page traza-container contact-page">
      <header className="traza-page-header"><span className="traza-kicker">CONVERSEMOS SOBRE TU IDEA</span><h1>Contacta con URBI</h1><p>¿Estás explorando un proyecto urbano o una ubicación comercial? Cuéntanos qué quieres resolver.</p></header>
      <div className="contact-layout">
        <section className="contact-intro" aria-labelledby="contact-intro-title"><span className="traza-kicker">UN PUNTO DE ENCUENTRO</span><h2 id="contact-intro-title">Las buenas preguntas abren posibilidades.</h2><p>Comparte tu contexto y lo que te gustaría explorar con las herramientas de URBI.</p><ul><li>Propuestas de planificación urbana</li><li>Criterios para comparar ubicaciones</li><li>Comentarios sobre la plataforma</li></ul><div className="traza-card contact-note"><strong>Un proyecto en construcción</strong><p>URBI es un prototipo educativo. Este formulario registra tu solicitud para su revisión; no es un chat en tiempo real ni un servicio de consultoría contratado.</p></div></section>
        <form className="traza-card traza-form" onSubmit={handleSubmit} aria-busy={loading}>
          <h2>Cuéntanos tu proyecto</h2><p className="traza-form-help">Los campos marcados con * son obligatorios.</p>
          <fieldset disabled={loading} className="traza-fieldset"><legend className="traza-sr-only">Datos de contacto y mensaje</legend>
            <div className="traza-field"><label htmlFor="contact-name">Nombre completo *</label><input id="contact-name" name="name" autoComplete="name" value={form.name} onChange={handleChange} maxLength={100} required /></div>
            <div className="traza-field"><label htmlFor="contact-email">Correo electrónico *</label><input id="contact-email" type="email" name="email" autoComplete="email" value={form.email} onChange={handleChange} maxLength={254} required /></div>
            <div className="traza-field"><label htmlFor="contact-company">Empresa u organización <span>(opcional)</span></label><input id="contact-company" name="company" autoComplete="organization" value={form.company} onChange={handleChange} maxLength={120} /></div>
            <div className="traza-field"><label htmlFor="contact-message">Mensaje *</label><textarea id="contact-message" name="message" value={form.message} onChange={handleChange} maxLength={2000} rows={6} aria-describedby="contact-message-help" required /><small id="contact-message-help">Incluye el objetivo de tu idea. {form.message.length}/2000 caracteres.</small></div>
            <button className="traza-btn traza-btn-primary" type="submit">{loading ? "Enviando..." : "Enviar solicitud"}</button>
          </fieldset>
          {feedback && <p role={success ? "status" : "alert"} className={`traza-message ${success ? "traza-message-success" : "traza-message-error"}`}>{feedback}</p>}
        </form>
      </div>
    </div>
  );
}
