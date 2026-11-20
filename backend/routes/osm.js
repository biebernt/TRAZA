const express = require("express");
const { createAreaService } = require("../services/osm");

function serviceOptionsFromEnv() {
  const maxAreaKm2 = Number(process.env.OSM_MAX_AREA_KM2);
  const endpoints = (process.env.OVERPASS_ENDPOINTS || "")
    .split(",")
    .map(endpoint => endpoint.trim())
    .filter(Boolean);

  return {
    maxAreaKm2: Number.isFinite(maxAreaKm2) && maxAreaKm2 > 0 ? maxAreaKm2 : 2,
    endpoints: endpoints.length ? endpoints : undefined,
  };
}

function parseBbox(raw) {
  if (typeof raw !== "string") return undefined;

  const parts = raw.split(",");

  if (parts.length !== 4) return undefined;

  return parts.map(part => Number(part.trim()));
}

function createOsmRouter({ service } = {}) {
  const router = express.Router();
  const areaService = service ?? createAreaService(serviceOptionsFromEnv());

  router.get("/area", async (req, res) => {
    try {
      const bbox = parseBbox(req.query.bbox);

      if (!bbox) {
        return res.status(400).json({
          error: "Indica el área como bbox=south,west,north,east",
          code: "invalid-bbox",
        });
      }

      const snapshot = await areaService.getArea(bbox);

      res.set("Cache-Control", "public, max-age=60");
      res.json(snapshot);
    } catch (error) {
      if (error.retryAfterMs) {
        res.set("Retry-After", String(Math.ceil(error.retryAfterMs / 1000)));
      }

      res.status(error.status || 500).json({
        error: error.message || "No se pudo consultar el área",
        code: error.code || "osm-error",
      });
    }
  });

  return router;
}

module.exports = createOsmRouter();
module.exports.createOsmRouter = createOsmRouter;
module.exports.parseBbox = parseBbox;
