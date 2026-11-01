const router = require("express").Router();
const Contact = require("../models/Contact");
const requireAdmin = require("../middleware/auth");

router.post("/", async (req, res) => {
  try {
    const { name, email, company, message } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      (company !== undefined && typeof company !== "string")
    ) {
      return res.status(400).json({
        error: "Los campos deben contener texto válido"
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();
    const cleanCompany = (company || "").trim();

    if (!cleanName || !cleanEmail || !cleanMessage) {
      return res.status(400).json({
        error: "Completa los campos obligatorios"
      });
    }

    if (
      cleanName.length > 100 ||
      cleanEmail.length > 254 ||
      cleanCompany.length > 120 ||
      cleanMessage.length > 2000
    ) {
      return res.status(400).json({
        error: "Uno o más campos exceden el límite permitido"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        error: "Introduce un correo válido"
      });
    }

    await Contact.create({
      name: cleanName,
      email: cleanEmail,
      company: cleanCompany,
      message: cleanMessage
    });

    res.status(201).json({
      success: true,
      message: "Solicitud recibida correctamente"
    });
  } catch (error) {
    console.error("Error al guardar contacto:", error.message);
    res.status(500).json({
      error: "No se pudo procesar la solicitud"
    });
  }
});


router.get("/", requireAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(contacts);
  } catch {
    res.status(500).json({
      error: "No se pudieron cargar las solicitudes"
    });
  }
});

router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!["pending", "reviewed", "resolved"].includes(status)) {
      return res.status(400).json({
        error: "Estado inválido"
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        error: "Solicitud no encontrada"
      });
    }

    res.json(contact);
  } catch {
    res.status(400).json({
      error: "No se pudo actualizar la solicitud"
    });
  }
});

module.exports = router;