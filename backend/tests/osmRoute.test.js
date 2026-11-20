const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const { createOsmRouter, parseBbox } = require("../routes/osm");

const snapshot = {
  bbox: { south: 8.999, west: -79.002, north: 9.002, east: -78.999 },
  areaKm2: 0.11,
  totalFeatures: 0,
  features: [],
  source: "OpenStreetMap · Overpass API",
  attribution: "© OpenStreetMap contributors · ODbL",
  cache: { stale: false, expiresAt: "2026-11-18T01:00:00.000Z" },
  fetchedAt: "2026-11-18T00:00:00.000Z",
};

async function withServer(router, run) {
  const app = express();
  app.use("/api/osm", router);

  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test("parseBbox exige cuatro números", () => {
  assert.deepEqual(parseBbox("8.9,-79,9,-78.9"), [8.9, -79, 9, -78.9]);
  assert.equal(parseBbox("8.9,-79,9"), undefined);
  assert.equal(parseBbox(undefined), undefined);
  assert.equal(parseBbox(["8.9"]), undefined);
});

test("GET /api/osm/area devuelve la instantánea del servicio", async () => {
  const service = { getArea: async bbox => ({ ...snapshot, bbox: { bbox } }) };

  await withServer(createOsmRouter({ service }), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/osm/area?bbox=8.999,-79.002,9.002,-78.999`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.source, "OpenStreetMap · Overpass API");
    assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  });
});

test("GET /api/osm/area sin bbox responde 400", async () => {
  const service = { getArea: async () => snapshot };

  await withServer(createOsmRouter({ service }), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/osm/area`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, "invalid-bbox");
  });
});

test("GET /api/osm/area propaga el estado del error y Retry-After", async () => {
  const service = {
    getArea: async () => {
      const error = new Error("Proveedor no disponible");
      error.status = 503;
      error.code = "osm-unavailable";
      error.retryAfterMs = 60000;
      throw error;
    },
  };

  await withServer(createOsmRouter({ service }), async baseUrl => {
    const response = await fetch(`${baseUrl}/api/osm/area?bbox=8.999,-79.002,9.002,-78.999`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.equal(body.code, "osm-unavailable");
  });
});
