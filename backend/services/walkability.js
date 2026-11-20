// Inventario de servicios con Overpass: radio piloto por defecto o un área (bbox).
// No se aceptan consultas Overpass libres ni URLs arbitrarias: solo el radio del
// piloto o una bbox validada por la ruta.
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

function queryScope(bbox) {
  if (Array.isArray(bbox)) {
    const [south, west, north, east] = bbox;
    return {
      key: `bbox:${bbox.map(value => Number(value).toFixed(5)).join(",")}`,
      area: { kind: "bbox", bbox: [south, west, north, east] },
      filter: `${south},${west},${north},${east}`
    };
  }

  return {
    key: "pilot",
    area: { kind: "radius", ...PILOT },
    filter: `around:${PILOT.radiusMeters},${PILOT.latitude},${PILOT.longitude}`
  };
}

// Factory allows controlled tests without making repeated public API requests.
function createPlacesService({ fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  const retryAt = new Map();

  function snapshot(record, stale = false) {
    return { ...record, cache: { stale, expiresAt: new Date(record.timestamp + CACHE_MS).toISOString() } };
  }

  function unavailable(key) {
    const error = new Error("El servicio de datos de OpenStreetMap no está disponible. Inténtalo de nuevo en un minuto.");
    error.status = 503;
    error.retryAfter = Math.max(1, Math.ceil(((retryAt.get(key) ?? 0) - now()) / 1000));
    return error;
  }

  async function load(scope) {
    try {
      const around = `(${scope.filter})`;
      const query = `[out:json][timeout:20];(nwr${around}[amenity~"^(school|kindergarten|university|college|pharmacy|clinic|hospital|doctors|restaurant|cafe)$"];nwr${around}[shop~"^(supermarket|convenience|greengrocer|bakery)$"];nwr${around}[leisure=park];);out center tags;`;
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
      const record = {
        area: scope.area,
        source: "OpenStreetMap · Overpass API",
        attribution: "© OpenStreetMap contributors · ODbL",
        osmTimestamp: data.osm3s?.timestamp_osm_base || null,
        fetchedAt: new Date(timestamp).toISOString(),
        timestamp,
        places: normalizePlaces(data.elements)
      };
      cache.set(scope.key, record);
      retryAt.delete(scope.key);
      return snapshot(record);
    } catch {
      retryAt.set(scope.key, now() + BACKOFF_MS);
      const cached = cache.get(scope.key);
      if (cached) return snapshot(cached, true);
      throw unavailable(scope.key);
    }
  }

  return async function getPlaces(bbox) {
    const scope = queryScope(bbox);
    const cached = cache.get(scope.key);

    if (cached && now() < cached.timestamp + CACHE_MS) return snapshot(cached);

    if (now() < (retryAt.get(scope.key) ?? 0)) {
      if (cached) return snapshot(cached, true);
      throw unavailable(scope.key);
    }

    if (!pending.has(scope.key)) {
      const task = load(scope).finally(() => pending.delete(scope.key));
      pending.set(scope.key, task);
    }

    return pending.get(scope.key);
  };
}

module.exports = { createPlacesService, normalizePlaces, queryScope };
