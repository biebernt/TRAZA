const { test } = require("node:test");
const assert = require("node:assert/strict");

const { createAreaService, createMemoryStore } = require("../services/osm");

const BBOX = [8.999, -79.002, 9.002, -78.999];

const closedSquare = [
  { lat: 9.0002, lon: -79.0018 },
  { lat: 9.0002, lon: -79.001 },
  { lat: 9.0008, lon: -79.001 },
  { lat: 9.0008, lon: -79.0018 },
  { lat: 9.0002, lon: -79.0018 },
];

const elements = [
  {
    type: "node",
    id: 1,
    lat: 9.0005,
    lon: -79.0005,
    tags: { amenity: "school", name: "Escuela de prueba" },
  },
  {
    type: "way",
    id: 2,
    tags: { highway: "footway" },
    geometry: [
      { lat: 9, lon: -79.0018 },
      { lat: 9, lon: -79 },
    ],
  },
  { type: "way", id: 3, tags: { building: "yes" }, geometry: closedSquare },
  { type: "way", id: 4, tags: { leisure: "park" }, geometry: closedSquare },
  { type: "way", id: 5, tags: { shop: "bakery" }, geometry: closedSquare },
  { type: "relation", id: 6, tags: { building: "yes" }, members: [] },
  { type: "node", id: 7, lat: 9, lon: -79 },
];

const payload = {
  version: 0.6,
  osm3s: { timestamp_osm_base: "2026-11-18T00:00:00Z" },
  elements,
};

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

function recorder(response) {
  const calls = [];

  const fetchImpl = async (url, options) => {
    calls.push({ url, options });

    if (response instanceof Error) throw response;

    return response;
  };

  fetchImpl.calls = calls;

  return fetchImpl;
}

test("normaliza nodos y vías con geometría y clasifica los usos", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl });

  const result = await service.getArea(BBOX);

  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(result.totalFeatures, 5);
  assert.equal(result.counts.street, 1);
  assert.equal(result.counts.building, 1);
  assert.equal(result.counts.green, 1);
  assert.equal(result.counts.service, 1);
  assert.equal(result.counts.commerce, 1);
  assert.equal(result.skipped.relations, 1);
  assert.equal(result.skipped.untagged, 1);

  const footway = result.features.find(feature => feature.id === "way/2");
  assert.equal(footway.geometryType, "line");
  assert.equal(footway.pedestrian, true);
  assert.ok(footway.lengthMeters > 0);

  const building = result.features.find(feature => feature.id === "way/3");
  assert.equal(building.geometryType, "polygon");
  assert.ok(building.areaM2 > 0);

  const school = result.features.find(feature => feature.id === "node/1");
  assert.equal(school.geometryType, "point");
  assert.equal(school.tags.name, "Escuela de prueba");

  assert.equal(result.source, "OpenStreetMap · Overpass API");
  assert.equal(result.attribution, "© OpenStreetMap contributors · ODbL");
  assert.equal(result.osmTimestamp, "2026-11-18T00:00:00Z");
  assert.equal(result.cache.stale, false);
  assert.ok(!Number.isNaN(Date.parse(result.fetchedAt)));
  assert.ok(result.limitations.length >= 2);
});

test("la consulta es fija, va por POST y se identifica con User-Agent propio", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl, userAgent: "URBI-Test/1.0" });

  await service.getArea(BBOX);

  const [{ url, options }] = fetchImpl.calls;
  const body = String(options.body);

  assert.equal(url, "https://overpass-api.de/api/interpreter");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["User-Agent"], "URBI-Test/1.0");
  assert.match(body, /data=/);
  assert.match(body, /%5B%22highway%22%5D/);
  assert.match(body, /8\.999%2C-79\.002%2C9\.002%2C-78\.999/);
  // Overpass necesita un límite explícito y el cliente debe esperar más que él.
  assert.match(body, /timeout%3A30/);
  // La bbox del usuario se valida antes: no puede inyectar consulta arbitraria.
  assert.ok(!body.includes("out:csv"));
});

test("reutiliza la caché y comparte solicitudes simultáneas", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl });

  const [first, second, third] = await Promise.all([
    service.getArea(BBOX),
    service.getArea(BBOX),
    service.getArea(BBOX),
  ]);

  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(first.features.length, second.features.length);
  assert.equal(third.totalFeatures, 5);

  await service.getArea(BBOX);
  assert.equal(fetchImpl.calls.length, 1);
});

test("una clave de caché normalizada comparte área entre bboxes equivalentes", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl });

  await service.getArea([8.9990000001, -79.0020000001, 9.002, -78.999]);
  await service.getArea([8.999, -79.002, 9.0020000002, -78.999]);

  assert.equal(fetchImpl.calls.length, 1);
});

test("conserva los datos anteriores y los marca como obsoletos si el proveedor falla", async () => {
  let clock = Date.parse("2026-11-18T00:00:00Z");
  let fail = false;

  const fetchImpl = async () => {
    if (fail) throw new Error("offline");

    return fakeResponse(payload);
  };

  const service = createAreaService({ fetchImpl, now: () => clock });
  const first = await service.getArea(BBOX);

  clock += 61 * 60 * 1000;
  fail = true;

  const stale = await service.getArea(BBOX);

  assert.equal(stale.cache.stale, true);
  assert.deepEqual(stale.features, first.features);
  assert.equal(stale.fetchedAt, first.fetchedAt);
});

test("sin datos previos responde 503 con espera, sin inventar un área vacía", async () => {
  let calls = 0;

  const fetchImpl = async () => {
    calls++;
    return fakeResponse({ remark: "runtime error" }, 504);
  };

  const service = createAreaService({ fetchImpl });

  await assert.rejects(
    service.getArea(BBOX),
    error =>
      error.status === 503 &&
      error.retryAfterMs === 60000 &&
      /no está disponible/.test(error.message)
  );

  // El enfriamiento evita golpear de nuevo al proveedor caído.
  await assert.rejects(service.getArea(BBOX), error => error.status === 503);
  assert.equal(calls, 1);
});

test("un 429 se traduce en espera de 30 segundos", async () => {
  const fetchImpl = recorder(fakeResponse({}, 429));
  const service = createAreaService({ fetchImpl });

  await assert.rejects(
    service.getArea(BBOX),
    error => error.status === 503 && error.retryAfterMs === 30000
  );
});

test("una respuesta incompleta con HTTP 200 se rechaza", async () => {
  const fetchImpl = recorder(
    fakeResponse({ remark: "runtime timeout", elements })
  );
  const service = createAreaService({ fetchImpl });

  await assert.rejects(
    service.getArea(BBOX),
    error => error.status === 503 && error.code === "osm-incomplete"
  );
});

test("rechaza áreas por encima del máximo sin consultar al proveedor", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl, maxAreaKm2: 2 });

  await assert.rejects(
    service.getArea([8.9, -79.2, 9.1, -78.9]),
    error => error.status === 422 && error.code === "area-too-large"
  );

  assert.equal(fetchImpl.calls.length, 0);
});

test("rechaza un bbox inválido antes de consultar", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl });

  await assert.rejects(
    service.getArea([9, -79, 9]),
    error => error.status === 400 && error.code === "invalid-bbox"
  );

  assert.equal(fetchImpl.calls.length, 0);
});

test("rechaza áreas demasiado densas en lugar de truncar la geometría", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl, maxFeatures: 3 });

  await assert.rejects(
    service.getArea(BBOX),
    error => error.status === 422 && error.code === "area-too-dense"
  );
});

test("rechaza respuestas que superan el tamaño permitido", async () => {
  const fetchImpl = recorder(fakeResponse(payload));
  const service = createAreaService({ fetchImpl, maxBytes: 64 });

  await assert.rejects(
    service.getArea(BBOX),
    error => error.status === 422 && error.code === "area-too-dense"
  );
});

test("el almacén intercambiable permite inyectar otra persistencia", async () => {
  const save = [];
  const store = {
    async get() {
      return null;
    },
    async set(key, value) {
      save.push({ key, value });
    },
    async delete() {},
  };

  const service = createAreaService({
    fetchImpl: recorder(fakeResponse(payload)),
    store,
  });

  await service.getArea(BBOX);
  assert.equal(save.length, 1);
  assert.equal(save[0].value.totalFeatures, 5);

  const memory = createMemoryStore({ maxEntries: 1 });
  await memory.set("a", { timestamp: 1 });
  await memory.set("b", { timestamp: 2 });
  assert.equal(await memory.get("a"), null);
  assert.deepEqual(await memory.get("b"), { timestamp: 2 });
});
