const router = require("express").Router();
const mongoose = require("mongoose");
const Project = require("../models/Project");
const { optionalAuth } = require("../middleware/auth");

// Campos que un cliente puede modificar. El resto (propietario, fechas) se
// gestiona en el servidor.
const EDITABLE_FIELDS = [
  "name",
  "description",
  "map",
  "mode",
  "area",
  "status",
  "features",
  "interventions",
  "scenarios",
  "analysis",
  "baseSnapshot",
];

const OWNER_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function invalidId(res) {
  return res.status(400).json({ error: "Identificador de proyecto no válido" });
}

function notFound(res) {
  return res.status(404).json({ error: "El proyecto no existe" });
}

function forbidden(res) {
  return res.status(403).json({
    error: "Este proyecto pertenece a otra cuenta"
  });
}

function applyEditableFields(project, body = {}) {
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) project[field] = body[field];
  }
}

// Un proyecto con dueño solo lo ve su dueño (o un administrador). Los proyectos
// antiguos sin cuenta siguen siendo accesibles como antes.
function canAccess(project, auth) {
  if (!project.user) return true;
  if (!auth) return false;

  return auth.role === "admin" || String(project.user) === String(auth.id);
}

router.use(optionalAuth);

router.get("/", async (req, res) => {
  try {
    // Sesión de usuario: solo sus proyectos. Sin sesión: los del navegador
    // identificado por ownerKey. Nunca se listan proyectos de otras cuentas.
    if (req.auth?.role === "user") {
      const projects = await Project.find({ user: req.auth.id }).sort({
        updatedAt: -1
      });

      return res.json(projects);
    }

    const ownerKey =
      typeof req.query.ownerKey === "string" ? req.query.ownerKey.trim() : "";

    if (!OWNER_KEY_PATTERN.test(ownerKey)) {
      return res.status(401).json({
        error: "Inicia sesión para consultar tus proyectos"
      });
    }

    // Se incluyen los proyectos antiguos sin clave para no perder los que ya
    // existían; los de cuentas nunca aparecen aquí.
    const projects = await Project.find({
      user: { $exists: false },
      $or: [{ ownerKey }, { ownerKey: { $exists: false } }]
    }).sort({ updatedAt: -1 });

    res.json(projects);
  } catch {
    res.status(500).json({ error: "Error al obtener proyectos" });
  }
});

router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const project = await Project.findById(req.params.id);

    if (!project) return notFound(res);

    if (!canAccess(project, req.auth)) return forbidden(res);

    res.json(project);
  } catch {
    res.status(500).json({ error: "Error al obtener el proyecto" });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      map,
      mode,
      area,
      ownerKey,
      status,
      features,
      interventions,
      scenarios,
      analysis,
      baseSnapshot,
    } = req.body || {};

    // El propietario siempre lo decide el servidor a partir de la sesión.
    const owner = req.auth?.role === "user" ? req.auth.id : undefined;
    const cleanOwnerKey =
      !owner && typeof ownerKey === "string" && OWNER_KEY_PATTERN.test(ownerKey.trim())
        ? ownerKey.trim()
        : undefined;

    if (!owner && !cleanOwnerKey) {
      return res.status(401).json({
        error: "Inicia sesión o envía una clave de propietario válida"
      });
    }

    const project = await Project.create({
      name,
      description,
      map,
      mode,
      area,
      user: owner,
      ownerKey: cleanOwnerKey,
      status,
      features,
      interventions,
      scenarios,
      analysis,
      baseSnapshot,
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({
      error: "No se pudo guardar el proyecto",
      details: error.message
    });
  }
});

// Actualiza un proyecto existente conservando su identificador y su propietario.
router.put("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const project = await Project.findById(req.params.id);

    if (!project) return notFound(res);

    if (!canAccess(project, req.auth)) return forbidden(res);

    applyEditableFields(project, req.body);
    await project.save();

    res.json(project);
  } catch (error) {
    res.status(400).json({
      error: "No se pudo actualizar el proyecto",
      details: error.message
    });
  }
});

// Duplica un proyecto para explorar una variante sin tocar el original.
router.post("/:id/duplicate", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const source = await Project.findById(req.params.id);

    if (!source) return notFound(res);

    if (!canAccess(source, req.auth)) return forbidden(res);

    const baseName = source.name || "Proyecto";
    const copyName = (req.body?.name?.trim() || `${baseName} (copia)`).slice(
      0,
      Project.LIMITS.name
    );

    const copy = await Project.create({
      name: copyName,
      description: source.description,
      map: source.map,
      mode: source.mode,
      area: source.area,
      status: source.status,
      user: source.user,
      ownerKey: source.ownerKey,
      features: source.features,
      interventions: source.interventions,
      scenarios: source.scenarios,
      analysis: source.analysis,
      baseSnapshot: source.baseSnapshot,
    });

    res.status(201).json(copy);
  } catch (error) {
    res.status(400).json({
      error: "No se pudo duplicar el proyecto",
      details: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return invalidId(res);

  try {
    const project = await Project.findById(req.params.id);

    if (!project) return notFound(res);

    if (!canAccess(project, req.auth)) return forbidden(res);

    await project.deleteOne();

    res.json({ deleted: true, id: req.params.id });
  } catch {
    res.status(500).json({ error: "No se pudo eliminar el proyecto" });
  }
});

module.exports = router;
module.exports.EDITABLE_FIELDS = EDITABLE_FIELDS;
module.exports.applyEditableFields = applyEditableFields;
