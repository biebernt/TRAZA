const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseBbox } = require("../routes/walkability");
const { queryScope } = require("../services/walkability");
const {
  EDITABLE_FIELDS,
  applyEditableFields,
} = require("../routes/projects");

test("la consulta de caminabilidad acepta un área válida y limita el tamaño", () => {
  const bbox = parseBbox("9,-79.59,9.005,-79.58");

  assert.deepEqual(bbox, {
    south: 9,
    west: -79.59,
    north: 9.005,
    east: -79.58,
  });
  assert.equal(parseBbox(undefined), undefined);
});

test("rechaza bbox inválidas y áreas mayores al máximo", () => {
  assert.throws(() => parseBbox("9,-79"), error => error.status === 400);
  assert.throws(
    () => parseBbox("8,-80,9.5,-79"),
    error => error.status === 422 && error.code === "area-too-large"
  );
});

test("la consulta por área usa la bbox y no el radio piloto", () => {
  const scope = queryScope([9, -79.59, 9.005, -79.58]);

  assert.equal(scope.filter, "9,-79.59,9.005,-79.58");
  assert.equal(scope.area.kind, "bbox");
  assert.match(scope.key, /^bbox:/);

  const pilot = queryScope();
  assert.equal(pilot.key, "pilot");
  assert.equal(pilot.area.kind, "radius");
  assert.match(pilot.filter, /^around:1500,/);
});

test("la actualización de proyectos no permite cambiar el propietario", () => {
  assert.equal(EDITABLE_FIELDS.includes("ownerKey"), false);
  assert.equal(EDITABLE_FIELDS.includes("_id"), false);

  const project = { name: "Original", ownerKey: "abcdefgh", status: "draft" };

  applyEditableFields(project, {
    name: "Renombrado",
    ownerKey: "otropropietario",
    status: "active",
    ignored: true,
  });

  assert.equal(project.name, "Renombrado");
  assert.equal(project.status, "active");
  assert.equal(project.ownerKey, "abcdefgh");
  assert.equal("ignored" in project, false);
});
