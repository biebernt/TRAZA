const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  GeoError,
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
  bboxAreaKm2,
  bboxCenter,
  bboxContains,
  bboxFromPoints,
  roundBbox,
} = require("../utils/geo");

const closeTo = (actual, expected, tolerance, label) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: esperado ${expected} ± ${tolerance}, recibido ${actual}`
  );
};

const CIUDAD_DEL_SABER = { lat: 9.0025, lon: -79.5804 };

// 0,001° de latitud ≈ 111,19 m con R = 6 371 008,8 m.
const ONE_THOUSANDTH_DEGREE_M = 111.195;

test("haversine: distancia cero y un milésimo de grado", () => {
  assert.equal(distanceMeters(CIUDAD_DEL_SABER, CIUDAD_DEL_SABER), 0);

  closeTo(
    distanceMeters(
      { lat: 9, lon: -79 },
      { lat: 9.001, lon: -79 }
    ),
    ONE_THOUSANDTH_DEGREE_M,
    0.2,
    "latitud"
  );
});

test("haversine: la longitud se acorta al alejarse del ecuador", () => {
  const atEquator = distanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 });
  const atNine = distanceMeters({ lat: 9, lon: -79 }, { lat: 9, lon: -78.999 });

  assert.ok(atNine < atEquator);
  closeTo(atNine, atEquator * Math.cos((9 * Math.PI) / 180), 0.5, "coseno");
});

test("longitud de una polilínea y su punto medio", () => {
  const line = [
    { lat: 9, lon: -79.002 },
    { lat: 9, lon: -79.001 },
    { lat: 9, lon: -79 },
  ];

  closeTo(polylineLengthMeters(line), 2 * ONE_THOUSANDTH_DEGREE_M * Math.cos((9 * Math.PI) / 180), 1, "longitud");

  const middle = polylineMidpoint(line);
  closeTo(middle.lon, -79.001, 1e-6, "punto medio");
  closeTo(middle.lat, 9, 1e-9, "punto medio lat");
});

test("área de un cuadrado de 0,001° y de una bbox", () => {
  const square = [
    { lat: 9, lon: -79.001 },
    { lat: 9, lon: -79 },
    { lat: 9.001, lon: -79 },
    { lat: 9.001, lon: -79.001 },
  ];

  // 111,19 m de alto × 109,83 m de ancho ≈ 12 212 m².
  const expected = ONE_THOUSANDTH_DEGREE_M * ONE_THOUSANDTH_DEGREE_M * Math.cos((9 * Math.PI) / 180);
  closeTo(polygonAreaM2(square), expected, expected * 0.01, "área del anillo");

  // El mismo cuadrado cerrado debe dar lo mismo.
  closeTo(
    polygonAreaM2([...square, square[0]]),
    polygonAreaM2(square),
    1e-6,
    "anillo cerrado"
  );

  const bbox = { south: 9, west: -79.001, north: 9.001, east: -79 };
  closeTo(bboxAreaKm2(bbox), polygonAreaM2(square) / 1e6, 1e-9, "área de bbox");
});

test("punto en polígono dentro, fuera y con el orden invertido", () => {
  const square = [
    { lat: 9, lon: -79.001 },
    { lat: 9, lon: -79 },
    { lat: 9.001, lon: -79 },
    { lat: 9.001, lon: -79.001 },
  ];
  const reversed = [...square].reverse();

  assert.equal(pointInPolygon({ lat: 9.0005, lon: -79.0005 }, square), true);
  assert.equal(pointInPolygon({ lat: 9.0005, lon: -79.0005 }, reversed), true);
  assert.equal(pointInPolygon({ lat: 9.002, lon: -79.0005 }, square), false);
  assert.equal(pointInPolygon({ lat: 9.0005, lon: -78.999 }, square), false);
});

test("distancia a un segmento y a una polilínea", () => {
  const start = { lat: 9, lon: -79.002 };
  const end = { lat: 9, lon: -79 };

  closeTo(
    distanceToSegmentMeters({ lat: 9.001, lon: -79.001 }, start, end),
    ONE_THOUSANDTH_DEGREE_M,
    1.5,
    "perpendicular"
  );

  // Un punto más allá del extremo se mide contra el extremo.
  closeTo(
    distanceToSegmentMeters({ lat: 9, lon: -79.001 }, start, end),
    0,
    1,
    "sobre el segmento"
  );

  closeTo(
    distanceToPolylineMeters({ lat: 9.001, lon: -79.0015 }, [start, { lat: 9, lon: -79.001 }, end]),
    ONE_THOUSANDTH_DEGREE_M,
    1.5,
    "polilínea"
  );
});

test("simplificación elimina vértices colineales y respeta las esquinas", () => {
  const straight = [
    { lat: 9, lon: -79.003 },
    { lat: 9, lon: -79.002 },
    { lat: 9, lon: -79.001 },
    { lat: 9, lon: -79 },
  ];

  assert.equal(simplifyPath(straight, 0.5).length, 2);

  const corner = [
    { lat: 9, lon: -79.001 },
    { lat: 9, lon: -79 },
    { lat: 9.001, lon: -79 },
  ];

  assert.equal(simplifyPath(corner, 0.5).length, 3);
});

test("limitPathPoints reduce sin exceder el máximo cuando es posible", () => {
  const zigzag = Array.from({ length: 400 }, (_, index) => ({
    lat: 9 + (index % 2) * 0.00002,
    lon: -79 + index * 0.00001,
  }));

  const limited = limitPathPoints(zigzag, 40);
  assert.ok(limited.length <= 40, `recibido ${limited.length}`);
  assert.ok(limited.length >= 2);
});

test("centroide y bbox de un anillo", () => {
  const square = [
    { lat: 9, lon: -79.002 },
    { lat: 9, lon: -79 },
    { lat: 9.001, lon: -79 },
    { lat: 9.001, lon: -79.002 },
  ];

  const centroid = polygonCentroid(square);
  closeTo(centroid.lat, 9.0005, 1e-6, "centroide lat");
  closeTo(centroid.lon, -79.001, 1e-6, "centroide lon");

  const bbox = bboxFromPoints(square);
  assert.deepEqual(bbox, { south: 9, west: -79.002, north: 9.001, east: -79 });

  const center = bboxCenter(bbox);
  closeTo(center.lat, 9.0005, 1e-12, "centro de bbox lat");
  closeTo(center.lon, -79.001, 1e-12, "centro de bbox lon");
  assert.equal(bboxContains(bbox, { lat: 9.0005, lon: -79.001 }), true);
  assert.equal(bboxContains(bbox, { lat: 9.01, lon: -79.001 }), false);
});

test("roundBbox estabiliza la clave de caché", () => {
  assert.equal(
    roundBbox({ south: 9.0000001, west: -79.5900002, north: 9.01, east: -79.58 }),
    "9.00000,-79.59000,9.01000,-79.58000"
  );
});

test("normalizeBbox acepta arrays y objetos y rechaza entradas inválidas con error 400", () => {
  const expected = { south: 9, west: -79.6, north: 9.01, east: -79.59 };

  assert.deepEqual(normalizeBbox([9, -79.6, 9.01, -79.59]), expected);
  assert.deepEqual(normalizeBbox("9,-79.6,9.01,-79.59"), expected);
  assert.deepEqual(normalizeBbox(expected), expected);

  const invalid = [
    null,
    [9, -79.6, 9.01],
    [9, -79.6, "norte", -79.59],
    [-91, -79.6, 9, -79.59],
    [9.02, -79.6, 9.01, -79.59],
    [9, -79.5, 9.01, -79.6],
  ];

  for (const value of invalid) {
    assert.throws(
      () => normalizeBbox(value),
      error => error instanceof GeoError && error.status === 400,
      `debería rechazar ${JSON.stringify(value)}`
    );
  }
});
