const mongoose = require("mongoose");

const LIMITS = Object.freeze({
  name: 100,
  description: 500,
  features: 5000,
  interventions: 2000,
  scenarios: 50,
  analysis: 100,
  polygonVertices: 2000,
});

const GRID_CELL_TYPES = ["empty", "road", "house", "business", "park", "school"];

const coordinateSchema = new mongoose.Schema(
  {
    lat: { type: Number, min: -90, max: 90 },
    lon: { type: Number, min: -180, max: 180 },
  },
  { _id: false }
);

const areaSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["viewport", "polygon"], default: "viewport" },
    name: { type: String, trim: true, maxlength: 120, default: "" },
    key: { type: String, trim: true, maxlength: 80, default: "" },
    center: { type: coordinateSchema, default: undefined },
    zoom: { type: Number, min: 1, max: 22, default: undefined },
    bbox: {
      type: [Number],
      default: undefined,
      validate: {
        validator: value =>
          Array.isArray(value) &&
          value.length === 4 &&
          value.every(cell => Number.isFinite(cell)) &&
          value[0] >= -90 &&
          value[2] <= 90 &&
          value[1] >= -180 &&
          value[3] <= 180 &&
          value[2] > value[0] &&
          value[3] > value[1],
        message: "La bbox debe ser [sur, oeste, norte, este] con valores válidos",
      },
    },
    polygon: {
      type: [[Number]],
      default: undefined,
      validate: {
        validator: value =>
          Array.isArray(value) &&
          value.length >= 3 &&
          value.length <= LIMITS.polygonVertices &&
          value.every(
            point =>
              Array.isArray(point) &&
              point.length === 2 &&
              Number.isFinite(point[0]) &&
              Number.isFinite(point[1]) &&
              Math.abs(point[0]) <= 90 &&
              Math.abs(point[1]) <= 180
          ),
        message: `El polígono debe tener entre 3 y ${LIMITS.polygonVertices} vértices válidos`,
      },
    },
  },
  { _id: false }
);

const featureSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, required: true, trim: true, maxlength: 40 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lon: { type: Number, required: true, min: -180, max: 180 },
    label: { type: String, trim: true, maxlength: 120, default: "" },
    osmId: { type: String, trim: true, maxlength: 60, default: "" },
  },
  { _id: false }
);

const interventionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    kind: {
      type: String,
      required: true,
      enum: [
        "add-feature",
        "remove-feature",
        "change-use",
        "add-green",
        "add-connection",
        "split-block",
        "merge-blocks",
      ],
    },
    targetOsmId: { type: String, trim: true, maxlength: 60, default: "" },
    geometry: { type: [[Number]], default: undefined },
    properties: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const scenarioSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 120 },
    name: { type: String, trim: true, maxlength: 120, default: "Escenario" },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    interventions: { type: [interventionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    scenarioId: { type: String, trim: true, maxlength: 120, default: "" },
    computedAt: { type: Date, default: Date.now },
    method: { type: String, trim: true, maxlength: 200, default: "" },
    indicators: { type: mongoose.Schema.Types.Mixed, default: {} },
    coverage: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const baseSnapshotSchema = new mongoose.Schema(
  {
    source: { type: String, trim: true, maxlength: 120, default: "" },
    osmTimestamp: { type: String, trim: true, maxlength: 40, default: "" },
    fetchedAt: { type: Date, default: undefined },
    extractKey: { type: String, trim: true, maxlength: 120, default: "" },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: LIMITS.name,
    },
    description: {
      type: String,
      default: "",
      maxlength: LIMITS.description,
    },
    // "grid" conserva los proyectos de 10 × 10; "geo" usa el área geográfica.
    mode: {
      type: String,
      enum: ["grid", "geo"],
      default: "grid",
    },
    // Opcional: los proyectos geográficos no usan la cuadrícula de 100 celdas.
    map: {
      type: [String],
      default: undefined,
      validate: {
        validator: value =>
          Array.isArray(value) &&
          value.length === 100 &&
          value.every(cell => GRID_CELL_TYPES.includes(cell)),
        message: "El mapa debe contener 100 celdas válidas",
      },
    },
    area: { type: areaSchema, default: undefined },
    // Cuenta propietaria. Los proyectos guardados sin sesión no lo tienen.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
    // Propiedad por navegador: identificador público, no una credencial.
    ownerKey: {
      type: String,
      trim: true,
      maxlength: 64,
      match: [/^[A-Za-z0-9_-]{8,64}$/, "La clave de propietario no es válida"],
      default: undefined,
    },
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
    },
    features: {
      type: [featureSchema],
      default: [],
      validate: {
        validator: value => value.length <= LIMITS.features,
        message: `Un proyecto admite hasta ${LIMITS.features} elementos`,
      },
    },
    interventions: {
      type: [interventionSchema],
      default: [],
      validate: {
        validator: value => value.length <= LIMITS.interventions,
        message: `Un proyecto admite hasta ${LIMITS.interventions} intervenciones`,
      },
    },
    scenarios: {
      type: [scenarioSchema],
      default: [],
      validate: {
        validator: value => value.length <= LIMITS.scenarios,
        message: `Un proyecto admite hasta ${LIMITS.scenarios} escenarios`,
      },
    },
    analysis: {
      type: [analysisSchema],
      default: [],
      validate: {
        validator: value => value.length <= LIMITS.analysis,
        message: `Un proyecto admite hasta ${LIMITS.analysis} análisis`,
      },
    },
    baseSnapshot: { type: baseSnapshotSchema, default: undefined },
  },
  { timestamps: true }
);

// Mantiene la regla anterior: un proyecto de cuadrícula siempre trae 100 celdas.
// Un proyecto geográfico, en cambio, necesita área.
projectSchema.pre("validate", function validateProjectShape() {
  if (this.mode === "geo") {
    if (!this.area) {
      this.invalidate(
        "area",
        "El área geográfica es obligatoria en un proyecto de tipo geo"
      );
    }

    return;
  }

  if (!Array.isArray(this.map)) {
    this.invalidate("map", "El mapa debe contener 100 celdas válidas");
  }
});

projectSchema.index({ ownerKey: 1, updatedAt: -1 });
projectSchema.index({ user: 1, updatedAt: -1 });
projectSchema.index({ updatedAt: -1 });

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
module.exports.LIMITS = LIMITS;
module.exports.GRID_CELL_TYPES = GRID_CELL_TYPES;
