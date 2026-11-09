// Fixed pilot area: no user-supplied Overpass queries or arbitrary URLs.
const PILOT = Object.freeze({
  name: "Ciudad del Saber",
  latitude: 9.0025,
  longitude: -79.5804,
  radiusMeters: 1500
});
const CACHE_MS = 30 * 60 * 1000;
const BACKOFF_MS = 60 * 1000;
const TIMEOUT_MS = 25000;
const CATEGORY_TAGS = {
  school: "education", kindergarten: "education", university: "education", college: "education",
  pharmacy: "health", clinic: "health", hospital: "health", doctors: "health",
  restaurant: "food", cafe: "food", supermarket: "food", convenience: "food",
  greengrocer: "food", bakery: "food", park: "parks"
};

function normalizePlaces(elements) {
  const seen = new Set();
  return elements.flatMap(element => {
    const tags = element.tags || {};
    const point = element.center || element;
    const kind = tags.amenity || tags.shop || tags.leisure;
    const id = `${element.type}/${element.id}`;
    if (!CATEGORY_TAGS[kind] || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || seen.has(id)) return [];
    seen.add(id);
    return [{
      id, name: tags.name || "Sin nombre registrado", category: CATEGORY_TAGS[kind], kind,
      latitude: point.lat, longitude: point.lon,
      locationType: element.type === "node" ? "mapped-point" : "geometry-center",
      osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`
    }];
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

// Factory allows controlled tests without making repeated public API requests.
function createPlacesService({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  let cached;
  let pending;
  let retryAt = 0;

  function snapshot(stale = false) {
    return { ...cached, cache: { stale, expiresAt: new Date(cached.timestamp + CACHE_MS).toISOString() } };
  }

  function unavailable() {
    const error = new Error("El servicio de datos de OpenStreetMap no está disponible. Inténtalo de nuevo en un minuto.");
    error.status = 503;
    error.retryAfter = Math.max(1, Math.ceil((retryAt - now()) / 1000));
    return error;
  }

  async function load() {
    try {
      const around = `around:${PILOT.radiusMeters},${PILOT.latitude},${PILOT.longitude}`;
      const query = `[out:json][timeout:20];(nwr(${around})[amenity~"^(school|kindergarten|university|college|pharmacy|clinic|hospital|doctors|restaurant|cafe)$"];nwr(${around})[shop~"^(supermarket|convenience|greengrocer|bakery)$"];nwr(${around})[leisure=park];);out center tags;`;
      const url = new URL("https://overpass-api.de/api/interpreter");
      url.searchParams.set("data", query);
      const response = await fetchImpl(url, {
        headers: { Accept: "application/json", "User-Agent": "URBI-Educational-Pilot/1.0" },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) throw new Error("Upstream unavailable");
      const data = await response.json();
      // Overpass may report a timed-out/incomplete query in a successful HTTP response.
      if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete upstream response");
      const timestamp = now();
      cached = {
        area: PILOT,
        source: "OpenStreetMap · Overpass API",
        attribution: "© OpenStreetMap contributors · ODbL",
        osmTimestamp: data.osm3s?.timestamp_osm_base || null,
        fetchedAt: new Date(timestamp).toISOString(),
        timestamp,
        places: normalizePlaces(data.elements)
      };
      retryAt = 0;
      return snapshot();
    } catch {
      retryAt = now() + BACKOFF_MS;
      if (cached) return snapshot(true);
      throw unavailable();
    }
  }

  return async function getPlaces() {
    if (cached && now() < cached.timestamp + CACHE_MS) return snapshot();
    if (now() < retryAt) {
      if (cached) return snapshot(true);
      throw unavailable();
    }
    if (!pending) pending = load().finally(() => { pending = null; });
    return pending;
  };
}

module.exports = { createPlacesService, normalizePlaces };
