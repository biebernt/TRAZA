const router = require("express").Router();
const mongoose = require("mongoose");
const Project = require("../models/Project");

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

function invalidId(res) {
  return res.status(400).json({ error: "Identificador de proyecto no válido" });
}

function notFound(res) {
  return res.status(404).json({ error: "El proyecto no existe" });
}

function applyEditableFields(project, body = {}) {
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) project[field] = body[field];
  }
}

router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (typeof req.query.ownerKey === "string" && req.query.ownerKey.trim()) {
      filter.ownerKey = req.query.ownerKey.trim();
    }

    const projects = await Project.find(filter).sort({ updatedAt: -1 });
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

    const project = await Project.create({
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
    const deleted = await Project.findByIdAndDelete(req.params.id);

    if (!deleted) return notFound(res);

    res.json({ deleted: true, id: req.params.id });
  } catch {
    res.status(500).json({ error: "No se pudo eliminar el proyecto" });
  }
});

module.exports = router;
module.exports.EDITABLE_FIELDS = EDITABLE_FIELDS;
module.exports.applyEditableFields = applyEditableFields;
