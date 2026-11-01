import { businessTypes } from "../data/zones";

export function calculateLocationScore(zone, businessType) {
  const business = businessTypes[businessType];

  if (!business) {
    throw new Error("Tipo de negocio no válido");
  }

  const w = business.weights;

  const score =
    zone.population * w.population +
    zone.access * w.access +
    (100 - zone.competition) * w.competition +
    zone.services * w.services;

  return Math.round(score);
}

export function rankLocations(zones, businessType) {
  return zones
    .map(zone => ({
      ...zone,
      score: calculateLocationScore(zone, businessType)
    }))
    .sort((a, b) => b.score - a.score);
}