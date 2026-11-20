const { test } = require("node:test");
const assert = require("node:assert/strict");

const Project = require("../models/Project");

// Mongoose 9 no ejecuta los hooks pre("validate") en validateSync();
// la ruta real de create()/save() es validate(), así que probamos esa.
async function expectInvalid(project) {
  try {
    await project.validate();
  } catch (error) {
    return error;
  }

  assert.fail("Se esperaba un error de validación y no ocurrió");
}

const emptyGrid = () => Array(100).fill("empty");

const geoProject = () => ({
  name: "Intervención en Ciudad del Saber",
  mode: "geo",
  area: {
    kind: "viewport",
    name: "Área piloto",
    key: "osm-area-v1:8.99900,-79.00200,9.00200,-78.99900",
    center: { lat: 9.0005, lon: -79.0005 },
    zoom: 17,
    bbox: [8.999, -79.002, 9.002, -78.999],
    polygon: [
      [8.999, -79.002],
      [8.999, -78.999],
      [9.002, -78.999],
    ],
  },
  ownerKey: "browser-3f7a9c21d4e5",
  baseSnapshot: {
    source: "OpenStreetMap · Overpass API",
    osmTimestamp: "2026-11-18T00:00:00Z",
    fetchedAt: new Date("2026-11-18T00:05:00Z"),
    extractKey: "osm-area-v1:8.99900,-79.00200,9.00200,-78.99900",
  },
  features: [
    {
      id: "1750000000000-ab12cd",
      type: "park",
      lat: 9.0005,
      lon: -79.0005,
      label: "Parque propuesto",
    },
  ],
  interventions: [
    {
      id: "int-1",
      kind: "add-green",
      targetOsmId: "way/123456",
      geometry: [
        [9.0005, -79.0005],
        [9.0006, -79.0005],
        [9.0006, -79.0004],
      ],
      properties: { areaM2: 420 },
    },
  ],
  scenarios: [
    {
      id: "sc-1",
      name: "Con parque",
      interventions: [],
    },
  ],
  analysis: [
    {
      scenarioId: "sc-1",
      method: "Proximidad en línea recta",
      indicators: { greenRatio: 0.18 },
      coverage: { buildings: 42 },
    },
  ],
});

test("un proyecto antiguo de 100 celdas sigue siendo válido", async () => {
  const project = new Project({ name: "Barrio Las Palmeras", map: emptyGrid() });

  await assert.doesNotReject(project.validate());
  assert.equal(project.mode, "grid");
  assert.equal(project.status, "draft");
  assert.equal(project.map.length, 100);
  assert.equal(project.features.length, 0);
});

test("el proyecto antiguo conserva su forma y su colección", () => {
  const project = new Project({ name: "Barrio", map: emptyGrid() });
  const plain = project.toObject();

  assert.equal(plain.mode, "grid");
  assert.deepEqual(plain.map, emptyGrid());
  assert.equal(Project.collection.collectionName, "projects");
});

test("una cuadrícula incompleta o con celdas desconocidas se rechaza", async () => {
  const short = new Project({ name: "Corto", map: Array(99).fill("empty") });
  assert.equal(
    (await expectInvalid(short)).errors.map.message,
    "El mapa debe contener 100 celdas válidas"
  );

  const invalidCell = new Project({
    name: "Inválido",
    map: [...Array(99).fill("empty"), "mall"],
  });
  assert.equal(
    (await expectInvalid(invalidCell)).errors.map.message,
    "El mapa debe contener 100 celdas válidas"
  );

  const missing = new Project({ name: "Sin mapa" });
  assert.equal(
    (await expectInvalid(missing)).errors.map.message,
    "El mapa debe contener 100 celdas válidas"
  );
});

test("un proyecto geográfico no necesita cuadrícula y guarda área, escenarios y análisis", async () => {
  const project = new Project(geoProject());

  await assert.doesNotReject(project.validate());
  assert.equal(project.mode, "geo");
  assert.equal(project.map, undefined);
  assert.equal(project.area.bbox.length, 4);
  assert.equal(project.features.length, 1);
  assert.equal(project.interventions[0].kind, "add-green");
  assert.equal(project.scenarios[0].name, "Con parque");
  assert.equal(project.analysis[0].indicators.greenRatio, 0.18);
});

test("un proyecto geográfico sin área se rechaza", async () => {
  const { area, ...withoutArea } = geoProject();
  const error = await expectInvalid(new Project(withoutArea));

  assert.ok(area);
  assert.equal(
    error.errors.area.message,
    "El área geográfica es obligatoria en un proyecto de tipo geo"
  );
});

test("valida bbox, polígono y clave de propietario", async () => {
  const badBbox = new Project({
    ...geoProject(),
    area: { ...geoProject().area, bbox: [9.002, -79.002, 8.999, -78.999] },
  });
  const bboxError = await expectInvalid(badBbox);
  assert.equal(
    bboxError.errors["area.bbox"].message,
    "La bbox debe ser [sur, oeste, norte, este] con valores válidos"
  );

  const badPolygon = new Project({
    ...geoProject(),
    area: { ...geoProject().area, polygon: [[9, -79], [9, -79]] },
  });
  const polygonError = await expectInvalid(badPolygon);
  assert.match(
    polygonError.errors["area.polygon"].message,
    /entre 3 y 2000 vértices válidos/
  );

  const badOwner = new Project({ ...geoProject(), ownerKey: "no vale" });
  const ownerError = await expectInvalid(badOwner);
  assert.equal(
    ownerError.errors.ownerKey.message,
    "La clave de propietario no es válida"
  );
});

test("respeta los límites de elementos e intervenciones", async () => {
  const feature = { id: "f", type: "house", lat: 9, lon: -79 };
  const manyFeatures = new Project({
    ...geoProject(),
    features: Array.from({ length: 5001 }, () => feature),
  });
  assert.match(
    (await expectInvalid(manyFeatures)).errors.features.message,
    /hasta 5000/
  );

  const badKind = new Project({
    ...geoProject(),
    interventions: [{ id: "i", kind: "demoler-ciudad" }],
  });
  assert.ok((await expectInvalid(badKind)).errors["interventions.0.kind"]);
});
