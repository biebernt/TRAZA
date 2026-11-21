const router = require("express").Router();
const { randomBytes } = require("node:crypto");

const User = require("../models/User");
const Project = require("../models/Project");
const Session = require("../models/Session");
const PasswordReset = require("../models/PasswordReset");

const {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken
} = require("../utils/security");

const {
  normalizeEmail,
  validateRegistration,
  validateNewPassword,
  publicUser
} = require("../utils/validation");

const { requireUser } = require("../middleware/auth");

const USER_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const RESET_MS = 60 * 60 * 1000; // 1 hora

function invalidToken(res) {
  return res.status(400).json({ error: "El enlace no es válido o ya expiró" });
}

async function createUserSession(user) {
  const token = generateToken();

  await Session.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + USER_SESSION_MS)
  });

  return token;
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body || {};

    const error = validateRegistration({
      name,
      email,
      password,
      confirmPassword
    });

    if (error) {
      return res.status(400).json({ error });
    }

    const cleanEmail = normalizeEmail(email);
    const exists = await User.findOne({ email: cleanEmail }).lean();

    if (exists) {
      return res.status(409).json({
        error: "Ya existe una cuenta con este correo"
      });
    }

    const salt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, salt);

    const user = await User.create({
      name: name.trim().replace(/\s+/g, " "),
      email: cleanEmail,
      passwordSalt: salt,
      passwordHash,
      role: "user",
      status: "active"
    });

    const token = await createUserSession(user);

    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "Ya existe una cuenta con este correo"
      });
    }

    console.error("Error de registro:", error.message);
    res.status(500).json({ error: "No se pudo crear la cuenta" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length > 1024
    ) {
      return res.status(400).json({ error: "Datos de acceso inválidos" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });

    if (!user) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    const valid = await verifyPassword(
      password,
      user.passwordSalt,
      user.passwordHash
    );

    if (!valid) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: "Tu cuenta está suspendida. Escribe a URBI para solicitar ayuda."
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = await createUserSession(user);

    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error("Error de login de usuario:", error.message);
    res.status(500).json({ error: "No se pudo iniciar sesión" });
  }
});

router.post("/logout", requireUser, async (req, res) => {
  try {
    await Session.deleteOne({ _id: req.sessionId });

    res.json({ message: "Sesión cerrada" });
  } catch {
    res.status(500).json({ error: "No se pudo cerrar sesión" });
  }
});

router.get("/me", requireUser, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id).lean();

    if (!user) {
      return res.status(401).json({ error: "Sesión inválida o expirada" });
    }

    const projectCount = await Project.countDocuments({ user: user._id });

    res.set("Cache-Control", "no-store");
    res.json({ user: { ...publicUser(user), projectCount } });
  } catch {
    res.status(500).json({ error: "No se pudo cargar el perfil" });
  }
});

// Siempre responde lo mismo para no revelar qué correos están registrados.
router.post("/forgot-password", async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({ error: "Introduce un correo válido" });
  }

  const response = {
    message:
      "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña."
  };

  try {
    const user = await User.findOne({ email });

    if (user && user.status === "active") {
      const token = generateToken();

      await PasswordReset.deleteMany({ userId: user._id });
      await PasswordReset.create({
        userId: user._id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_MS)
      });

      // Sin servicio de correo configurado, el token solo se devuelve fuera de
      // producción para poder probar el flujo. En producción lo entrega un
      // administrador desde Gestión de usuarios.
      if (process.env.NODE_ENV !== "production") {
        response.resetToken = token;
        response.expiresInMinutes = RESET_MS / 60000;
      }
    }

    res.json(response);
  } catch (error) {
    console.error("Error de recuperación:", error.message);
    res.status(500).json({ error: "No se pudo procesar la solicitud" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return invalidToken(res);
    }

    const error = validateNewPassword(password);

    if (error) {
      return res.status(400).json({ error });
    }

    const reset = await PasswordReset.findOne({
      tokenHash: hashToken(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() }
    });

    if (!reset) {
      return invalidToken(res);
    }

    const user = await User.findById(reset.userId);

    if (!user || user.status !== "active") {
      return invalidToken(res);
    }

    const salt = randomBytes(16).toString("hex");

    user.passwordSalt = salt;
    user.passwordHash = await hashPassword(password, salt);
    await user.save();

    reset.usedAt = new Date();
    await reset.save();

    // Al cambiar la contraseña se cierran las sesiones abiertas.
    await Session.deleteMany({ userId: user._id });

    res.json({
      message: "Contraseña actualizada. Ya puedes iniciar sesión."
    });
  } catch (error) {
    console.error("Error al restablecer:", error.message);
    res.status(500).json({ error: "No se pudo restablecer la contraseña" });
  }
});

module.exports = router;
