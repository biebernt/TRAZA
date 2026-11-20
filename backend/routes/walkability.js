const router = require("express").Router();
const { createPlacesService } = require("../services/walkability");
const { GeoError, normalizeBbox, bboxAreaKm2 } = require("../utils/geo");
const getPlaces = createPlacesService();

// Misma cota que el resto de la plataforma: el prototipo analiza áreas de hasta 2 km².
const MAX_AREA_KM2 = 2;

function parseBbox(raw) {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new GeoError("Indica el área como bbox=south,west,north,east", {
      code: "invalid-bbox",
    });
  }

  const bbox = normalizeBbox(raw);

  if (bboxAreaKm2(bbox) > MAX_AREA_KM2) {
    throw new GeoError(
      `El área consultada supera el máximo de ${MAX_AREA_KM2} km². Ajusta el mapa.`,
      { status: 422, code: "area-too-large" }
    );
  }

  return bbox;
}

router.get("/places", async (req, res) => {
  try {
    res.json(await getPlaces(parseBbox(req.query.bbox)));
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));

    res.status(error.status || 503).json({
      error: error.message,
      code: error.code || "walkability-error",
      retryAfter: error.retryAfter || 60
    });
  }
});

module.exports = router;
module.exports.parseBbox = parseBbox;
