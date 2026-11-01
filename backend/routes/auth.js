const router = require("express").Router();

const Admin = require("../models/Admin");
const Session = require("../models/Session");

const {
  verifyPassword,
  generateToken,
  hashToken
} = require("../utils/security");

const requireAdmin = require("../middleware/auth");

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 1024
    ) {
      return res.status(400).json({
        error: "Datos de acceso inválidos"
      });
    }

    const admin = await Admin.findOne({
      email: email.trim().toLowerCase()
    });

    if (!admin) {
      return res.status(401).json({
        error: "Credenciales incorrectas"
      });
    }

    const valid = await verifyPassword(
      password,
      admin.passwordSalt,
      admin.passwordHash
    );

    if (!valid) {
      return res.status(401).json({
        error: "Credenciales incorrectas"
      });
    }

    const token = generateToken();

    await Session.create({
      adminId: admin._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    });

    res.json({
      token,
      admin: { email: admin.email }
    });
  } catch (error) {
    console.error("Error de login:", error.message);

    res.status(500).json({
      error: "No se pudo iniciar sesión"
    });
  }
});

router.post("/logout", requireAdmin, async (req, res) => {
  try {
    await Session.deleteOne({ _id: req.sessionId });

    res.json({
      message: "Sesión cerrada"
    });
  } catch {
    res.status(500).json({
      error: "No se pudo cerrar sesión"
    });
  }
});

module.exports = router;