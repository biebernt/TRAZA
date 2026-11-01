import { businessTypes } from "../data/zones";

export function getLocationBreakdown(zone, businessType) {
  const business = businessTypes[businessType];

  if (!business) {
    throw new Error("Tipo de negocio no válido");
  }

  const w = business.weights;

  return [
    { key: "population", label: "Demanda", value: zone.population, adjusted: zone.population },
    { key: "access", label: "Accesibilidad", value: zone.access, adjusted: zone.access },
    { key: "competition", label: "Competencia", value: zone.competition, adjusted: 100 - zone.competition },
    { key: "services", label: "Servicios", value: zone.services, adjusted: zone.services }
  ].map(criterion => ({
    ...criterion,
    weight: w[criterion.key],
    contribution: criterion.adjusted * w[criterion.key]
  }));
}

export function calculateLocationScore(zone, businessType) {
  const score = getLocationBreakdown(zone, businessType)
    .reduce((total, criterion) => total + criterion.contribution, 0);
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
