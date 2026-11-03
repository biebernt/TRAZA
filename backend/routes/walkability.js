const router = require("express").Router();
const { createPlacesService } = require("../services/walkability");
const getPlaces = createPlacesService();

router.get("/places", async (req, res) => {
  try {
    res.json(await getPlaces());
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 503).json({
      error: error.message,
      retryAfter: error.retryAfter || 60
    });
  }
});

module.exports = router;
