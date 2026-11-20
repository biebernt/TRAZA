// Utilidades geográficas del cliente, sin librerías externas.
// La bbox siempre se expresa como [sur, oeste, norte, este].

export const TILE_SIZE = 256;
export const MIN_ZOOM = 13;
export const MAX_ZOOM = 19;
export const MAX_AREA_KM2 = 2;

const EARTH_RADIUS_M = 6371008.8;

// Área piloto verificada de Ciudad del Saber (Panamá).
export const PILOT_AREA = Object.freeze({
  name: "Ciudad del Saber (piloto)",
  bbox: [8.995, -79.589, 9.0045, -79.578],
});

export function latLonToPixel(lat, lon, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const safeLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sinLat = Math.sin((safeLat * Math.PI) / 180);

  return {
    x: ((lon + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLat) / (1 - sinLat)) /
        (4 * Math.PI)) *
      scale,
  };
}

export function pixelToLatLon(x, y, zoom) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));

  return { lat, lon };
}

export function wrapTileX(x, total) {
  return ((x % total) + total) % total;
}

// Acepta [sur, oeste, norte, este], { south, west, north, east } o
// "sur,oeste,norte,este". Devuelve la bbox normalizada o null.
export function normalizeBbox(value) {
  let bbox = null;

  if (Array.isArray(value) && value.length === 4) {
    bbox = value;
  } else if (typeof value === "string") {
    bbox = value.split(",");
  } else if (value && typeof value === "object") {
    bbox = [value.south, value.west, value.north, value.east];
  }

  if (!bbox) return null;

  const numbers = bbox.map(Number);

  if (!numbers.every(Number.isFinite)) return null;

  const [south, west, north, east] = numbers;

  if (
    south < -90 ||
    north > 90 ||
    west < -180 ||
    east > 180 ||
    north <= south ||
    east <= west
  ) {
    return null;
  }

  return [south, west, north, east];
}

// Área aproximada de la bbox sobre la esfera, en km².
export function bboxAreaKm2(bbox) {
  const [south, west, north, east] = bbox;
  const deltaLon = ((east - west) * Math.PI) / 180;
  const deltaLatSin = Math.abs(
    Math.sin((north * Math.PI) / 180) -
      Math.sin((south * Math.PI) / 180)
  );

  return (EARTH_RADIUS_M ** 2 * deltaLon * deltaLatSin) / 1e6;
}

export function bboxCenter(bbox) {
  const [south, west, north, east] = bbox;

  return {
    lat: (south + north) / 2,
    lon: (west + east) / 2,
  };
}

// Bbox visible del mapa para un centro, zoom y tamaño de lienzo dados.
export function bboxFromView({ center, zoom, width, height }) {
  if (!center || !width || !height || !Number.isFinite(zoom)) {
    return null;
  }

  const centerPixel = latLonToPixel(center.lat, center.lon, zoom);
  const northWest = pixelToLatLon(
    centerPixel.x - width / 2,
    centerPixel.y - height / 2,
    zoom
  );
  const southEast = pixelToLatLon(
    centerPixel.x + width / 2,
    centerPixel.y + height / 2,
    zoom
  );

  return normalizeBbox([
    southEast.lat,
    northWest.lon,
    northWest.lat,
    southEast.lon,
  ]);
}

// Zoom que encaja la bbox dentro del lienzo dejando un margen.
export function zoomForBbox(bbox, { width, height }, margin = 0.82) {
  if (!bbox || !width || !height) return null;

  const northWest = latLonToPixel(bbox[2], bbox[1], 0);
  const southEast = latLonToPixel(bbox[0], bbox[3], 0);

  const boxWidth = Math.abs(southEast.x - northWest.x);
  const boxHeight = Math.abs(southEast.y - northWest.y);

  if (!boxWidth || !boxHeight) return null;

  const zoom = Math.floor(
    Math.log2(
      Math.min(
        (width * margin) / boxWidth,
        (height * margin) / boxHeight
      )
    )
  );

  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

// Mayor zoom (más contexto) cuya vista no supera el área máxima indicada.
// Sirve para que la vista inicial y los encuadres automáticos respeten el
// límite de "Usar la vista actual".
export function zoomForMaxViewArea(
  center,
  { width, height },
  maxKm2 = MAX_AREA_KM2,
  margin = 0.92
) {
  if (!center || !width || !height) return null;

  for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom++) {
    const bbox = bboxFromView({
      center,
      zoom,
      width: width * margin,
      height: height * margin,
    });

    if (bbox && bboxAreaKm2(bbox) <= maxKm2) return zoom;
  }

  return MAX_ZOOM;
}

export function formatKm2(km2) {
  if (!Number.isFinite(km2)) return "—";

  if (km2 < 1) {
    return `${(km2 * 100).toLocaleString("es-PA", {
      maximumFractionDigits: 1,
    })} ha`;
  }

  return `${km2.toLocaleString("es-PA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} km²`;
}

export function formatBbox(bbox) {
  const [south, west, north, east] = bbox;

  const degrees = (value) =>
    `${Math.abs(value).toLocaleString("es-PA", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })}°`;

  return [
    `sur ${degrees(south)}`,
    `oeste ${degrees(west)}`,
    `norte ${degrees(north)}`,
    `este ${degrees(east)}`,
  ].join(" · ");
}
