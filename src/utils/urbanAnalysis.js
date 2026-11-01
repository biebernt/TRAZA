export const CELL_TYPES = {
  empty: {
    label: "Terreno vacío",
    icon: "·",
    color: "#e8edf2"
  },
  road: {
    label: "Carretera",
    icon: "═",
    color: "#64748b"
  },
  house: {
    label: "Vivienda",
    icon: "⌂",
    color: "#60a5fa"
  },
  business: {
    label: "Comercio",
    icon: "▣",
    color: "#f59e0b"
  },
  park: {
    label: "Área verde",
    icon: "♣",
    color: "#22c55e"
  },
  school: {
    label: "Escuela",
    icon: "▤",
    color: "#a78bfa"
  }
};

export function analyzeUrbanMap(map) {
  const total = map.length;

  const counts = {
    empty: 0,
    road: 0,
    house: 0,
    business: 0,
    park: 0,
    school: 0
  };

  map.forEach(cell => {
    if (Object.hasOwn(counts, cell)) {
      counts[cell]++;
    }
  });

  const percentage = value =>
    total > 0 ? Math.round((value / total) * 100) : 0;

  const occupied = total - counts.empty;

  const greenPercentage = percentage(counts.park);
  const occupationPercentage = percentage(occupied);

  const recommendations = [];

  if (greenPercentage < 15) {
    recommendations.push(
      "Considera incorporar más áreas verdes al diseño."
    );
  }

  if (counts.house > 0 && counts.school === 0) {
    recommendations.push(
      "Evalúa incorporar una escuela para atender la zona residencial."
    );
  }

  if (occupied > 0 && counts.road === 0) {
    recommendations.push(
      "Considera incorporar carreteras para mejorar la conectividad."
    );
  }

  if (counts.business > counts.house && counts.house > 0) {
    recommendations.push(
      "Revisa el equilibrio entre espacios comerciales y residenciales."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "El diseño cumple las condiciones básicas de esta evaluación."
    );
  }

  return {
    total,
    counts,
    greenPercentage,
    occupationPercentage,
    recommendations
  };
}