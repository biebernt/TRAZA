// Utilidades geoespaciales sin dependencias externas.
// Coordenadas en grados decimales WGS84: { lat, lon } o [lat, lon].

const EARTH_RADIUS_M = 6371008.8;

class GeoError extends Error {
  constructor(message, { status = 400, code = "invalid-geometry" } = {}) {
    super(message);
    this.name = "GeoError";
    this.status = status;
    this.code = code;
  }
}

const toRadians = degrees => (degrees * Math.PI) / 180;
const toDegrees = radians => (radians * 180) / Math.PI;

function assertPoint(point) {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
    throw new GeoError("El punto debe tener latitud y longitud numéricas");
  }

  if (Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) {
    throw new GeoError("El punto está fuera de los límites del planeta");
  }

  return { lat: point.lat, lon: point.lon };
}

function toPoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    return assertPoint({ lat: Number(value[0]), lon: Number(value[1]) });
  }

  if (value && typeof value === "object") {
    return assertPoint({
      lat: Number(value.lat),
      lon: Number(value.lon ?? value.lng),
    });
  }

  throw new GeoError("Punto no válido");
}

function toRing(points) {
  if (!Array.isArray(points) || points.length < 3) {
    throw new GeoError("Un polígono necesita al menos tres puntos");
  }

  const ring = points.map(toPoint);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first.lat === last.lat && first.lon === last.lon) {
    return ring.slice(0, -1);
  }

  return ring;
}

// Distancia sobre la esfera (haversine).
function distanceMeters(a, b) {
  const from = toPoint(a);
  const to = toPoint(b);

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(to.lon - from.lon);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function polylineLengthMeters(points) {
  const list = points.map(toPoint);
  let total = 0;

  for (let i = 1; i < list.length; i++) {
    total += distanceMeters(list[i - 1], list[i]);
  }

  return total;
}

// Área esférica de un anillo. No admite cruces del antimeridiano.
function polygonAreaM2(points) {
  const ring = toRing(points);
  let sum = 0;

  for (let i = 0; i < ring.length; i++) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];

    sum +=
      toRadians(next.lon - current.lon) *
      (2 + Math.sin(toRadians(current.lat)) + Math.sin(toRadians(next.lat)));
  }

  return Math.abs(sum) * EARTH_RADIUS_M * EARTH_RADIUS_M / 2;
}

// Proyección local equirectangular: suficiente para distancias urbanas.
function localXY(origin, point) {
  const base = toPoint(origin);
  const target = toPoint(point);

  return {
    x:
      toRadians(target.lon - base.lon) *
      Math.cos(toRadians(base.lat)) *
      EARTH_RADIUS_M,
    y: toRadians(target.lat - base.lat) * EARTH_RADIUS_M,
  };
}

function fromLocalXY(origin, local) {
  const base = toPoint(origin);
  const cosLat = Math.cos(toRadians(base.lat));

  return {
    lat: base.lat + toDegrees(local.y / EARTH_RADIUS_M),
    lon:
      base.lon +
      toDegrees(local.x / (EARTH_RADIUS_M * (Math.abs(cosLat) < 1e-9 ? 1e-9 : cosLat))),
  };
}

function pointInPolygon(point, points) {
  const ring = toRing(points);
  const target = toPoint(point);
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const currentLat = ring[i].lat;
    const currentLon = ring[i].lon;
    const previousLat = ring[j].lat;
    const previousLon = ring[j].lon;

    const crosses = currentLat > target.lat !== previousLat > target.lat;

    if (
      crosses &&
      target.lon <
        ((previousLon - currentLon) * (target.lat - currentLat)) /
          (previousLat - currentLat) +
          currentLon
    ) {
      inside = !inside;
    }
  }

  return inside;
}

function segmentDistanceSquared(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  );

  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;

  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

function distanceToSegmentMeters(point, start, end) {
  const target = toPoint(point);
  const origin = target;

  return Math.sqrt(
    segmentDistanceSquared(
      { x: 0, y: 0 },
      localXY(origin, start),
      localXY(origin, end)
    )
  );
}

function distanceToPolylineMeters(point, points) {
  const list = points.map(toPoint);

  if (list.length === 1) return distanceMeters(point, list[0]);

  let minimum = Infinity;

  for (let i = 1; i < list.length; i++) {
    minimum = Math.min(
      minimum,
      distanceToSegmentMeters(point, list[i - 1], list[i])
    );
  }

  return minimum;
}

// Douglas-Peucker sobre la proyección local.
function simplifyPath(points, toleranceMeters) {
  const list = points.map(toPoint);

  if (list.length <= 2 || !(toleranceMeters > 0)) return list;

  const origin = list[0];
  const local = list.map(point => localXY(origin, point));
  const keep = new Array(list.length).fill(false);
  const toleranceSquared = toleranceMeters * toleranceMeters;

  keep[0] = true;
  keep[list.length - 1] = true;

  const stack = [[0, list.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    let furthest = 0;
    let index = -1;

    for (let i = start + 1; i < end; i++) {
      const squared = segmentDistanceSquared(local[i], local[start], local[end]);

      if (squared > furthest) {
        furthest = squared;
        index = i;
      }
    }

    if (furthest > toleranceSquared && index !== -1) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  return list.filter((_, index) => keep[index]);
}

// Reduce la cantidad de vértices sin cortar la geometría.
function limitPathPoints(points, maxPoints) {
  if (points.length <= maxPoints) return points.map(toPoint);

  let tolerance = 0.5;
  let result = points.map(toPoint);

  while (result.length > maxPoints && tolerance <= 64) {
    result = simplifyPath(points, tolerance);
    tolerance *= 2;
  }

  return result;
}

function polygonCentroid(points) {
  const ring = toRing(points);
  const origin = ring[0];
  const local = ring.map(point => localXY(origin, point));

  let twiceArea = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < local.length; i++) {
    const current = local[i];
    const next = local[(i + 1) % local.length];
    const cross = current.x * next.y - next.x * current.y;

    twiceArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }

  if (Math.abs(twiceArea) < 1e-9) {
    const average = local.reduce(
      (accumulator, point) => ({
        x: accumulator.x + point.x / local.length,
        y: accumulator.y + point.y / local.length,
      }),
      { x: 0, y: 0 }
    );

    return fromLocalXY(origin, average);
  }

  const factor = 1 / (3 * twiceArea);

  return fromLocalXY(origin, { x: x * factor, y: y * factor });
}

function polylineMidpoint(points) {
  const list = points.map(toPoint);

  if (list.length === 1) return list[0];

  const total = polylineLengthMeters(list);
  let target = total / 2;

  for (let i = 1; i < list.length; i++) {
    const segment = distanceMeters(list[i - 1], list[i]);

    if (segment >= target) {
      const ratio = segment === 0 ? 0 : target / segment;

      return {
        lat: list[i - 1].lat + (list[i].lat - list[i - 1].lat) * ratio,
        lon: list[i - 1].lon + (list[i].lon - list[i - 1].lon) * ratio,
      };
    }

    target -= segment;
  }

  return list[list.length - 1];
}

function normalizeBbox(input) {
  let south;
  let west;
  let north;
  let east;

  if (typeof input === "string") {
    input = input.split(",").map(part => part.trim());
  }

  if (Array.isArray(input) && input.length === 4) {
    [south, west, north, east] = input.map(Number);
  } else if (input && typeof input === "object") {
    south = Number(input.south);
    west = Number(input.west);
    north = Number(input.north);
    east = Number(input.east);
  } else {
    throw new GeoError(
      "Indica el área como bbox=south,west,north,east",
      { code: "invalid-bbox" }
    );
  }

  if (![south, west, north, east].every(Number.isFinite)) {
    throw new GeoError("La bbox necesita cuatro números", {
      code: "invalid-bbox",
    });
  }

  if (south < -90 || north > 90 || west < -180 || east > 180) {
    throw new GeoError("La bbox está fuera de los límites del planeta", {
      code: "invalid-bbox",
    });
  }

  if (north <= south) {
    throw new GeoError("La latitud norte debe ser mayor que la sur", {
      code: "invalid-bbox",
    });
  }

  if (east <= west) {
    throw new GeoError("La longitud este debe ser mayor que la oeste", {
      code: "invalid-bbox",
    });
  }

  return { south, west, north, east };
}

function bboxCorners(bbox) {
  const { south, west, north, east } = normalizeBbox(bbox);

  return [
    { lat: south, lon: west },
    { lat: south, lon: east },
    { lat: north, lon: east },
    { lat: north, lon: west },
  ];
}

function bboxAreaKm2(bbox) {
  return polygonAreaM2(bboxCorners(bbox)) / 1e6;
}

function bboxCenter(bbox) {
  const { south, west, north, east } = normalizeBbox(bbox);

  return { lat: (south + north) / 2, lon: (west + east) / 2 };
}

function bboxContains(bbox, point) {
  const { south, west, north, east } = normalizeBbox(bbox);
  const target = toPoint(point);

  return (
    target.lat >= south &&
    target.lat <= north &&
    target.lon >= west &&
    target.lon <= east
  );
}

function bboxFromPoints(points) {
  const list = points.map(toPoint);

  if (!list.length) throw new GeoError("No hay puntos para calcular la bbox");

  return list.reduce(
    (accumulator, point) => ({
      south: Math.min(accumulator.south, point.lat),
      west: Math.min(accumulator.west, point.lon),
      north: Math.max(accumulator.north, point.lat),
      east: Math.max(accumulator.east, point.lon),
    }),
    {
      south: list[0].lat,
      west: list[0].lon,
      north: list[0].lat,
      east: list[0].lon,
    }
  );
}

function roundBbox(bbox, decimals = 5) {
  const { south, west, north, east } = normalizeBbox(bbox);
  const factor = 10 ** decimals;

  return [south, west, north, east]
    .map(value => (Math.round(value * factor) / factor).toFixed(decimals))
    .join(",");
}

module.exports = {
  EARTH_RADIUS_M,
  GeoError,
  toRadians,
  toDegrees,
  toPoint,
  distanceMeters,
  polylineLengthMeters,
  polygonAreaM2,
  pointInPolygon,
  distanceToSegmentMeters,
  distanceToPolylineMeters,
  simplifyPath,
  limitPathPoints,
  polygonCentroid,
  polylineMidpoint,
  normalizeBbox,
  bboxCorners,
  bboxAreaKm2,
  bboxCenter,
  bboxContains,
  bboxFromPoints,
  roundBbox,
};
