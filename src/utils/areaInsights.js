// Indicadores de la ubicación seleccionada a partir del inventario real de
// OpenStreetMap (/api/osm/area). Las escalas son reglas de ejemplo declaradas
// en la interfaz: no son datos oficiales ni predicen resultados.
import { businessTypes } from "../data/zones";
import { calculateLocationScore, getLocationBreakdown } from "./locationAlgorithm";

// Giros de OpenStreetMap que compiten con cada tipo de negocio del prototipo.
const BUSINESS_KINDS = {
  cafeteria: ["cafe", "restaurant", "bakery"],
  farmacia: ["pharmacy"],
  supermercado: ["supermarket", "convenience", "greengrocer"]
};

// Reglas de normalización a 0-100 (visibles en la interfaz).
const SCALES = {
  demandPerKm2: 1000,
  competition: 12,
  services: 40
};

const clamp = value => Math.max(0, Math.min(100, Math.round(value)));

function kindOf(feature) {
  const tags = feature?.tags ?? {};

  return tags.amenity || tags.shop || tags.leisure || "";
}

export function summarizeInventory(snapshot) {
  const features = Array.isArray(snapshot?.features) ? snapshot.features : [];
  const areaKm2 = Number(snapshot?.areaKm2) || 0;
  const streets = features.filter(feature => feature.kind === "street");
  const pedestrian = streets.filter(feature => feature.pedestrian).length;
  const buildings = features.filter(feature => feature.kind === "building").length;
  const community = features.filter(
    feature => feature.kind === "commerce" || feature.kind === "service"
  ).length;

  return {
    areaKm2,
    totalFeatures: features.length,
    features,
    counts: snapshot?.counts ?? {},
    buildings,
    buildingsPerKm2:
      areaKm2 > 0 ? Math.round(buildings / areaKm2) : 0,
    streetCount: streets.length,
    pedestrianStreets: pedestrian,
    pedestrianShare:
      streets.length > 0 ? clamp((pedestrian / streets.length) * 100) : 0,
    communityPlaces: community
  };
}

export function analyzeArea(snapshot, businessType) {
  const summary = summarizeInventory(snapshot);
  const business = businessTypes[businessType];

  if (!business) return null;

  const competing = summary.features.filter(feature =>
    (BUSINESS_KINDS[businessType] ?? []).includes(kindOf(feature))
  ).length;

  const zone = {
    population: clamp(
      (summary.buildingsPerKm2 / SCALES.demandPerKm2) * 100
    ),
    access: summary.pedestrianShare,
    competition: clamp((competing / SCALES.competition) * 100),
    services: clamp((summary.communityPlaces / SCALES.services) * 100)
  };

  const raw = {
    population: `${summary.buildingsPerKm2.toLocaleString("es-PA")} edificios/km²`,
    access: `${summary.pedestrianStreets} de ${summary.streetCount} vías peatonales`,
    competition: `${competing} locales del mismo giro`,
    services: `${summary.communityPlaces} comercios y servicios`
  };

  const rules = {
    population: `100 puntos = ${SCALES.demandPerKm2.toLocaleString("es-PA")} edificios por km²`,
    access: "100 puntos = todas las vías mapeadas son peatonales",
    competition: `100 puntos = ${SCALES.competition} o más locales del mismo giro`,
    services: `100 puntos = ${SCALES.services} o más comercios y servicios`
  };

  return {
    summary,
    zone,
    raw,
    rules,
    score: calculateLocationScore(zone, businessType),
    breakdown: getLocationBreakdown(zone, businessType)
  };
}
