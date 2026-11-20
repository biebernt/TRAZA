// Servicio de extracción geográfica por área desde Overpass API.
// Sin dependencias externas: usa fetch nativo y utilidades propias.
//
// Diseño:
// - Una sola consulta por área y por ventana de caché (no por render ni por paneo).
// - Espera de cliente amplia (45 s): en horas punta Overpass tarda 30-40 s en cola.
//   Un límite más corto convierte una espera normal en un falso 503.
// - Caché en almacén intercambiable (memoria ahora; MongoDB en una fase posterior).
// - Errores honestos: si no hay datos, no se devuelve un área vacía.

const {
  GeoError,
  normalizeBbox,
  bboxAreaKm2,
  roundBbox,
  polygonAreaM2,
  polylineLengthMeters,
  polygonCentroid,
  polylineMidpoint,
  limitPathPoints,
} = require("../utils/geo");

const QUERY_VERSION = "osm-area-v1";
const DEFAULT_ENDPOINTS = ["https://overpass-api.de/api/interpreter"];
const DEFAULT_USER_AGENT = "URBI-Educational-Pilot/1.0";

const PEDESTRIAN_HIGHWAYS = new Set([
  "footway",
  "path",
  "pedestrian",
  "steps",
  "living_street",
  "sidewalk",
  "corridor",
]);

const GREEN_LEISURE = new Set([
  "park",
  "garden",
  "nature_reserve",
  "common",
  "recreation_ground",
  "village_green",
]);

const GREEN_LANDUSE = new Set([
  "grass",
  "forest",
  "meadow",
  "village_green",
  "recreation_ground",
]);

const GREEN_NATURAL = new Set(["wood", "scrub", "grassland", "heath", "wetland"]);

const TAG_KEYS = [
  "name",
  "amenity",
  "shop",
  "highway",
  "building",
  "landuse",
  "leisure",
  "natural",
  "barrier",
  "surface",
  "footway",
  "sidewalk",
  "access",
  "railway",
  "waterway",
];

const LIMITATIONS = [
  "Las relaciones de OpenStreetMap (multipolígonos) no se incluyen en esta versión.",
  "La cobertura de OpenStreetMap puede estar incompleta: los conteos describen lo mapeado, no la realidad total del área.",
  "Las áreas y longitudes son cálculos geométricos propios, no datos oficiales.",
];

function serviceError(message, { status = 503, code = "osm-unavailable", retryAfterMs } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (retryAfterMs) error.retryAfterMs = retryAfterMs;
  return error;
}

function createMemoryStore({ maxEntries = 64 } = {}) {
  const entries = new Map();

  return {
    async get(key) {
      return entries.get(key) ?? null;
    },
    async set(key, value) {
      entries.delete(key);
      entries.set(key, value);

      if (entries.size > maxEntries) {
        entries.delete(entries.keys().next().value);
      }
    },
    async delete(key) {
      entries.delete(key);
    },
  };
}

function classify(tags = {}) {
  if (tags.highway) return "street";
  if (tags.building) return "building";
  if (
    GREEN_LEISURE.has(tags.leisure) ||
    GREEN_LANDUSE.has(tags.landuse) ||
    GREEN_NATURAL.has(tags.natural)
  ) {
    return "green";
  }
  if (tags.shop) return "commerce";
  if (tags.amenity) return "service";
  if (tags.landuse) return "landuse";
  if (tags.natural) return "natural";
  return "other";
}

function pickTags(tags) {
  const picked = {};

  for (const key of TAG_KEYS) {
    const value = tags[key];

    if (typeof value === "string" && value.trim()) {
      picked[key] = value.trim().slice(0, 120);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      picked[key] = String(value);
    }
  }

  return picked;
}

function buildQuery(bbox, timeoutSeconds = 30) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  return `[out:json][timeout:${timeoutSeconds}];(` +
    `way["highway"](${box});` +
    `way["building"](${box});` +
    `way["landuse"](${box});` +
    `way["leisure"](${box});` +
    `way["natural"](${box});` +
    `way["amenity"](${box});` +
    `way["shop"](${box});` +
    `node["amenity"](${box});` +
    `node["shop"](${box});` +
    ");out tags geom;";
}

function buildFeatures(elements, { maxRingPoints = 1200 } = {}) {
  const counts = {
    street: 0,
    building: 0,
    green: 0,
    commerce: 0,
    service: 0,
    landuse: 0,
    natural: 0,
    other: 0,
  };
  const geometry = { points: 0, lines: 0, polygons: 0 };
  const skipped = { relations: 0, invalid: 0, untagged: 0 };
  const features = [];

  for (const element of elements) {
    if (!element || typeof element !== "object") {
      skipped.invalid++;
      continue;
    }

    if (element.type === "relation") {
      skipped.relations++;
      continue;
    }

    const tags = element.tags && typeof element.tags === "object" ? element.tags : null;

    if (!tags || !Object.keys(tags).length) {
      skipped.untagged++;
      continue;
    }

    const kind = classify(tags);
    let feature = null;

    if (element.type === "node") {
      if (!Number.isFinite(element.lat) || !Number.isFinite(element.lon)) {
        skipped.invalid++;
        continue;
      }

      feature = {
        id: `node/${element.id}`,
        kind,
        geometryType: "point",
        coordinates: { lat: element.lat, lon: element.lon },
        centroid: { lat: element.lat, lon: element.lon },
      };
      geometry.points++;
    } else if (
      element.type === "way" &&
      Array.isArray(element.geometry) &&
      element.geometry.length >= 2
    ) {
      const raw = element.geometry
        .filter(point => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
        .map(point => ({ lat: point.lat, lon: point.lon }));

      if (raw.length < 2) {
        skipped.invalid++;
        continue;
      }

      const first = raw[0];
      const last = raw[raw.length - 1];
      const closed =
        raw.length >= 4 && first.lat === last.lat && first.lon === last.lon;
      const polygon =
        closed &&
        ["building", "green", "landuse", "natural"].includes(kind);
      const coordinates = limitPathPoints(raw, maxRingPoints);

      feature = {
        id: `way/${element.id}`,
        kind,
        geometryType: polygon ? "polygon" : "line",
        coordinates,
        centroid: polygon ? polygonCentroid(coordinates) : polylineMidpoint(coordinates),
      };

      if (polygon) {
        feature.areaM2 = Math.round(polygonAreaM2(coordinates));
        geometry.polygons++;
      } else {
        feature.lengthMeters = Math.round(polylineLengthMeters(coordinates));
        geometry.lines++;
      }
    } else {
      skipped.invalid++;
      continue;
    }

    const picked = pickTags(tags);

    if (Object.keys(picked).length) feature.tags = picked;

    if (kind === "street") {
      feature.pedestrian = PEDESTRIAN_HIGHWAYS.has(tags.highway);
    }

    features.push(feature);
    counts[kind] = (counts[kind] ?? 0) + 1;
  }

  return { features, counts, geometry, skipped };
}

function buildSnapshot(bbox, payload, { maxFeatures, maxRingPoints, timestamp }) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  const { features, counts, geometry, skipped } = buildFeatures(elements, {
    maxRingPoints,
  });

  if (features.length > maxFeatures) {
    throw new GeoError(
      `El área contiene ${features.length} elementos y supera el máximo de ${maxFeatures}. Reduce el área o divide el análisis.`,
      { status: 422, code: "area-too-dense" }
    );
  }

  return {
    bbox,
    areaKm2: Math.round(bboxAreaKm2(bbox) * 1000) / 1000,
    query: QUERY_VERSION,
    source: "OpenStreetMap · Overpass API",
    attribution: "© OpenStreetMap contributors · ODbL",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    osmTimestamp: payload?.osm3s?.timestamp_osm_base ?? null,
    limitations: LIMITATIONS,
    counts,
    geometry,
    skipped,
    totalFeatures: features.length,
    features,
    timestamp,
  };
}

function createAreaService({
  fetchImpl = globalThis.fetch,
  now = Date.now,
  store = createMemoryStore(),
  ttlMs = 60 * 60 * 1000,
  backoffMs = 60 * 1000,
  timeoutMs = 45000,
  maxAreaKm2 = 2,
  maxFeatures = 8000,
  maxRingPoints = 1200,
  maxBytes = 8 * 1024 * 1024,
  endpoints = DEFAULT_ENDPOINTS,
  userAgent = DEFAULT_USER_AGENT,
  queryTimeoutSeconds = 30,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl debe ser una función");
  }

  const normalizedEndpoints = (Array.isArray(endpoints) ? endpoints : [endpoints])
    .map(endpoint => String(endpoint).trim())
    .filter(Boolean);

  if (!normalizedEndpoints.length) {
    throw new TypeError("Se necesita al menos un endpoint de Overpass");
  }

  const pending = new Map();
  const retryAt = new Map();

  function present({ timestamp, ...record }, stale) {
    return {
      ...record,
      fetchedAt: new Date(timestamp).toISOString(),
      cache: {
        stale,
        expiresAt: new Date(timestamp + ttlMs).toISOString(),
      },
    };
  }

  async function requestEndpoint(endpoint, query) {
    let response;

    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": userAgent,
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw serviceError(
        "No se pudo contactar con el proveedor de datos geográficos.",
        { retryAfterMs: backoffMs }
      );
    }

    if (response.status === 429) {
      throw serviceError(
        "El proveedor de datos geográficos limitó las solicitudes. Reintenta en 30 segundos.",
        { retryAfterMs: 30 * 1000, code: "osm-rate-limited" }
      );
    }

    if (!response.ok) {
      throw serviceError(
        "El proveedor de datos geográficos no está disponible en este momento.",
        { retryAfterMs: backoffMs }
      );
    }

    const text = await response.text();

    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new GeoError(
        "El área solicitada devuelve más datos de los permitidos. Reduce el área de análisis.",
        { status: 422, code: "area-too-dense" }
      );
    }

    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      throw serviceError("El proveedor devolvió una respuesta ilegible.", {
        retryAfterMs: backoffMs,
      });
    }

    // Overpass puede responder 200 con un aviso de consulta incompleta.
    if (payload?.remark) {
      throw serviceError("El proveedor devolvió una consulta incompleta.", {
        retryAfterMs: backoffMs,
        code: "osm-incomplete",
      });
    }

    if (!Array.isArray(payload?.elements)) {
      throw serviceError("El proveedor devolvió una respuesta sin elementos.", {
        retryAfterMs: backoffMs,
        code: "osm-incomplete",
      });
    }

    return payload;
  }

  async function queryOverpass(bbox) {
    const query = buildQuery(bbox, queryTimeoutSeconds);
    let lastError;

    // Los endpoints alternativos solo se usan si se configuran explícitamente.
    for (const endpoint of normalizedEndpoints) {
      try {
        return await requestEndpoint(endpoint, query);
      } catch (error) {
        lastError = error;

        if (error.status && error.status < 500) throw error;
      }
    }

    throw lastError;
  }

  async function load(bbox, key) {
    try {
      const payload = await queryOverpass(bbox);
      const record = buildSnapshot(bbox, payload, {
        maxFeatures,
        maxRingPoints,
        timestamp: now(),
      });

      await store.set(key, record);
      retryAt.delete(key);

      return present(record, false);
    } catch (error) {
      if (error.status && error.status < 500) throw error;

      const retryAfterMs = error.retryAfterMs ?? backoffMs;
      retryAt.set(key, now() + retryAfterMs);

      const cached = await store.get(key);

      if (cached) return present(cached, true);

      throw serviceError(
        "El servicio de datos de OpenStreetMap no está disponible. Inténtalo de nuevo en un minuto.",
        { retryAfterMs, code: error.code ?? "osm-unavailable" }
      );
    }
  }

  async function getArea(input) {
    const bbox = normalizeBbox(input);
    const areaKm2 = bboxAreaKm2(bbox);

    if (areaKm2 > maxAreaKm2) {
      throw new GeoError(
        `El área solicitada (${areaKm2.toFixed(2)} km²) supera el máximo de ${maxAreaKm2} km². Ajusta el mapa o divide el análisis.`,
        { status: 422, code: "area-too-large" }
      );
    }

    const key = `${QUERY_VERSION}:${roundBbox(bbox)}`;
    const cached = await store.get(key);

    if (cached && now() < cached.timestamp + ttlMs) {
      return present(cached, false);
    }

    const blockedUntil = retryAt.get(key) ?? 0;

    if (now() < blockedUntil) {
      if (cached) return present(cached, true);

      throw serviceError(
        "El servicio de datos de OpenStreetMap no está disponible. Inténtalo de nuevo en un minuto.",
        {
          retryAfterMs: Math.max(1000, blockedUntil - now()),
          code: "osm-unavailable",
        }
      );
    }

    if (!pending.has(key)) {
      const task = load(bbox, key).finally(() => pending.delete(key));
      pending.set(key, task);
    }

    return pending.get(key);
  }

  return { getArea };
}

module.exports = {
  QUERY_VERSION,
  DEFAULT_ENDPOINTS,
  PEDESTRIAN_HIGHWAYS,
  createAreaService,
  createMemoryStore,
  buildQuery,
  buildFeatures,
  buildSnapshot,
  classify,
};
