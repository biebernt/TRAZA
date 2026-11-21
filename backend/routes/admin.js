const router = require("express").Router();
const mongoose = require("mongoose");
const { randomBytes } = require("node:crypto");

const User = require("../models/User");
const Project = require("../models/Project");
const Session = require("../models/Session");
const Contact = require("../models/Contact");
const PasswordReset = require("../models/PasswordReset");

const { hashPassword, generateToken, hashToken } = require("../utils/security");
const { requireAdmin } = require("../middleware/auth");

const RESET_MS = 60 * 60 * 1000;
const USER_STATUSES = ["active", "suspended"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

router.use(requireAdmin);

function invalidId(res, label) {
  return res.status(400).json({ error: `Identificador de ${label} no válido` });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchRegex(value) {
  return new RegExp(escapeRegex(value.trim().slice(0, 120)), "i");
}

function publicUserAdmin(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role || "user",
    status: user.status || "active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt
  };
}

// Resumen general calculado con datos reales de MongoDB.
router.get("/stats", async (req, res) => {
  try {
    const since = new Date(Date.now() - WEEK_MS);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      newUsers,
      totalProjects,
      recentProjects,
      totalContacts,
      pendingContacts
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ status: "suspended" }),
      User.countDocuments({ createdAt: { $gte: since } }),
      Project.countDocuments(),
      Project.countDocuments({ createdAt: { $gte: since } }),
      Contact.countDocuments(),
      Contact.countDocuments({ status: "pending" })
    ]);

    res.set("Cache-Control", "no-store");
    res.json({
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, newLast7Days: newUsers },
      projects: { total: totalProjects, newLast7Days: recentProjects },
      contacts: { total: totalContacts, pending: pendingContacts },
      generatedAt: new Date().toISOString()
    });
  } catch {
    res.status(500).json({ error: "No se pudieron calcular las estadísticas" });
  }
});

// Listado de cuentas con el número de proyectos de cada una.
router.get("/users", async (req, res) => {
  try {
    const match = {};
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = req.query.status;

    if (search) {
      const regex = searchRegex(search);
      match.$or = [{ name: regex }, { email: regex }];
    }

    if (status && USER_STATUSES.includes(status)) {
      match.status = status;
    }

    const users = await User.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: Project.collection.name,
          localField: "_id",
          foreignField: "user",
          as: "projects"
        }
      },
      {
        $addFields: {
          projectCount: { $size: "$projects" },
          lastProjectAt: { $max: "$projects.updatedAt" }
        }
      },
      { $project: { projects: 0, passwordHash: 0, passwordSalt: 0 } }
    ]);

    res.set("Cache-Control", "no-store");
    res.json(
      users.map(user => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role || "user",
        status: user.status || "active",
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        projectCount: user.projectCount,
        lastProjectAt: user.lastProjectAt || null
      }))
    );
  } catch {
    res.status(500).json({ error: "No se pudieron cargar los usuarios" });
  }
});

router.get("/users/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, "usuario");

  try {
    const user = await User.findById(req.params.id).lean();

    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    const [projectCount, projects] = await Promise.all([
      Project.countDocuments({ user: user._id }),
      Project.find({ user: user._id })
        .select("name mode status area.name createdAt updatedAt features")
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean()
    ]);

    res.set("Cache-Control", "no-store");
    res.json({
      user: {
        ...publicUserAdmin(user),
        projectCount
      },
      projects: projects.map(project => ({
        id: String(project._id),
        name: project.name,
        mode: project.mode,
        status: project.status,
        areaName: project.area?.name || "",
        featureCount: Array.isArray(project.features) ? project.features.length : 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }))
    });
  } catch {
    res.status(500).json({ error: "No se pudo cargar el usuario" });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, "usuario");

  const { status } = req.body || {};

  if (!USER_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Estado de cuenta inválido" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    // Suspender una cuenta cierra sus sesiones abiertas de inmediato.
    if (status === "suspended") {
      await Session.deleteMany({ userId: user._id });
    }

    res.json({ user: publicUserAdmin(user) });
  } catch {
    res.status(400).json({ error: "No se pudo actualizar la cuenta" });
  }
});

// Genera un token de recuperación de un solo uso para entregarlo al usuario.
router.post("/users/:id/reset-password", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, "usuario");

  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    const token = generateToken();
    const salt = randomBytes(16).toString("hex");

    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_MS)
    });

    // Se invalida la contraseña anterior hasta que el usuario use el enlace.
    user.passwordSalt = salt;
    user.passwordHash = await hashPassword(generateToken(), salt);
    await user.save();
    await Session.deleteMany({ userId: user._id });

    res.json({
      token,
      expiresAt: new Date(Date.now() + RESET_MS).toISOString(),
      message:
        "Entrega este enlace al usuario. Caduca en una hora y solo puede usarse una vez."
    });
  } catch {
    res.status(500).json({ error: "No se pudo generar el enlace" });
  }
});

router.delete("/users/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, "usuario");

  const keepProjects = req.query.keepProjects === "true";

  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ error: "El usuario no existe" });

    const projectCount = await Project.countDocuments({ user: user._id });

    if (keepProjects) {
      await Project.updateMany({ user: user._id }, { $set: { user: null } });
    } else {
      await Project.deleteMany({ user: user._id });
    }

    await Session.deleteMany({ userId: user._id });
    await PasswordReset.deleteMany({ userId: user._id });
    await user.deleteOne();

    res.json({
      deleted: true,
      id: req.params.id,
      projects: keepProjects
        ? { kept: projectCount, deleted: 0 }
        : { kept: 0, deleted: projectCount }
    });
  } catch {
    res.status(500).json({ error: "No se pudo eliminar la cuenta" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const filter = {};
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const userId = req.query.userId;

    if (search) filter.name = searchRegex(search);

    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return invalidId(res, "usuario");
      }

      filter.user = userId;
    }

    const projects = await Project.find(filter)
      .select("name mode status ownerKey user area.name createdAt updatedAt features")
      .populate("user", "name email status")
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    res.set("Cache-Control", "no-store");
    res.json(
      projects.map(project => ({
        id: String(project._id),
        name: project.name,
        mode: project.mode,
        status: project.status,
        areaName: project.area?.name || "",
        featureCount: Array.isArray(project.features) ? project.features.length : 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        owner: project.user
          ? { id: String(project.user._id), name: project.user.name, email: project.user.email }
          : null,
        anonymous: !project.user
      }))
    );
  } catch {
    res.status(500).json({ error: "No se pudieron cargar los proyectos" });
  }
});

router.get("/projects/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res, "proyecto");

  try {
    const project = await Project.findById(req.params.id)
      .populate("user", "name email status createdAt")
      .lean();

    if (!project) {
      return res.status(404).json({ error: "El proyecto no existe" });
    }

    delete project.ownerKey;

    res.set("Cache-Control", "no-store");
    res.json({
      project,
      owner: project.user
        ? { id: String(project.user._id), name: project.user.name, email: project.user.email, status: project.user.status }
        : null
    });
  } catch {
    res.status(500).json({ error: "No se pudo cargar el proyecto" });
  }
});

module.exports = router;
