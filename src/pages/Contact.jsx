import { useState } from "react";
import { sendContact } from "../services/api";

const initialForm = {
  name: "",
  email: "",
  company: "",
  message: ""
};

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [success, setSuccess] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    setSuccess(false);

    try {
      await sendContact(form);
      setFeedback("Tu solicitud fue enviada correctamente.");
      setSuccess(true);
      setForm(initialForm);
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <h1>Contacta con TRAZA</h1>

      <p>
        ¿Tienes un proyecto urbano o necesitas evaluar
        la ubicación de tu negocio? Cuéntanos tu idea.
      </p>

      <form className="contact-form" onSubmit={handleSubmit}>
        <label htmlFor="contact-name">Nombre completo</label>
        <input
          id="contact-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          maxLength={100}
          required
        />

        <label htmlFor="contact-email">Correo electrónico</label>
        <input
          id="contact-email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          maxLength={254}
          required
        />

        <label htmlFor="contact-company">
          Empresa u organización
        </label>
        <input
          id="contact-company"
          name="company"
          value={form.company}
          onChange={handleChange}
          maxLength={120}
        />

        <label htmlFor="contact-message">Mensaje</label>
        <textarea
          id="contact-message"
          name="message"
          value={form.message}
          onChange={handleChange}
          maxLength={2000}
          rows={5}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>

        {feedback && (
          <p
            role="status"
            style={{ color: success ? "#14785b" : "#b42318" }}
          >
            {feedback}
          </p>
        )}
      </form>
    </div>
  );
}