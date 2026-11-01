const router = require("express").Router();
const Project = require("../models/Project");

router.get("/", async (req, res) => {
  try {
    const projects = await Project.find().sort({ updatedAt: -1 });
    res.json(projects);
  } catch {
    res.status(500).json({ error: "Error al obtener proyectos" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, map } = req.body;

    const project = await Project.create({
      name,
      description,
      map
    });

    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({
      error: "No se pudo guardar el proyecto",
      details: error.message
    });
  }
});

module.exports = router;