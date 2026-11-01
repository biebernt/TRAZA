import { useState } from "react";

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    message: ""
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    alert(
      "Formulario de demostración. " +
      "El envío estará disponible próximamente."
    );
  }

  return (
    <div className="page-container">
      <h1>Hablemos de tu próximo proyecto</h1>
      <p>
        Cuéntanos cómo TRAZA puede ayudarte
        a desarrollar mejores espacios urbanos.
      </p>

      <form className="contact-form" onSubmit={handleSubmit}>
        <label htmlFor="contact-name">Nombre completo</label>
        <input
          id="contact-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
        />

        <label htmlFor="contact-email">Correo electrónico</label>
        <input
          id="contact-email"
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <label htmlFor="contact-company">Empresa u organización</label>
        <input
          id="contact-company"
          name="company"
          value={form.company}
          onChange={handleChange}
        />

        <label htmlFor="contact-message">Mensaje</label>
        <textarea
          id="contact-message"
          name="message"
          value={form.message}
          onChange={handleChange}
          rows="5"
          required
        />

        <button type="submit">Enviar solicitud</button>
      </form>
    </div>
  );
}